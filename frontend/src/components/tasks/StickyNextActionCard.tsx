import { useEntries } from '@/contexts/EntriesContext';
import { useNextAction } from '@/hooks/useNextAction';
import { NextActionCard } from '@/components/NormalizedConversation/NextActionCard';
import type { TaskWithAttemptStatus } from 'shared/types';
import type { WorkspaceWithSession } from '@/types/attempt';

interface StickyNextActionCardProps {
  attempt: WorkspaceWithSession | undefined;
  task: TaskWithAttemptStatus | null;
}

/**
 * Sticky wrapper for NextActionCard that extracts next_action data from entries context.
 * Renders at the bottom of the chat, above TodoPanel.
 */
export function StickyNextActionCard({ attempt, task }: StickyNextActionCardProps) {
  const { entries } = useEntries();
  const { nextAction, hasNextAction } = useNextAction(entries);

  if (!hasNextAction || !nextAction || !attempt) {
    return null;
  }

  return (
    <NextActionCard
      attemptId={attempt.id}
      sessionId={attempt.session?.id}
      containerRef={attempt.container_ref}
      failed={nextAction.failed}
      execution_processes={nextAction.execution_processes}
      task={task ?? undefined}
      needsSetup={nextAction.needs_setup}
    />
  );
}
