import { useCallback, useMemo } from 'react';
import {
  DndContext,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { AnimatePresence, motion } from 'framer-motion';
import { CaretRightIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useBoardTasksOverview } from '@/hooks/useBoardTasksOverview';
import { useRegisterProjectCounts } from '@/hooks/useAggregateTaskCounts';
import { SwimlaneTaskCard } from '@/components/ui-new/primitives/SwimlaneTaskCard';
import { ProjectHealthIndicator } from '@/components/ui-new/primitives/ProjectHealthIndicator';
import { ProjectBoardHeader } from '@/components/ui-new/primitives/ProjectBoardHeader';
import { ProjectProviderOverride } from '@/contexts/ProjectProviderOverride';
import type {
  Project,
  ProjectGroup,
  TaskStatus,
  TaskWithAttemptStatus,
} from 'shared/types';
import type { FilterState } from '@/components/ui-new/primitives/FilterDisplayControls';
import { statusColumnBgColors } from '@/utils/statusLabels';
import { usePersistedExpanded } from '@/stores/useUiPreferencesStore';
import type { PersistKey } from '@/stores/useUiPreferencesStore';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';

const STATUS_ORDER: TaskStatus[] = [
  'todo',
  'inprogress',
  'inreview',
  'done',
  'cancelled',
];

interface StatusCellProps {
  status: TaskStatus;
  children: React.ReactNode;
}

function StatusCell({ status, children }: StatusCellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { type: 'status', status },
  });

  const hasChildren = Array.isArray(children)
    ? children.some(Boolean)
    : Boolean(children);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'group/cell relative px-2 py-2 border-l border-panel/30 min-h-[64px]',
        'transition-all duration-200 ease-out',
        // Drop target indicator
        isOver && 'bg-brand/10 border-l-brand/40',
        // Empty state subtle indicator on hover
        !hasChildren && !isOver && 'hover:bg-panel/8'
      )}
      style={
        !isOver ? { backgroundColor: statusColumnBgColors[status] } : undefined
      }
    >
      {/* Drop zone visual indicator */}
      {isOver && (
        <div
          className={cn(
            'absolute inset-1.5 rounded-md',
            'border-2 border-dashed border-brand/40',
            'bg-brand/5',
            'pointer-events-none',
            'animate-scale-in'
          )}
        />
      )}
      <div className="relative flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

interface ProjectSwimlaneProps {
  project: Project;
  groupId: string | null;
  groups: ProjectGroup[];
  selectedTaskId: string | null;
  onTaskClick: (projectId: string, taskId: string) => void;
  onCreateTask: (projectId: string, status?: TaskStatus) => void;
  onMoveToGroup?: (projectId: string, groupId: string | null) => void;
  onOpenBoard?: (projectId: string) => void;
  onStatusChange: (
    taskId: string,
    newStatus: TaskStatus,
    task: TaskWithAttemptStatus
  ) => void;
  filterState?: FilterState;
  /** If set, only show tasks with IDs in this set (for workspace-based filtering) */
  allowedTaskIds?: Set<string>;
}

