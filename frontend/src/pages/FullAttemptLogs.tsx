// VS Code webview integration - install keyboard/clipboard bridge
import '@/vscode/bridge';

import { useParams } from 'react-router-dom';
import { AppWithStyleOverride } from '@/utils/StyleOverride';
import { WebviewContextMenu } from '@/vscode/ContextMenu';
import { useTaskAttemptWithSession } from '@/hooks/useTaskAttempt';
import { useProjectTasks } from '@/hooks/useProjectTasks';
import { ExecutionProcessesProvider } from '@/contexts/ExecutionProcessesContext';
import { ReviewProvider } from '@/contexts/ReviewProvider';
import { ClickedElementsProvider } from '@/contexts/ClickedElementsProvider';
import { ChatContextProvider, ChatConversationList } from '@/components/chat';
import { SessionChatBoxContainer } from '@/components/ui-new/containers/SessionChatBoxContainer';

export function FullAttemptLogsPage() {
  const {
    projectId = '',
    taskId = '',
    attemptId = '',
  } = useParams<{
    projectId: string;
    taskId: string;
    attemptId: string;
  }>();

  const { data: attempt } = useTaskAttemptWithSession(attemptId);
  const { tasksById } = useProjectTasks(projectId);
  const task = taskId ? (tasksById[taskId] ?? null) : null;

  return (
    <AppWithStyleOverride>
      <div className="h-screen flex flex-col bg-muted">
        <WebviewContextMenu />

        <main className="flex-1 min-h-0">
          {attempt ? (
            <ClickedElementsProvider attempt={attempt}>
              <ReviewProvider key={attempt.id}>
                <ExecutionProcessesProvider
                  key={attempt.id}
                  attemptId={attempt.id}
                  sessionId={attempt.session?.id}
                >
                  <ChatContextProvider
                    attemptId={attempt.id}
                    sessionId={attempt.session?.id}
                  >
                    <div className="h-full min-h-0 flex flex-col">
                      <div className="flex-1 min-h-0 flex flex-col relative">
                        <ChatConversationList
                          attempt={attempt}
                          task={task ?? undefined}
                          className="h-full scrollbar-none"
                        />
                      </div>
                      <div className="min-h-0 max-h-[50%] border-t overflow-hidden">
                        <div className="mx-auto w-full max-w-[50rem] h-full min-h-0">
                          <SessionChatBoxContainer
                            session={attempt.session}
                            taskId={task?.id}
                            workspaceId={attempt.id}
                            projectId={projectId}
                            variant="compact"
                          />
                        </div>
                      </div>
                    </div>
                  </ChatContextProvider>
                </ExecutionProcessesProvider>
              </ReviewProvider>
            </ClickedElementsProvider>
          ) : (
            <div className="h-full min-h-0 flex items-center justify-center">
              <p className="text-muted-foreground">Loading attempt...</p>
            </div>
          )}
        </main>
      </div>
    </AppWithStyleOverride>
  );
}
