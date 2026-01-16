import { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { AnimatePresence, motion } from 'framer-motion';
import { CaretRightIcon, CaretDownIcon } from '@phosphor-icons/react';
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
import {
  statusLabels,
  statusBoardColors,
  STATUS_GROUPS,
  isSameStatusGroup,
  type StatusGroup,
} from '@/utils/statusLabels';
import { usePersistedExpanded } from '@/stores/useUiPreferencesStore';
import type { PersistKey } from '@/stores/useUiPreferencesStore';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/dialogs/shared/ConfirmDialog';

const STATUS_ORDER: TaskStatus[] = [
  'todo',
  'inprogress',
  'inreview',
  'done',
  'cancelled',
];

// Substatus section within a status group cell
interface SubstatusSectionProps {
  status: TaskStatus;
  tasks: TaskWithAttemptStatus[];
  isExpanded: boolean;
  onToggle: () => void;
  projectId: string;
  selectedTaskId: string | null;
  onTaskClick: (projectId: string, taskId: string) => void;
  onTaskStatusChange: (
    taskId: string,
    newStatus: TaskStatus,
    task: TaskWithAttemptStatus
  ) => void;
  isLoading: boolean;
  showHeader: boolean; // Only show header if group has multiple statuses
}

function SubstatusSection({
  status,
  tasks,
  isExpanded,
  onToggle,
  projectId,
  selectedTaskId,
  onTaskClick,
  onTaskStatusChange,
  isLoading,
  showHeader,
}: SubstatusSectionProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { type: 'status', status },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative',
        'transition-all duration-200 ease-out',
        isOver && 'bg-brand/10 rounded-md'
      )}
    >
      {/* Drop zone visual indicator */}
      {isOver && (
        <div
          className={cn(
            'absolute inset-0.5 rounded-md',
            'border-2 border-dashed border-brand/40',
            'bg-brand/5',
            'pointer-events-none',
            'animate-scale-in',
            'z-10'
          )}
        />
      )}

      {/* Substatus header - only show if parent group has multiple statuses */}
      {showHeader && (
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'w-full flex items-center gap-1.5 px-1.5 py-1',
            'text-left',
            'hover:bg-panel/20 rounded-sm',
            'transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30'
          )}
        >
          <CaretDownIcon
            weight="fill"
            className={cn(
              'size-icon-xs text-low/50',
              'transition-transform duration-150',
              !isExpanded && '-rotate-90'
            )}
          />
          <span
            className="size-dot rounded-full shrink-0"
            style={{
              backgroundColor: `hsl(var(${statusBoardColors[status]}))`,
            }}
          />
          <span className="text-[10px] text-low/70 font-medium">
            {statusLabels[status]}
          </span>
          <span className="text-[9px] text-low/50 tabular-nums">
            {tasks.length}
          </span>
        </button>
      )}

      {/* Tasks list */}
      <AnimatePresence initial={false}>
        {(isExpanded || !showHeader) && (
          <motion.div
            initial={showHeader ? { opacity: 0, height: 0 } : false}
            animate={{ opacity: 1, height: 'auto' }}
            exit={showHeader ? { opacity: 0, height: 0 } : undefined}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="relative"
          >
            <div className={cn('flex flex-col gap-1.5', showHeader && 'pt-1')}>
              {isLoading ? (
                <div className="skeleton h-12 w-full rounded-md" />
              ) : tasks.length === 0 ? (
                <div className="min-h-[24px]" /> // Minimum height for empty drop zone
              ) : (
                tasks.map((task) => (
                  <SwimlaneTaskCard
                    key={task.id}
                    task={task}
                    projectId={projectId}
                    isSelected={selectedTaskId === task.id}
                    onClick={() => onTaskClick(projectId, task.id)}
                    onStatusChange={(newStatus) =>
                      onTaskStatusChange(task.id, newStatus, task)
                    }
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Status group cell containing one or more substatus sections
interface StatusGroupCellProps {
  group: StatusGroup;
  tasksByStatus: Record<TaskStatus, TaskWithAttemptStatus[]>;
  projectId: string;
  selectedTaskId: string | null;
  onTaskClick: (projectId: string, taskId: string) => void;
  onTaskStatusChange: (
    taskId: string,
    newStatus: TaskStatus,
    task: TaskWithAttemptStatus
  ) => void;
  isLoading: boolean;
  collapsedSubstatuses: Set<TaskStatus>;
  onToggleSubstatus: (status: TaskStatus) => void;
}

function StatusGroupCell({
  group,
  tasksByStatus,
  projectId,
  selectedTaskId,
  onTaskClick,
  onTaskStatusChange,
  isLoading,
  collapsedSubstatuses,
  onToggleSubstatus,
}: StatusGroupCellProps) {
  const hasMultipleStatuses = group.statuses.length > 1;

  return (
    <div
      className={cn(
        'relative px-2 py-2 border-l border-panel/30 first:border-l-0 min-h-[64px]',
        'transition-all duration-200 ease-out'
      )}
      style={{ backgroundColor: group.bgColor }}
    >
      <div className="flex flex-col gap-2">
        {group.statuses.map((status) => (
          <SubstatusSection
            key={status}
            status={status}
            tasks={tasksByStatus[status]}
            isExpanded={!collapsedSubstatuses.has(status)}
            onToggle={() => onToggleSubstatus(status)}
            projectId={projectId}
            selectedTaskId={selectedTaskId}
            onTaskClick={onTaskClick}
            onTaskStatusChange={onTaskStatusChange}
            isLoading={isLoading}
            showHeader={hasMultipleStatuses}
          />
        ))}
      </div>
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

  // Track collapsed substatus sections (for groups with multiple statuses)
  const [collapsedSubstatuses, setCollapsedSubstatuses] = useState<
    Set<TaskStatus>
  >(new Set());

  // Pending status change for cross-group confirmation
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    taskId: string;
    newStatus: TaskStatus;
    task: TaskWithAttemptStatus;
  } | null>(null);

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

  const handleToggleSubstatus = useCallback((status: TaskStatus) => {
    setCollapsedSubstatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
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

      // Check if moving between different status groups
      if (!isSameStatusGroup(task.status, newStatus)) {
        // Show confirmation dialog for cross-group moves
        setPendingStatusChange({ taskId, newStatus, task });
      } else {
        // Same group - allow without confirmation
        onStatusChange(taskId, newStatus, task);
      }
    },
    [tasksByStatus, onStatusChange]
  );

  // Handler for status changes from dropdown (goes through same confirmation logic)
  const handleTaskStatusChange = useCallback(
    (taskId: string, newStatus: TaskStatus, task: TaskWithAttemptStatus) => {
      if (task.status === newStatus) return;

      // Check if moving between different status groups
      if (!isSameStatusGroup(task.status, newStatus)) {
        // Show confirmation dialog for cross-group moves
        setPendingStatusChange({ taskId, newStatus, task });
      } else {
        // Same group - allow without confirmation
        onStatusChange(taskId, newStatus, task);
      }
    },
    [onStatusChange]
  );

  const handleConfirmStatusChange = useCallback(async () => {
    if (!pendingStatusChange) return;

    const result = await ConfirmDialog.show({
      title: 'Change workflow stage?',
      message: `Moving this task from "${statusLabels[pendingStatusChange.task.status]}" to "${statusLabels[pendingStatusChange.newStatus]}" will change its workflow stage. Do you want to continue?`,
      confirmText: 'Move task',
      cancelText: 'Cancel',
      variant: 'info',
    });

    if (result === 'confirmed') {
      onStatusChange(
        pendingStatusChange.taskId,
        pendingStatusChange.newStatus,
        pendingStatusChange.task
      );
    }

    setPendingStatusChange(null);
  }, [pendingStatusChange, onStatusChange]);

  // Trigger confirmation dialog when pending change is set
  useMemo(() => {
    if (pendingStatusChange) {
      handleConfirmStatusChange();
    }
  }, [pendingStatusChange, handleConfirmStatusChange]);

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
            <div className="flex items-center sticky left-0 top-[114px] z-[12] bg-primary">
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

            {/* Status group columns grid - animated expand/collapse */}
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

                    {/* Status group columns - grid for equal widths */}
                    <div
                      className="grid grid-cols-4 flex-1"
                      style={{ minWidth: '700px' }}
                    >
                      {STATUS_GROUPS.map((group) => (
                        <StatusGroupCell
                          key={group.id}
                          group={group}
                          tasksByStatus={filteredTasksByStatus}
                          projectId={project.id}
                          selectedTaskId={selectedTaskId}
                          onTaskClick={onTaskClick}
                          onTaskStatusChange={handleTaskStatusChange}
                          isLoading={isLoading}
                          collapsedSubstatuses={collapsedSubstatuses}
                          onToggleSubstatus={handleToggleSubstatus}
                        />
                      ))}
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
