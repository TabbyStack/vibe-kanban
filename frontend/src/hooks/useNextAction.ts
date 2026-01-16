import { useMemo } from 'react';
import type { NormalizedEntry } from 'shared/types';
import type { PatchTypeWithKey } from '@/hooks/useConversationHistory';

export interface NextActionData {
  failed: boolean;
  execution_processes: number;
  needs_setup?: boolean;
}

interface UseNextActionResult {
  nextAction: NextActionData | null;
  hasNextAction: boolean;
}

/**
 * Hook that extracts the latest next_action entry from normalized conversation entries.
 * Returns the most recent next_action data for displaying in the sticky Summary & Actions section.
 */
export const useNextAction = (
  entries: PatchTypeWithKey[]
): UseNextActionResult => {
  return useMemo(() => {
    let latestNextAction: NextActionData | null = null;

    // Iterate through entries to find the most recent next_action
    for (const entry of entries) {
      if (entry.type === 'NORMALIZED_ENTRY' && entry.content) {
        const normalizedEntry = entry.content as NormalizedEntry;

        if (normalizedEntry.entry_type?.type === 'next_action') {
          const entryType = normalizedEntry.entry_type as {
            type: 'next_action';
            failed: boolean;
            execution_processes: number;
            needs_setup?: boolean;
          };

          latestNextAction = {
            failed: entryType.failed,
            execution_processes: entryType.execution_processes,
            needs_setup: entryType.needs_setup,
          };
        }
      }
    }

    return {
      nextAction: latestNextAction,
      hasNextAction: latestNextAction !== null,
    };
  }, [entries]);
};
