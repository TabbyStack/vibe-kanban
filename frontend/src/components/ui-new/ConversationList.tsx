import {
  DataWithScrollModifier,
  ScrollModifier,
  VirtuosoMessageList,
  VirtuosoMessageListLicense,
  VirtuosoMessageListMethods,
  VirtuosoMessageListProps,
} from '@virtuoso.dev/message-list';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SpinnerGapIcon } from '@phosphor-icons/react';

import NewDisplayConversationEntry from './NewDisplayConversationEntry';
import { ChatWorkSection } from './primitives/conversation';
import { ApprovalFormProvider } from '@/contexts/ApprovalFormContext';
import { useEntries } from '@/contexts/EntriesContext';
import {
  AddEntryType,
  PatchTypeWithKey,
  useConversationHistory,
} from '@/hooks/useConversationHistory';
import {
  detectWorkSections,
  type WorkSection,
} from '@/utils/workSectionDetection';
import { useUiPreferencesStore } from '@/stores/useUiPreferencesStore';
import type { TaskWithAttemptStatus } from 'shared/types';
import type { WorkspaceWithSession } from '@/types/attempt';

// Combined item type for the virtuoso list
type WorkSectionItem = {
  itemType: 'work-section';
  key: string;
  section: WorkSection;
  sectionIndex: number;
};

type EntryItemType = PatchTypeWithKey & {
  itemType: 'entry';
  sectionIndex: number | null;
};

type ConversationListItem = WorkSectionItem | EntryItemType;

interface ConversationListProps {
  attempt: WorkspaceWithSession;
  task?: TaskWithAttemptStatus;
}

interface MessageListContext {
  attempt: WorkspaceWithSession;
  task?: TaskWithAttemptStatus;
  isSectionExpanded: (sectionIndex: number) => boolean;
  toggleSection: (sectionIndex: number) => void;
}

const INITIAL_TOP_ITEM = { index: 'LAST' as const, align: 'end' as const };

const InitialDataScrollModifier: ScrollModifier = {
  type: 'item-location',
  location: INITIAL_TOP_ITEM,
  purgeItemSizes: true,
};

const AutoScrollToBottom: ScrollModifier = {
  type: 'auto-scroll-to-bottom',
  autoScroll: 'smooth',
};

const ScrollToTopOfLastItem: ScrollModifier = {
  type: 'item-location',
  location: {
    index: 'LAST',
    align: 'start',
  },
};

const ItemContent: VirtuosoMessageListProps<
  ConversationListItem,
  MessageListContext
>['ItemContent'] = ({ data, context }) => {
  const attempt = context?.attempt;
  const task = context?.task;
  const isSectionExpanded = context?.isSectionExpanded;
  const toggleSection = context?.toggleSection;

  // Render work section header
  if (data.itemType === 'work-section') {
    const expanded = isSectionExpanded?.(data.sectionIndex) ?? true;
    return (
      <div className="my-base px-double">
        <ChatWorkSection
          type={data.section.type}
          entryCount={data.section.entryCount}
          expanded={expanded}
          onToggle={() => toggleSection?.(data.sectionIndex)}
        />
      </div>
    );
  }

  // Skip entry if its section is collapsed
  if (data.sectionIndex !== null) {
    const expanded = isSectionExpanded?.(data.sectionIndex) ?? true;
    if (!expanded) {
      return null;
    }
  }

  // Render entry
  if (data.type === 'STDOUT') {
    return <p>{data.content}</p>;
  }
  if (data.type === 'STDERR') {
    return <p>{data.content}</p>;
  }
  if (data.type === 'NORMALIZED_ENTRY') {
    return (
      <NewDisplayConversationEntry
        expansionKey={data.patchKey}
        entry={data.content}
        executionProcessId={data.executionProcessId}
        taskAttempt={attempt}
        task={task}
      />
    );
  }

  return null;
};

const computeItemKey: VirtuosoMessageListProps<
  ConversationListItem,
  MessageListContext
>['computeItemKey'] = ({ data }) => {
  if (data.itemType === 'work-section') {
    return `section-${data.sectionIndex}-${data.section.type}`;
  }
  return `conv-${data.patchKey}`;
};

