import { useCallback, useState } from 'react';
import { SlideOverPanel } from './SlideOverPanel';
import { TaskDetailsPanel } from '@/components/ui-new/containers/TaskDetailsPanel';

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
  const [expanded, setExpanded] = useState(false);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    // Reset expanded state when closing
    setExpanded(false);
  }, [onOpenChange]);

  return (
    <SlideOverPanel
      open={open}
      onOpenChange={onOpenChange}
      expanded={expanded}
      onExpandedChange={setExpanded}
      width={expanded ? 'xl' : 'lg'}
    >
      <TaskDetailsPanel
        projectId={projectId}
        taskId={taskId}
        onClose={handleClose}
      />
    </SlideOverPanel>
  );
}
