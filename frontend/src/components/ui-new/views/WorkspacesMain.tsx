import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { Session } from 'shared/types';
import type { WorkspaceWithSession } from '@/types/attempt';
import { ContextBarContainer } from '@/components/ui-new/containers/ContextBarContainer';
import { UnifiedChatView, type DiffStats } from '@/components/chat';

interface WorkspacesMainProps {
  workspaceWithSession: WorkspaceWithSession | undefined;
  sessions: Session[];
  onSelectSession: (sessionId: string) => void;
  isLoading: boolean;
  containerRef: RefObject<HTMLElement | null>;
  projectId?: string;
  onViewCode?: () => void;
  /** Whether user is creating a new session */
  isNewSessionMode?: boolean;
  /** Callback to start new session mode */
  onStartNewSession?: () => void;
  /** Diff statistics from the workspace */
  diffStats?: DiffStats;
}

export function WorkspacesMain({
  workspaceWithSession,
  sessions,
  onSelectSession,
  isLoading,
  containerRef,
  projectId,
  onViewCode,
  isNewSessionMode,
  onStartNewSession,
  diffStats,
}: WorkspacesMainProps) {
  const { t } = useTranslation(['tasks', 'common']);

  return (
    <main
      ref={containerRef as React.RefObject<HTMLElement>}
      className="relative flex flex-1 flex-col bg-primary h-full"
    >
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-low">{t('common:workspaces.loading')}</p>
        </div>
      ) : !workspaceWithSession ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-low">{t('common:workspaces.selectToStart')}</p>
        </div>
      ) : (
        <UnifiedChatView
          attempt={workspaceWithSession}
          mode="full-screen"
          projectId={projectId}
          sessions={sessions}
          onSelectSession={onSelectSession}
          isNewSessionMode={isNewSessionMode}
          onStartNewSession={onStartNewSession}
          diffStats={diffStats}
          onViewCode={onViewCode}
        />
      )}
      {/* Context Bar - floating toolbar */}
      {workspaceWithSession && (
        <ContextBarContainer containerRef={containerRef} />
      )}
    </main>
  );
}