export function ConversationList({ attempt, task }: ConversationListProps) {
  const { t } = useTranslation('common');
  const [channelData, setChannelData] =
    useState<DataWithScrollModifier<ConversationListItem> | null>(null);
  const [rawEntries, setRawEntries] = useState<PatchTypeWithKey[]>([]);
  const [loading, setLoading] = useState(true);
  const { setEntries, reset } = useEntries();
  const pendingUpdateRef = useRef<{
    entries: PatchTypeWithKey[];
    addType: AddEntryType;
    loading: boolean;
  } | null>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Section expansion state from UI preferences store
  const expanded = useUiPreferencesStore((s) => s.expanded);
  const setExpanded = useUiPreferencesStore((s) => s.setExpanded);

  // Generate section key for persistence
  const getSectionKey = useCallback(
    (sectionIndex: number, sections: WorkSection[]) => {
      const section = sections[sectionIndex];
      if (!section) return '';
      return `work-section:${attempt.id}:${section.type}:${sectionIndex}`;
    },
    [attempt.id]
  );

  // Check if a section is expanded (default to true)
  const isSectionExpanded = useCallback(
    (sectionIndex: number) => {
      // Get sections from raw entries
      const sections = detectWorkSections(rawEntries);
      const key = getSectionKey(sectionIndex, sections);
      return expanded[key] ?? true;
    },
    [expanded, getSectionKey, rawEntries]
  );

  // Toggle section expansion
  const toggleSection = useCallback(
    (sectionIndex: number) => {
      const sections = detectWorkSections(rawEntries);
      const key = getSectionKey(sectionIndex, sections);
      const current = expanded[key] ?? true;
      setExpanded(key, !current);
    },
    [expanded, getSectionKey, setExpanded, rawEntries]
  );

  useEffect(() => {
    setLoading(true);
    setChannelData(null);
    setRawEntries([]);
    reset();
  }, [attempt.id, reset]);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Transform entries to include work sections
  const transformEntriesToItems = useCallback(
    (entries: PatchTypeWithKey[]): ConversationListItem[] => {
      const sections = detectWorkSections(entries);
      const result: ConversationListItem[] = [];

      // Create a map of entry index to section index
      const entryToSection = new Map<number, number>();
      sections.forEach((section, sectionIndex) => {
        for (let i = section.startIndex; i <= section.endIndex; i++) {
          entryToSection.set(i, sectionIndex);
        }
      });

      let currentSectionIndex = -1;

      entries.forEach((entry, entryIndex) => {
        const sectionIndex = entryToSection.get(entryIndex);

        // Check if we're entering a new section
        if (
          sectionIndex !== undefined &&
          sectionIndex !== currentSectionIndex
        ) {
          // Add section header
          const section = sections[sectionIndex];
          result.push({
            itemType: 'work-section',
            key: `section-${sectionIndex}-${section.type}`,
            section,
            sectionIndex,
          });
          currentSectionIndex = sectionIndex;
        }

        // Add entry with section reference
        result.push({
          ...entry,
          itemType: 'entry',
          sectionIndex: sectionIndex ?? null,
        });
      });

      return result;
    },
    []
  );

  const onEntriesUpdated = useCallback(
    (
      newEntries: PatchTypeWithKey[],
      addType: AddEntryType,
      newLoading: boolean
    ) => {
      pendingUpdateRef.current = {
        entries: newEntries,
        addType,
        loading: newLoading,
      };

      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(() => {
        const pending = pendingUpdateRef.current;
        if (!pending) return;

        let scrollModifier: ScrollModifier = InitialDataScrollModifier;

        if (pending.addType === 'plan' && !loading) {
          scrollModifier = ScrollToTopOfLastItem;
        } else if (pending.addType === 'running' && !loading) {
          scrollModifier = AutoScrollToBottom;
        }

        // Store raw entries and transform to items with sections
        setRawEntries(pending.entries);
        const items = transformEntriesToItems(pending.entries);
        setChannelData({ data: items, scrollModifier });
        setEntries(pending.entries);

        if (loading) {
          setLoading(pending.loading);
        }
      }, 100);
    },
    [loading, setEntries, transformEntriesToItems]
  );

  useConversationHistory({ attempt, onEntriesUpdated });

  const messageListRef = useRef<VirtuosoMessageListMethods | null>(null);
  const messageListContext = useMemo(
    () => ({ attempt, task, isSectionExpanded, toggleSection }),
    [attempt, task, isSectionExpanded, toggleSection]
  );

  return (
    <ApprovalFormProvider>
      <VirtuosoMessageListLicense
        licenseKey={import.meta.env.VITE_PUBLIC_REACT_VIRTUOSO_LICENSE_KEY}
      >
        <VirtuosoMessageList<ConversationListItem, MessageListContext>
          ref={messageListRef}
          className="h-full scrollbar-none"
          data={channelData}
          initialLocation={INITIAL_TOP_ITEM}
          context={messageListContext}
          computeItemKey={computeItemKey}
          ItemContent={ItemContent}
          Header={() => <div className="h-2" />}
          Footer={() => <div className="h-2" />}
        />
      </VirtuosoMessageListLicense>
      {loading && !channelData?.data?.length && (
        <div className="absolute inset-0 bg-primary flex flex-col gap-2 justify-center items-center">
          <SpinnerGapIcon className="h-8 w-8 animate-spin" />
          <p>{t('states.loadingHistory')}</p>
        </div>
      )}
    </ApprovalFormProvider>
  );
}

export default ConversationList;
