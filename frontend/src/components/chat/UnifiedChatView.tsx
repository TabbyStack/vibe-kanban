import type { Session, TaskWithAttemptStatus } from 'shared/types';
import type { WorkspaceWithSession } from '@/types/attempt';
import { ChatContextProvider } from './ChatContextProvider';
import { ChatConversationList } from './ChatConversationList';
import {
  SessionChatBoxContainer,
  type ChatBoxVariant,
} from '@/components/ui-new/containers/SessionChatBoxContainer';

export interface DiffStats {
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
}

export type ChatViewMode = 'slide-over' | 'full-screen';

export interface UnifiedChatViewProps {
  /** The workspace/attempt to display */
  attempt: WorkspaceWithSession;
  /** Optional task context */
  task?: TaskWithAttemptStatus;
  /** View mode: slide-over (compact) or full-screen */
  mode: ChatViewMode;
  /** Project ID for file search typeahead */
  projectId?: string;
  /** Callback to navigate to full-screen view (slide-over mode only) */
  onNavigateToFullScreen?: () => void;

  // Full-screen specific props
  /** Available sessions for this workspace (full-screen mode) */
  sessions?: Session[];
  /** Called when a session is selected (full-screen mode) */
  onSelectSession?: (sessionId: string) => void;
  /** Whether user is creating a new session (full-screen mode) */
  isNewSessionMode?: boolean;
  /** Callback to start new session mode (full-screen mode) */
  onStartNewSession?: () => void;
  /** Diff statistics from the workspace */
  diffStats?: DiffStats;
  /** Callback to view code changes (toggle ChangesPanel) */
  onViewCode?: () => void;

  // Render props for additional content
  /** Render additional content above the chat input (e.g., TodoPanel, StickyNextActionCard) */
  renderAboveInput?: () => React.ReactNode;
}

/**
 * UnifiedChatView - A unified chat interface component that works in both
 * slide-over panel and full-screen workspace views.
 *
 * Features:
 * - Consistent provider nesting via ChatContextProvider
 * - Uses ChatConversationList for virtualized message display
 * - Uses SessionChatBoxContainer for full-featured chat input
 * - Adapts layout based on mode (compact for slide-over, full for full-screen)
 *
 * Usage:
 * ```tsx
 * // Slide-over mode
 * <UnifiedChatView
 *   attempt={attempt}
 *   task={task}
 *   mode="slide-over"
 *   renderAboveInput={() => (
 *     <>
 *       <StickyNextActionCard attempt={attempt} task={task} />
 *       <TodoPanel />
 *     </>
 *   )}
 * />
 *
 * // Full-screen mode
 * <UnifiedChatView
 *   attempt={attempt}
 *   mode="full-screen"
 *   sessions={sessions}
 *   onSelectSession={handleSelectSession}
 *   diffStats={diffStats}
 *   onViewCode={handleViewCode}
 * />
 * ```
 */
export function UnifiedChatView({
  attempt,
  task,
  mode,
  projectId,
  sessions = [],
  onSelectSession,
  isNewSessionMode = false,
  onStartNewSession,
  diffStats,
  onViewCode,
  renderAboveInput,
}: UnifiedChatViewProps) {
  const { session } = attempt;
  const chatBoxVariant: ChatBoxVariant = mode === 'slide-over' ? 'compact' : 'full';

  return (
    <ChatContextProvider
      attemptId={attempt.id}
      sessionId={session?.id}
    >
      <div className="flex flex-col h-full min-h-0 overflow-hidden">
        {/* Chat area: use absolute positioning for reliable height */}
        <div className="flex-1 min-h-0 relative">
          <div className="absolute inset-0 flex justify-center overflow-hidden">
            <div className={mode === 'full-screen' ? 'w-chat max-w-full h-full' : 'w-full h-full'}>
              <ChatConversationList
                attempt={attempt}
                task={task}
                className="h-full scrollbar-none"
              />
            </div>
          </div>
        </div>

        {/* Footer: pinned with shrink-0 */}
        {renderAboveInput && (
          <div className="shrink-0">
            {renderAboveInput()}
          </div>
        )}

        {/* Chat input */}
        <div className={mode === 'full-screen' ? 'shrink-0 flex justify-center @container pl-px' : 'shrink-0'}>
          <SessionChatBoxContainer
            session={session}
            taskId={task?.id}
            sessions={sessions}
            onSelectSession={onSelectSession}
            filesChanged={diffStats?.filesChanged}
            linesAdded={diffStats?.linesAdded}
            linesRemoved={diffStats?.linesRemoved}
            onViewCode={onViewCode}
            projectId={projectId}
            isNewSessionMode={isNewSessionMode}
            onStartNewSession={onStartNewSession}
            workspaceId={attempt.id}
            variant={chatBoxVariant}
          />
        </div>
      </div>
    </ChatContextProvider>
  );
}

export default UnifiedChatView;
