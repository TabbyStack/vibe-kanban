import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowSquareOutIcon } from '@phosphor-icons/react';
import { SlideOverPanel } from './SlideOverPanel';
import { TaskDetailsPanel } from '@/components/ui-new/containers/TaskDetailsPanel';
import { useTask } from '@/hooks/useTask';
import { useProjects } from '@/hooks/useProjects';
import { useTaskAttempts } from '@/hooks/useTaskAttempts';
import { useTaskAttemptWithSession } from '@/hooks/useTaskAttempt';
import { ExecutionProcessesProvider } from '@/contexts/ExecutionProcessesContext';

export interface TaskSlideOverPanelProps {
  projectId: string;
  taskId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskSlideOverPanel({
  projectId,
  taskId,
  open,
  onOpenChange,
}: TaskSlideOverPanelProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  // Fetch task and project data for context
  const { data: task } = useTask(taskId);
  const { projectsById } = useProjects();
  const project = projectsById[projectId];

  // Fetch attempts to get the latest one - match WorkspacesLayout pattern
  const { data: attempts = [] } = useTaskAttempts(taskId, {
    enabled: !!taskId && open,
  });

  // Get the latest attempt ID
  const latestAttemptId = useMemo(() => {
    if (!attempts?.length) return undefined;
    return [...attempts].sort((a, b) => {
      const diff =
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    })[0].id;
  }, [attempts]);

  // Fetch the attempt with session
  const { data: attemptWithSession } = useTaskAttemptWithSession(
    latestAttemptId
  );

  // Get stable IDs for provider key - only set when data is ready
  const attemptId = attemptWithSession?.id;
  const sessionId = attemptWithSession?.session?.id;

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setExpanded(false);
  }, [onOpenChange]);

  const handleOpenFullPage = useCallback(() => {
    if (attemptId) {
      // Navigate directly without calling handleClose - we're leaving the page
      // so no need to update the URL search params (which would interfere with navigation)
      navigate(`/workspaces/${attemptId}`);
    }
  }, [navigate, attemptId]);

  // Build title with context breadcrumb
  const title = (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-sm min-w-0">
        {project && (
          <>
            <span className="text-low truncate">{project.name}</span>
            <span className="text-low">/</span>
          </>
        )}
        <span className="text-high font-medium truncate">
          {task?.title || 'Task'}
        </span>
      </div>
      <button
        onClick={handleOpenFullPage}
        className="flex items-center justify-center w-6 h-6 rounded hover:bg-secondary text-low hover:text-normal transition-colors"
        title="Open in full page"
      >
        <ArrowSquareOutIcon className="size-icon-xs" />
      </button>
    </div>
  );

  // Content to render inside the panel
  // Pass attemptWithSession to ensure TaskDetailsPanel uses the same session
  // as the ExecutionProcessesProvider (avoids session mismatch)
  const panelContent = (
    <TaskDetailsPanel
      projectId={projectId}
      taskId={taskId}
      onClose={handleClose}
      hideHeader
      preloadedAttempt={attemptWithSession}
    />
  );

  return (
    <SlideOverPanel
      open={open}
      onOpenChange={onOpenChange}
      expanded={expanded}
      onExpandedChange={setExpanded}
      title={title}
    >
      {/* Only render content when session data is ready to avoid using wrong ExecutionProcessesContext */}
      {attemptId && sessionId ? (
        <ExecutionProcessesProvider
          key={`${attemptId}-${sessionId}`}
          attemptId={attemptId}
          sessionId={sessionId}
        >
          {panelContent}
        </ExecutionProcessesProvider>
      ) : (
        <div className="flex items-center justify-center h-full text-low">
          Loading...
        </div>
      )}
    </SlideOverPanel>
  );
}
