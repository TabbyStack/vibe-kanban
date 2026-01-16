import type { ActionType } from 'shared/types';
import type { PatchTypeWithKey } from '@/hooks/useConversationHistory';

export type WorkSectionType =
  | 'exploration'
  | 'planning'
  | 'implementation'
  | 'review'
  | 'testing'
  | 'debugging';

export interface WorkSection {
  type: WorkSectionType;
  startIndex: number;
  endIndex: number;
  entryCount: number;
}

interface SectionDetectionContext {
  hasReadFiles: boolean;
  hasSearched: boolean;
  hasWrittenFiles: boolean;
  hasPlanned: boolean;
  hasTodoList: boolean;
  hasRunTests: boolean;
  hasFixedErrors: boolean;
  consecutiveReads: number;
  consecutiveWrites: number;
}

/**
 * Analyzes an action type to determine what kind of work it represents
 */
function analyzeAction(actionType: ActionType): {
  isRead: boolean;
  isSearch: boolean;
  isWrite: boolean;
  isPlan: boolean;
  isTodo: boolean;
  isTest: boolean;
  isDebug: boolean;
} {
  const result = {
    isRead: false,
    isSearch: false,
    isWrite: false,
    isPlan: false,
    isTodo: false,
    isTest: false,
    isDebug: false,
  };

  switch (actionType.action) {
    case 'file_read':
      result.isRead = true;
      break;
    case 'search':
    case 'web_fetch':
      result.isSearch = true;
      break;
    case 'file_edit':
      result.isWrite = true;
      break;
    case 'plan_presentation':
      result.isPlan = true;
      break;
    case 'todo_management':
      result.isTodo = true;
      break;
    case 'command_run': {
      const cmd = actionType.command?.toLowerCase() || '';
      if (
        cmd.includes('test') ||
        cmd.includes('jest') ||
        cmd.includes('vitest') ||
        cmd.includes('pytest') ||
        cmd.includes('cargo test')
      ) {
        result.isTest = true;
      }
      // Check for build/type check commands that might indicate review phase
      if (
        cmd.includes('build') ||
        cmd.includes('tsc') ||
        cmd.includes('check') ||
        cmd.includes('lint')
      ) {
        result.isTest = true;
      }
      break;
    }
    case 'tool': {
      const toolName = actionType.tool_name?.toLowerCase() || '';
      if (toolName.includes('glob') || toolName.includes('grep')) {
        result.isSearch = true;
      }
      if (toolName.includes('read')) {
        result.isRead = true;
      }
      if (toolName.includes('write') || toolName.includes('edit')) {
        result.isWrite = true;
      }
      if (toolName.includes('plan')) {
        result.isPlan = true;
      }
      if (toolName.includes('todo')) {
        result.isTodo = true;
      }
      break;
    }
    case 'task_create':
      // Task creation is part of planning/organization
      result.isTodo = true;
      break;
    case 'other':
      // Unknown actions don't contribute to section detection
      break;
  }

  return result;
}

/**
 * Determines the likely work section type based on entry patterns
 */
function determineSectionType(
  context: SectionDetectionContext,
  actions: ReturnType<typeof analyzeAction>[]
): WorkSectionType {
  // Count action types in this batch
  const readCount = actions.filter((a) => a.isRead || a.isSearch).length;
  const writeCount = actions.filter((a) => a.isWrite).length;
  const planCount = actions.filter((a) => a.isPlan || a.isTodo).length;
  const testCount = actions.filter((a) => a.isTest).length;

  // Planning phase: has plan presentations or todo management
  if (planCount > 0 && writeCount === 0) {
    return 'planning';
  }

  // Testing/Review phase: running tests or checks after implementation
  if (testCount > 0 && context.hasWrittenFiles) {
    return 'review';
  }

  // Implementation phase: writing files
  if (writeCount > readCount && writeCount > 0) {
    return 'implementation';
  }

  // Exploration phase: mostly reading and searching
  if (readCount > writeCount || (!context.hasWrittenFiles && readCount > 0)) {
    return 'exploration';
  }

  // Default to exploration for unknown patterns
  return 'exploration';
}

/**
 * Detects work sections from a list of conversation entries.
 * Returns section boundaries that can be used to render collapsible groups.
 */
