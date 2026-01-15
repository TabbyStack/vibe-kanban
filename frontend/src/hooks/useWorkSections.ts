import { useMemo, useCallback } from 'react';
import {
  detectWorkSections,
  type WorkSection,
} from '@/utils/workSectionDetection';
import type { PatchTypeWithKey } from '@/hooks/useConversationHistory';
import { useUiPreferencesStore } from '@/stores/useUiPreferencesStore';

export type WorkSectionItem = {
  type: 'work-section';
  key: string;
  section: WorkSection;
};

export type EntryItem = {
  type: 'entry';
  data: PatchTypeWithKey;
  sectionIndex: number | null;
};

export type ConversationItem = WorkSectionItem | EntryItem;

interface UseWorkSectionsResult {
  items: ConversationItem[];
  sections: WorkSection[];
  isSectionExpanded: (sectionIndex: number) => boolean;
  toggleSection: (sectionIndex: number) => void;
  expandAllSections: () => void;
  collapseAllSections: () => void;
}

/**
 * Hook that processes conversation entries and detects work sections.
 * Returns a list of items that can be either section headers or entries,
 * along with methods to control section expansion state.
 */
export function useWorkSections(
  entries: PatchTypeWithKey[],
  workspaceId?: string
): UseWorkSectionsResult {
  // Detect work sections from entries
  const sections = useMemo(() => detectWorkSections(entries), [entries]);

  // Create a map of entry index to section index for quick lookup
  const entryToSection = useMemo(() => {
    const map = new Map<number, number>();
    sections.forEach((section, sectionIndex) => {
      for (let i = section.startIndex; i <= section.endIndex; i++) {
        map.set(i, sectionIndex);
      }
    });
    return map;
  }, [sections]);

  // Access store for expanded state
  const expanded = useUiPreferencesStore((s) => s.expanded);
  const setExpanded = useUiPreferencesStore((s) => s.setExpanded);
  const setExpandedAll = useUiPreferencesStore((s) => s.setExpandedAll);

  // Generate section key for persistence
  const getSectionKey = useCallback(
    (sectionIndex: number) => {
      const section = sections[sectionIndex];
      if (!section) return '';
      // Use workspace ID + section type + start index for unique key
      return `work-section:${workspaceId ?? 'global'}:${section.type}:${sectionIndex}`;
    },
    [sections, workspaceId]
  );

  // Check if a section is expanded (default to true)
  const isSectionExpanded = useCallback(
    (sectionIndex: number) => {
      const key = getSectionKey(sectionIndex);
      return expanded[key] ?? true;
    },
    [expanded, getSectionKey]
  );

  // Toggle section expansion
  const toggleSection = useCallback(
    (sectionIndex: number) => {
      const key = getSectionKey(sectionIndex);
      const current = expanded[key] ?? true;
      setExpanded(key, !current);
    },
    [expanded, getSectionKey, setExpanded]
  );

  // Expand all sections
  const expandAllSections = useCallback(() => {
    const keys = sections.map((_, i) => getSectionKey(i));
    setExpandedAll(keys, true);
  }, [sections, getSectionKey, setExpandedAll]);

  // Collapse all sections
  const collapseAllSections = useCallback(() => {
    const keys = sections.map((_, i) => getSectionKey(i));
    setExpandedAll(keys, false);
  }, [sections, getSectionKey, setExpandedAll]);

  // Build the combined list of items (section headers + entries)
  const items = useMemo(() => {
    const result: ConversationItem[] = [];
    let currentSectionIndex = -1;

    entries.forEach((entry, entryIndex) => {
      const sectionIndex = entryToSection.get(entryIndex);

      // Check if we're entering a new section
      if (sectionIndex !== undefined && sectionIndex !== currentSectionIndex) {
        // Add section header
        const section = sections[sectionIndex];
        result.push({
          type: 'work-section',
          key: `section-${sectionIndex}-${section.type}`,
          section,
        });
        currentSectionIndex = sectionIndex;
      }

      // Add entry (with reference to its section)
      result.push({
        type: 'entry',
        data: entry,
        sectionIndex: sectionIndex ?? null,
      });
    });

    return result;
  }, [entries, sections, entryToSection]);

  return {
    items,
    sections,
    isSectionExpanded,
    toggleSection,
    expandAllSections,
    collapseAllSections,
  };
}

/**
 * Filters items based on section expansion state
 */
export function filterByExpandedSections(
  items: ConversationItem[],
  isSectionExpanded: (sectionIndex: number) => boolean
): ConversationItem[] {
  return items.filter((item) => {
    if (item.type === 'work-section') {
      // Always show section headers
      return true;
    }
    // Show entry only if its section is expanded (or it has no section)
    if (item.sectionIndex === null) {
      return true;
    }
    return isSectionExpanded(item.sectionIndex);
  });
}