export function ProjectSwimlane({
  project,
  groupId,
  groups,
  selectedTaskId,
  onTaskClick,
  onCreateTask,
  onMoveToGroup,
  onOpenBoard,
  onStatusChange,
  filterState,
  allowedTaskIds,
}: ProjectSwimlaneProps) {
  const { tasksByStatus, totalCount, isLoading, error } = useBoardTasksOverview(
    project.id
  );

  // Persisted expand/collapse state for this project (expanded by default)
  const persistKey: PersistKey = `project-expanded:${project.id}`;
  const [isExpanded, setExpanded] = usePersistedExpanded(persistKey, true);

  // Register task counts with the aggregate context for column header totals
  useRegisterProjectCounts(project.id, tasksByStatus, isLoading);

  // Apply status filter and workspace filter to tasks
  const filteredTasksByStatus = useMemo(() => {
    const filtered: typeof tasksByStatus = {
      todo: [],
      inprogress: [],
      inreview: [],
      done: [],
      cancelled: [],
    };

    for (const status of STATUS_ORDER) {
      // Skip statuses not in filter (if filter is set)
      if (
        filterState &&
        filterState.statuses.length > 0 &&
        !filterState.statuses.includes(status)
      ) {
        continue;
      }

      let tasks = tasksByStatus[status];

      // Apply workspace-based task filter
      if (allowedTaskIds) {
        tasks = tasks.filter((task) => allowedTaskIds.has(task.id));
      }

      filtered[status] = tasks;
    }

    return filtered;
  }, [tasksByStatus, filterState, allowedTaskIds]);

  // Calculate filtered total count
  const filteredTotalCount = useMemo(() => {
    // If we have any filter applied, count from filtered tasks
    if (allowedTaskIds || (filterState && filterState.statuses.length > 0)) {
      return Object.values(filteredTasksByStatus).reduce(
        (sum, tasks) => sum + tasks.length,
        0
      );
    }
    return totalCount;
  }, [filteredTasksByStatus, filterState, allowedTaskIds, totalCount]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const taskId = active.id as string;
      const newStatus = over.id as TaskStatus;

      // Find the task
      const task = STATUS_ORDER.reduce(
        (found, status) => {
          if (found) return found;
          return tasksByStatus[status].find((t) => t.id === taskId);
        },
        undefined as (typeof tasksByStatus)['todo'][0] | undefined
      );

      if (!task || task.status === newStatus) return;

      onStatusChange(taskId, newStatus, task);
    },
    [tasksByStatus, onStatusChange]
  );

  if (error) {
    return (
      <div className="border-b border-panel/15">
        {/* Project header */}
        <ProjectBoardHeader
          project={project}
          taskCount={0}
          isLoading={false}
          groupId={groupId}
          groups={groups}
          onCreateTask={onCreateTask}
          onMoveToGroup={onMoveToGroup}
          onOpenBoard={onOpenBoard}
        />
        {/* Error state */}
        <div className="px-4 py-3 text-sm text-error bg-error/5">
          Failed to load tasks for this project
        </div>
      </div>
    );
  }

  return (
    <ProjectProviderOverride projectId={project.id}>
      <TooltipProvider>
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="border-b border-panel/15">
            {/* Project header with collapse toggle - sticky on both horizontal and vertical scroll */}
            <div className="flex items-center sticky left-0 top-[80px] z-[15] bg-primary">
              {/* Collapse toggle button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setExpanded()}
                    className={cn(
                      'p-2 shrink-0',
                      'text-low/60 hover:text-normal',
                      'hover:bg-panel/30',
                      'transition-all duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30'
                    )}
                  >
                    <CaretRightIcon
                      weight="bold"
                      className={cn(
                        'size-icon-xs transition-transform duration-150',
                        isExpanded && 'rotate-90'
                      )}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {isExpanded ? 'Collapse project' : 'Expand project'}
                </TooltipContent>
              </Tooltip>

              {/* Project board header - Linear-style */}
              <div className="flex-1 flex items-center gap-2">
                <ProjectBoardHeader
                  project={project}
                  taskCount={filteredTotalCount}
                  isLoading={isLoading}
                  groupId={groupId}
                  groups={groups}
                  onCreateTask={onCreateTask}
                  onMoveToGroup={onMoveToGroup}
                  onOpenBoard={onOpenBoard}
                />
                {!isLoading && (
                  <ProjectHealthIndicator tasksByStatus={tasksByStatus} />
                )}
              </div>
            </div>

            {/* Status columns grid - animated expand/collapse */}
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                >
                  <div
                    className={cn(
                      'flex min-w-[880px]',
                      'transition-all duration-150 ease-out'
                    )}
                  >
                    {/* Empty spacer cell to align with the swimlane header - sticky */}
                    <div className="w-[180px] shrink-0 px-3 py-2 sticky left-0 z-10 bg-primary" />

                    {/* Status columns - grid for equal widths */}
                    <div
                      className="grid grid-cols-5 flex-1"
                      style={{ minWidth: '700px' }}
                    >
                      {STATUS_ORDER.map((status) => {
                        const tasks = filteredTasksByStatus[status];

                        return (
                          <StatusCell key={status} status={status}>
                            {isLoading ? (
                              <div className="flex flex-col gap-1.5">
                                <div className="skeleton h-12 w-full rounded-md" />
                              </div>
                            ) : tasks.length === 0 ? null : (
                              tasks.map((task) => (
                                <SwimlaneTaskCard
                                  key={task.id}
                                  task={task}
                                  projectId={project.id}
                                  isSelected={selectedTaskId === task.id}
                                  onClick={() =>
                                    onTaskClick(project.id, task.id)
                                  }
                                />
                              ))
                            )}
                          </StatusCell>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DndContext>
      </TooltipProvider>
    </ProjectProviderOverride>
  );
}
