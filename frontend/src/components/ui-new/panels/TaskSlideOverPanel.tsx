import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowSquareOutIcon } from '@phosphor-icons/react';
import { SlideOverPanel } from './SlideOverPanel';
import { TaskDetailsPanel } from '@/components/ui-new/containers/TaskDetailsPanel';
import { useTask } from '@/hooks/useTask';
import { useProjects } from '@/hooks/useProjects';

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

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setExpanded(false);
  }, [onOpenChange]);

  const handleOpenFullPage = useCallback(() => {
    navigate(`/projects/${projectId}/tasks/${taskId}`);
    handleClose();
  }, [navigate, projectId, taskId, handleClose]);

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

  return (
    <SlideOverPanel
      open={open}
      onOpenChange={onOpenChange}
      expanded={expanded}
      onExpandedChange={setExpanded}
      title={title}
    >
      <TaskDetailsPanel
        projectId={projectId}
        taskId={taskId}
        onClose={handleClose}
        hideHeader
      />
    </SlideOverPanel>
  );
}
