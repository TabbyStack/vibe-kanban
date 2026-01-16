import { ReactNode, useMemo } from 'react';
import { ApprovalFeedbackProvider } from '@/contexts/ApprovalFeedbackContext';
import { EntriesProvider } from '@/contexts/EntriesContext';
import { MessageEditProvider } from '@/contexts/MessageEditContext';
import { RetryUiProvider } from '@/contexts/RetryUiContext';

export interface ChatContextProviderProps {
  /** Workspace/attempt ID used for context keys */
  attemptId: string;
  /** Optional session ID for additional context scoping */
  sessionId?: string;
  /** Child components to wrap with providers */
  children: ReactNode;
}

/**
 * Unified context provider that wraps chat components with all necessary
 * providers in the correct nesting order.
 *
 * Provider hierarchy:
 * 1. ApprovalFeedbackProvider - Manages approval request/feedback state
 * 2. EntriesProvider - Manages conversation entries state
 * 3. MessageEditProvider - Manages message edit state (depends on EntriesProvider)
 * 4. RetryUiProvider - Manages retry UI state (depends on ExecutionProcessesContext)
 *
 * This ensures consistent behavior across both slide-over and full-screen views.
 */
export function ChatContextProvider({
  attemptId,
  sessionId,
  children,
}: ChatContextProviderProps) {
  // Create a stable key based on attempt and session
  const contextKey = useMemo(
    () => (sessionId ? `${attemptId}-${sessionId}` : attemptId),
    [attemptId, sessionId]
  );

  return (
    <ApprovalFeedbackProvider>
      <EntriesProvider key={contextKey}>
        <MessageEditProvider>
          <RetryUiProvider attemptId={attemptId}>{children}</RetryUiProvider>
        </MessageEditProvider>
      </EntriesProvider>
    </ApprovalFeedbackProvider>
  );
}

export default ChatContextProvider;