export function detectWorkSections(entries: PatchTypeWithKey[]): WorkSection[] {
  const sections: WorkSection[] = [];
  const normalizedEntries = entries.filter(
    (e) => e.type === 'NORMALIZED_ENTRY'
  ) as Array<PatchTypeWithKey & { type: 'NORMALIZED_ENTRY' }>;

  if (normalizedEntries.length === 0) {
    return sections;
  }

  const context: SectionDetectionContext = {
    hasReadFiles: false,
    hasSearched: false,
    hasWrittenFiles: false,
    hasPlanned: false,
    hasTodoList: false,
    hasRunTests: false,
    hasFixedErrors: false,
    consecutiveReads: 0,
    consecutiveWrites: 0,
  };

  let currentSectionStart = 0;
  let currentSectionType: WorkSectionType | null = null;
  const batchActions: ReturnType<typeof analyzeAction>[] = [];

  // Minimum entries before considering a section break
  const MIN_SECTION_SIZE = 3;
  // How many entries to look at for determining section type
  const LOOKAHEAD_WINDOW = 5;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Only analyze normalized entries for section detection
    if (entry.type !== 'NORMALIZED_ENTRY') {
      continue;
    }

    const entryType = entry.content.entry_type;

    // Skip non-tool entries for section analysis
    if (entryType.type !== 'tool_use') {
      // User messages can signal new sections (new prompts)
      if (
        entryType.type === 'user_message' &&
        i > 0 &&
        currentSectionType !== null
      ) {
        // Check if there's enough content in the current section
        const sectionSize = i - currentSectionStart;
        if (sectionSize >= MIN_SECTION_SIZE) {
          sections.push({
            type: currentSectionType,
            startIndex: currentSectionStart,
            endIndex: i - 1,
            entryCount: sectionSize,
          });
          currentSectionStart = i;
          currentSectionType = null;
          batchActions.length = 0;
        }
      }
      continue;
    }

    const action = analyzeAction(entryType.action_type);
    batchActions.push(action);

    // Update context
    if (action.isRead) {
      context.hasReadFiles = true;
      context.consecutiveReads++;
      context.consecutiveWrites = 0;
    }
    if (action.isSearch) {
      context.hasSearched = true;
    }
    if (action.isWrite) {
      context.hasWrittenFiles = true;
      context.consecutiveWrites++;
      context.consecutiveReads = 0;
    }
    if (action.isPlan) {
      context.hasPlanned = true;
    }
    if (action.isTodo) {
      context.hasTodoList = true;
    }
    if (action.isTest) {
      context.hasRunTests = true;
    }

    // Determine section type when we have enough data
    if (
      batchActions.length >= LOOKAHEAD_WINDOW ||
      currentSectionType === null
    ) {
      const detectedType = determineSectionType(context, batchActions);

      // Check for section transition
      if (currentSectionType === null) {
        currentSectionType = detectedType;
      } else if (detectedType !== currentSectionType) {
        // Validate transition makes sense
        const validTransition = isValidTransition(
          currentSectionType,
          detectedType
        );
        if (validTransition) {
          const sectionSize = i - currentSectionStart;
          if (sectionSize >= MIN_SECTION_SIZE) {
            sections.push({
              type: currentSectionType,
              startIndex: currentSectionStart,
              endIndex: i - 1,
              entryCount: sectionSize,
            });
            currentSectionStart = i;
            currentSectionType = detectedType;
            batchActions.length = 0;
          }
        }
      }
    }
  }

  // Add final section if it has content
  if (currentSectionType !== null) {
    const sectionSize = entries.length - currentSectionStart;
    if (sectionSize >= MIN_SECTION_SIZE) {
      sections.push({
        type: currentSectionType,
        startIndex: currentSectionStart,
        endIndex: entries.length - 1,
        entryCount: sectionSize,
      });
    }
  }

  return sections;
}

/**
 * Validates if a section transition makes logical sense
 */
function isValidTransition(
  from: WorkSectionType,
  to: WorkSectionType
): boolean {
  // Define valid workflow transitions
  const validTransitions: Record<WorkSectionType, WorkSectionType[]> = {
    exploration: ['planning', 'implementation', 'debugging'],
    planning: ['implementation', 'exploration'],
    implementation: ['review', 'testing', 'debugging', 'exploration'],
    review: ['implementation', 'debugging', 'exploration'],
    testing: ['implementation', 'debugging', 'review'],
    debugging: ['implementation', 'testing', 'exploration'],
  };

  return validTransitions[from]?.includes(to) ?? false;
}

/**
 * Gets a human-readable label for a work section type
 */
export function getSectionLabel(type: WorkSectionType): string {
  const labels: Record<WorkSectionType, string> = {
    exploration: 'Exploration',
    planning: 'Planning',
    implementation: 'Implementation',
    review: 'Review',
    testing: 'Testing',
    debugging: 'Debugging',
  };
  return labels[type];
}

/**
 * Gets an icon name for a work section type
 */
export function getSectionIcon(type: WorkSectionType): string {
  const icons: Record<WorkSectionType, string> = {
    exploration: 'MagnifyingGlass',
    planning: 'ListChecks',
    implementation: 'Code',
    review: 'CheckCircle',
    testing: 'TestTube',
    debugging: 'Bug',
  };
  return icons[type];
}
