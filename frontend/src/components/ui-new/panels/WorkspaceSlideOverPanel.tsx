import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowSquareOutIcon } from '@phosphor-icons/react';
import { SlideOverPanel } from './SlideOverPanel';
import { WorkspacesMain } from '@/components/ui-new/views/WorkspacesMain';
import { useAttempt } from '@/hooks';
import { useWorkspaceSessions } from '@/hooks/useWorkspaceSessions';
import { useDiffSummary } from '@/hooks/useDiffSummary';
import { useAttemptRepo } from '@/hooks/useAttemptRepo';
import type { WorkspaceWithSession } from '@/types/attempt';

export interface WorkspaceSlideOverPanelProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkspaceSlideOverPanel({
  workspaceId,
  open,
  onOpenChange,
}: WorkspaceSlideOverPanelProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLElement | null>(null);

  // Fetch workspace data
  const { data: workspace, isLoading: isWorkspaceLoading } =
    useAttempt(workspaceId);
  const { sessions, isLoading: isSessionsLoading, selectedSession } =
    useWorkspaceSessions(workspaceId);
  const { repos } = useAttemptRepo(workspaceId);

  // Get diff stats
  const { fileCount, added, deleted } = useDiffSummary(workspaceId);

  // Build workspace with session object
  const workspaceWithSession: WorkspaceWithSession | undefined =
    workspace && selectedSession
      ? {
          ...workspace,
          session: selectedSession,
        }
      : workspace
        ? { ...workspace, session: undefined }
        : undefined;

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setExpanded(false);
  }, [onOpenChange]);

  const handleSelectSession = useCallback((sessionId: string) => {
    // For now, just log - could be enhanced to switch sessions
    console.log('Select session:', sessionId);
  }, []);

  const handleOpenFullPage = useCallback(() => {
    navigate(`/workspaces/${workspaceId}`);
    handleClose();
  }, [navigate, workspaceId, handleClose]);

  const isLoading = isWorkspaceLoading || isSessionsLoading;

  return (
    <SlideOverPanel
      open={open}
      onOpenChange={onOpenChange}
      expanded={expanded}
      onExpandedChange={setExpanded}
      title={
        <div className="flex items-center gap-2">
          <span className="truncate">{workspace?.name || 'Workspace'}</span>
          <button
            onClick={handleOpenFullPage}
            className="flex items-center justify-center w-6 h-6 rounded hover:bg-secondary text-low hover:text-normal transition-colors"
            title="Open in full page"
          >
            <ArrowSquareOutIcon className="size-icon-xs" />
          </button>
        </div>
      }
    >
      <div className="h-full flex flex-col">
        {/* Workspace info bar */}
        <div className="shrink-0 px-4 py-2 border-b border-panel/40 bg-secondary/50">
          <div className="flex items-center gap-3 text-sm">
            {workspace?.branch && (
              <span className="text-low">
                Branch: <span className="text-normal">{workspace.branch}</span>
              </span>
            )}
            {repos.length > 0 && (
              <span className="text-low">
                Repo:{' '}
                <span className="text-normal">{repos[0].display_name}</span>
              </span>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-h-0">
          <WorkspacesMain
            workspaceWithSession={workspaceWithSession}
            sessions={sessions}
            onSelectSession={handleSelectSession}
            isLoading={isLoading}
            containerRef={containerRef}
            diffStats={
              fileCount > 0
                ? {
                    filesChanged: fileCount,
                    linesAdded: added,
                    linesRemoved: deleted,
                  }
                : undefined
            }
          />
        </div>
      </div>
    </SlideOverPanel>
  );
}
