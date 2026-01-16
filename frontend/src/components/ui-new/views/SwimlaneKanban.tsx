import { useMemo } from 'react';
import {
  CaretDownIcon,
  ArrowsOutIcon,
  ArrowsInIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  DotsThreeIcon,
  SidebarSimpleIcon,
  FolderIcon,
  LightningIcon,
  EyeIcon,
  XIcon,
} from '@phosphor-icons/react';
import { ActionPanelContainer } from '@/components/ui-new/containers/ActionPanelContainer';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { GroupedProjects } from '@/hooks/useAllBoards';
import type {
  Project,
  ProjectGroup,
  TaskStatus,
  TaskWithAttemptStatus,
} from 'shared/types';
import {
  statusLabels,
  statusBoardColors,
  STATUS_GROUPS,
  type StatusGroup,
} from '@/utils/statusLabels';
import { ProjectSwimlane } from '@/components/ui-new/containers/ProjectSwimlane';
import { InlineGroupCreator } from '@/components/ui-new/primitives/InlineGroupCreator';
import {
  FilterDisplayControls,
  type FilterState,
  type DisplayState,
} from '@/components/ui-new/primitives/FilterDisplayControls';
import {
  useAggregateTaskCountsProvider,
  useAggregateTaskCounts,
} from '@/hooks/useAggregateTaskCounts';
import type { SidebarWorkspace } from '@/components/ui-new/hooks/useWorkspaces';
import { EmptyState } from '@/components/ui-new/primitives/EmptyState';
import { SwimlaneRowSkeleton } from '@/components/ui-new/primitives/Skeleton';


// Status Group Header - displays the main column header for a status group
function StatusGroupHeader({ group }: { group: StatusGroup }) {
  const { counts, isLoading } = useAggregateTaskCounts();

  // Sum counts for all statuses in this group
  const totalCount = group.statuses.reduce(
    (sum, status) => sum + (counts[status] || 0),
    0
  );

  return (
    <div
      className={cn(
        'group/col flex items-center gap-2',
        'py-2.5 px-3',
        'border-l border-panel/30 first:border-l-0',
        'transition-colors duration-150'
      )}
      style={{ backgroundColor: group.bgColor }}
    >
      <span
        className="h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-white/10"
        style={{ backgroundColor: `hsl(var(${group.color}))` }}
      />
      <span className="text-xs text-normal font-semibold uppercase tracking-wide">
        {group.label}
      </span>
      <span
        className={cn(
          'text-[10px] tabular-nums px-1.5 py-0.5 rounded-sm',
          'bg-panel/20 text-low/70',
          'transition-colors duration-150'
        )}
      >
        {isLoading ? '—' : totalCount}
      </span>
      {/* Show substatus breakdown if group has multiple statuses */}
      {group.statuses.length > 1 && !isLoading && (
        <div className="flex items-center gap-1 ml-1">
          {group.statuses.map((status) => (
            <span
              key={status}
              className="text-[9px] text-low/50 flex items-center gap-0.5"
              title={statusLabels[status]}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: `hsl(var(${statusBoardColors[status]}))`,
                }}
              />
              <span className="tabular-nums">{counts[status] || 0}</span>
            </span>
          ))}
        </div>
      )}
      <div
        className={cn(
          'flex items-center gap-1 ml-auto',
          'opacity-0 group-hover/col:opacity-100',
          'transition-opacity duration-150'
        )}
      >
        <button
          type="button"
          className={cn(
            'icon-btn',
            'p-1 rounded-sm',
            'text-low/60 hover:text-normal',
            'hover:bg-panel/40',
            'transition-all duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30'
          )}
          title="Column options"
        >
          <DotsThreeIcon weight="bold" className="size-3.5" />
        </button>
        <button
          type="button"
          className={cn(
            'icon-btn',
            'p-1 rounded-sm',
            'text-low/60 hover:text-normal',
            'hover:bg-panel/40',
            'transition-all duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30'
          )}
          title="Add task"
        >
          <PlusIcon className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

interface SwimlaneKanbanProps {
  groupedProjects: GroupedProjects[];
  groups: ProjectGroup[];
  expandedGroups: Set<string>;
  onToggleGroup: (groupId: string | null) => void;
  onExpandOnly: (groupId: string | null) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isLoading: boolean;
  selectedTaskId: string | null;
  onTaskClick: (projectId: string, taskId: string) => void;
  onCreateTask: (projectId: string, status?: TaskStatus) => void;
  onMoveToGroup: (projectId: string, groupId: string | null) => void;
  onOpenBoard: (projectId: string) => void;
  onCreateGroup: () => void;
  onStatusChange: (
    taskId: string,
    newStatus: TaskStatus,
    task: TaskWithAttemptStatus
  ) => void;
  // Inline group creation props
  isCreatingGroup: boolean;
  newGroupName: string;
  onNewGroupNameChange: (value: string) => void;
  onSubmitCreateGroup: () => void;
  onCancelCreateGroup: () => void;
  // Left sidebar props
  isLeftSidebarVisible?: boolean;
  onToggleLeftSidebar?: () => void;
  // Filter and display props
  filterState: FilterState;
  onFilterChange: (filter: FilterState) => void;
  displayState: DisplayState;
  onDisplayChange: (display: DisplayState) => void;
  // Workspace data for filtering
  workspaces?: SidebarWorkspace[];
  // Filter dropdown data
  projects?: Project[];
  activeWorkspaceCount?: number;
  inReviewCount?: number;
}

export function SwimlaneKanban(props: SwimlaneKanbanProps) {
  const { Provider, value } = useAggregateTaskCountsProvider();

  return (
    <Provider value={value}>
      <SwimlaneKanbanContent {...props} />
    </Provider>
  );
}

function SwimlaneKanbanContent({
  groupedProjects,
  groups,
  expandedGroups,
  onToggleGroup,
  onExpandOnly,
  onExpandAll,
  onCollapseAll,
  searchQuery,
  onSearchChange,
  isLoading,
  selectedTaskId,
  onTaskClick,
  onCreateTask,
  onMoveToGroup,
  onOpenBoard,
  onCreateGroup,
  onStatusChange,
  isCreatingGroup,
  newGroupName,
  onNewGroupNameChange,
  onSubmitCreateGroup,
  onCancelCreateGroup,
  isLeftSidebarVisible,
  onToggleLeftSidebar,
  filterState,
  onFilterChange,
  displayState,
  onDisplayChange,
  workspaces = [],
  projects = [],
  activeWorkspaceCount = 0,
  inReviewCount = 0,
}: SwimlaneKanbanProps) {
  // Compute allowed task IDs based on workspace filter
  const allowedTaskIds = useMemo(() => {
    if (filterState.workspaceFilter === 'all') {
      return undefined; // No workspace filter - show all tasks
    }

    const taskIds = new Set<string>();
    for (const ws of workspaces) {
      if (filterState.workspaceFilter === 'active' && ws.isRunning) {
        taskIds.add(ws.taskId);
      } else if (
        filterState.workspaceFilter === 'in-review' &&
        ws.prStatus === 'open'
      ) {
        taskIds.add(ws.taskId);
      }
    }
    return taskIds;
  }, [workspaces, filterState.workspaceFilter]);

  // Filter projects by search query and selected project
  const filteredGroupedProjects = useMemo(() => {
    let result = groupedProjects;

    // Filter by selected project ID
    if (filterState.selectedProjectId) {
      result = result
        .map(({ group, projects }) => ({
          group,
          projects: projects.filter(
            (p) => p.id === filterState.selectedProjectId
          ),
        }))
        .filter(({ projects }) => projects.length > 0);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result
        .map(({ group, projects }) => ({
          group,
          projects: projects.filter((p) =>
            p.name.toLowerCase().includes(query)
          ),
        }))
        .filter(({ projects }) => projects.length > 0);
    }

    return result;
  }, [groupedProjects, searchQuery, filterState.selectedProjectId]);

  if (isLoading) {
    return (
      <div className="h-full flex-1 overflow-hidden bg-primary">
        {/* Skeleton header */}
        <div
          className={cn(
            'sticky top-0 z-20',
            'flex items-center gap-3 px-3 py-2',
            'bg-primary/95 backdrop-blur-sm',
            'border-b border-panel/30'
          )}
        >
          <div className="skeleton h-7 w-48 rounded-md" />
          <div className="flex items-center gap-2 ml-auto">
            <div className="skeleton h-6 w-16 rounded-sm" />
            <div className="skeleton h-6 w-20 rounded-sm" />
          </div>
        </div>
        {/* Skeleton status group header */}
        <div
          className={cn(
            'sticky top-[40px] z-10',
            'grid grid-cols-[180px_repeat(4,minmax(140px,1fr))]',
            'bg-primary/98 backdrop-blur-sm',
            'border-b border-panel/40'
          )}
        >
          <div className="py-2 px-3" />
          {STATUS_GROUPS.map((group) => (
            <div
              key={group.id}
              className="py-2 px-3 border-l border-panel/30 flex items-center gap-2"
            >
              <div className="skeleton size-2.5 rounded-full" />
              <div className="skeleton h-3 w-20 rounded-sm" />
            </div>
          ))}
        </div>
        {/* Skeleton rows */}
        <div className="pb-8">
          {[...Array(4)].map((_, i) => (
            <SwimlaneRowSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  const allGroupsExpanded = filteredGroupedProjects.every(({ group }) =>
    expandedGroups.has(group?.id ?? 'ungrouped')
  );

  return (
    <div className="h-full flex-1 overflow-auto bg-primary">
      {/* Header with search and controls */}
      <div
        className={cn(
          'sticky top-0 z-20',
          'flex items-center gap-2 px-4 py-2',
          'bg-primary/95 backdrop-blur-sm',
          'border-b border-panel/20',
          'shadow-sm shadow-black/[0.02]'
        )}
      >
        {/* Sidebar toggle button - only show when sidebar is hidden */}
        {!isLeftSidebarVisible && onToggleLeftSidebar && (
          <button
            type="button"
            onClick={onToggleLeftSidebar}
            className={cn(
              'icon-btn p-1.5 rounded-md',
              'text-low hover:text-normal',
              'hover:bg-panel/40',
              'transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30'
            )}
            title="Show sidebar"
          >
            <SidebarSimpleIcon className="size-4" />
          </button>
        )}

        {/* Search input - Enhanced with keyboard shortcut hint */}
        <div
          className={cn(
            'group/search relative flex-1 max-w-xs',
            'flex items-center gap-2',
            'bg-secondary/40 hover:bg-secondary/60 rounded-lg',
            'border border-panel/10 hover:border-panel/20',
            'px-3 py-1.5',
            'focus-within:border-brand/40 focus-within:bg-secondary/70',
            'focus-within:ring-2 focus-within:ring-brand/10',
            'transition-all duration-150'
          )}
        >
          <MagnifyingGlassIcon className="size-3.5 text-low/40 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search boards..."
            className={cn(
              'flex-1 bg-transparent min-w-0',
              'text-xs text-normal',
              'placeholder:text-low/40',
              'focus:outline-none'
            )}
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="p-0.5 rounded text-low/40 hover:text-low hover:bg-panel/30 transition-colors"
            >
              <XIcon className="size-3" />
            </button>
          ) : (
            <kbd className="hidden group-hover/search:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-low/40 bg-panel/20 rounded border border-panel/10">
              <span className="text-[9px]">⌘</span>K
            </kbd>
          )}
        </div>

        {/* Quick Filters - Directly accessible common filters */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              onFilterChange({
                ...filterState,
                workspaceFilter:
                  filterState.workspaceFilter === 'active' ? 'all' : 'active',
              })
            }
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md',
              'text-xs font-medium',
              'transition-all duration-150',
              filterState.workspaceFilter === 'active'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'text-low/70 hover:text-normal hover:bg-secondary/60 border border-transparent'
            )}
            title="Show only tasks with active sessions"
          >
            <LightningIcon
              weight={
                filterState.workspaceFilter === 'active' ? 'fill' : 'regular'
              }
              className="size-3.5"
            />
            <span>Active</span>
            {activeWorkspaceCount > 0 && (
              <span
                className={cn(
                  'px-1 py-0.5 text-[10px] rounded tabular-nums',
                  filterState.workspaceFilter === 'active'
                    ? 'bg-amber-500/20'
                    : 'bg-panel/30 text-low/60'
                )}
              >
                {activeWorkspaceCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              onFilterChange({
                ...filterState,
                workspaceFilter:
                  filterState.workspaceFilter === 'in-review'
                    ? 'all'
                    : 'in-review',
              })
            }
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md',
              'text-xs font-medium',
              'transition-all duration-150',
              filterState.workspaceFilter === 'in-review'
                ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                : 'text-low/70 hover:text-normal hover:bg-secondary/60 border border-transparent'
            )}
            title="Show only tasks awaiting review"
          >
            <EyeIcon
              weight={
                filterState.workspaceFilter === 'in-review' ? 'fill' : 'regular'
              }
              className="size-3.5"
            />
            <span>Review</span>
            {inReviewCount > 0 && (
              <span
                className={cn(
                  'px-1 py-0.5 text-[10px] rounded tabular-nums',
                  filterState.workspaceFilter === 'in-review'
                    ? 'bg-purple-500/20'
                    : 'bg-panel/30 text-low/60'
                )}
              >
                {inReviewCount}
              </span>
            )}
          </button>
        </div>

        {/* Active Filter Chips - Show applied filters */}
        {(filterState.selectedProjectId ||
          filterState.hideEmptyProjects ||
          filterState.statuses.length > 0) && (
          <div className="flex items-center gap-1">
            {filterState.selectedProjectId && (
              <button
                type="button"
                onClick={() =>
                  onFilterChange({ ...filterState, selectedProjectId: null })
                }
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded-full',
                  'text-[11px] font-medium',
                  'bg-brand/10 text-brand border border-brand/20',
                  'hover:bg-brand/15 hover:border-brand/30',
                  'transition-all duration-150'
                )}
              >
                <span className="truncate max-w-[100px]">
                  {projects.find((p) => p.id === filterState.selectedProjectId)
                    ?.name ?? 'Project'}
                </span>
                <XIcon className="size-3 shrink-0" />
              </button>
            )}
            {filterState.hideEmptyProjects && (
              <button
                type="button"
                onClick={() =>
                  onFilterChange({ ...filterState, hideEmptyProjects: false })
                }
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded-full',
                  'text-[11px] font-medium',
                  'bg-brand/10 text-brand border border-brand/20',
                  'hover:bg-brand/15 hover:border-brand/30',
                  'transition-all duration-150'
                )}
              >
                <span>Hide empty</span>
                <XIcon className="size-3 shrink-0" />
              </button>
            )}
            {filterState.statuses.length > 0 &&
              filterState.statuses.length < 5 && (
                <button
                  type="button"
                  onClick={() =>
                    onFilterChange({ ...filterState, statuses: [] })
                  }
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full',
                    'text-[11px] font-medium',
                    'bg-brand/10 text-brand border border-brand/20',
                    'hover:bg-brand/15 hover:border-brand/30',
                    'transition-all duration-150'
                  )}
                >
                  <span>{filterState.statuses.length} status</span>
                  <XIcon className="size-3 shrink-0" />
                </button>
              )}
          </div>
        )}

        {/* Separator */}
        <div className="h-4 w-px bg-panel/20" />

        {/* Filter and Display controls */}
        <FilterDisplayControls
          filterState={filterState}
          displayState={displayState}
          onFilterChange={onFilterChange}
          onDisplayChange={onDisplayChange}
          projects={projects}
          activeWorkspaceCount={activeWorkspaceCount}
          inReviewCount={inReviewCount}
        />

        {/* Separator */}
        <div className="h-4 w-px bg-panel/20" />

        {/* Action Panel for bulk operations */}
        <ActionPanelContainer />

        {/* Spacer to push actions to the right */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCreateGroup}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md',
              'text-xs text-low/70 font-medium',
              'hover:text-normal hover:bg-secondary/60',
              'transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30'
            )}
          >
            <PlusIcon className="size-3.5" />
            <span>New Group</span>
          </button>
          <button
            type="button"
            onClick={allGroupsExpanded ? onCollapseAll : onExpandAll}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md',
              'text-xs text-low/70 font-medium',
              'hover:text-normal hover:bg-secondary/60',
              'transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30'
            )}
          >
            {allGroupsExpanded ? (
              <>
                <ArrowsInIcon className="size-3.5" />
                <span>Collapse</span>
              </>
            ) : (
              <>
                <ArrowsOutIcon className="size-3.5" />
                <span>Expand</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Single sticky status group header */}
      <div
        className={cn(
          'sticky top-[44px] z-[20]',
          'flex',
          'min-w-[880px]',
          'bg-primary'
        )}
      >
        {/* Empty first cell - sticky on horizontal scroll to align with project names */}
        <div className="w-[180px] shrink-0 py-2 px-3 sticky left-0 z-10 bg-primary" />
        {/* Status group column headers */}
        <div className="grid grid-cols-4 flex-1" style={{ minWidth: '700px' }}>
          {STATUS_GROUPS.map((group) => (
            <StatusGroupHeader key={group.id} group={group} />
          ))}
        </div>
      </div>

      {/* Groups and swimlanes */}
      <div className="pb-8">
        {/* Inline group creator */}
        <InlineGroupCreator
          isCreating={isCreatingGroup}
          value={newGroupName}
          onChange={onNewGroupNameChange}
          onSubmit={onSubmitCreateGroup}
          onCancel={onCancelCreateGroup}
        />

        {filteredGroupedProjects.length === 0 && !isCreatingGroup ? (
          <EmptyState
            variant={searchQuery ? 'no-search-results' : 'no-boards'}
            action={
              !searchQuery
                ? {
                    label: 'Create your first board',
                    onClick: onCreateGroup,
                  }
                : undefined
            }
          />
        ) : (
          filteredGroupedProjects.map(({ group, projects }) => {
            const groupKey = group?.id ?? 'ungrouped';
            const isGroupExpanded = expandedGroups.has(groupKey);

            return (
              <div
                key={groupKey}
                className="border-b border-panel/15 last:border-b-0"
              >
                {/* Group header */}
                <div
                  className={cn(
                    'group/header flex items-center justify-between',
                    'px-3 py-2',
                    'bg-primary',
                    'border-b border-panel/15',
                    'hover:bg-secondary/30',
                    'transition-colors duration-150',
                    'sticky top-[80px] z-[15]'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onToggleGroup(group?.id ?? null)}
                    className={cn(
                      'flex items-center gap-2 flex-1 text-left group',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-1',
                      'rounded-sm'
                    )}
                  >
                    <CaretDownIcon
                      weight="fill"
                      className={cn(
                        'size-3 text-low/50',
                        'transition-transform duration-200 ease-out',
                        !isGroupExpanded && '-rotate-90'
                      )}
                    />
                    <FolderIcon
                      weight="duotone"
                      className="size-3.5 text-low/60"
                    />
                    <span
                      className={cn(
                        'text-[11px] font-semibold uppercase tracking-wide',
                        'text-low/80 group-hover:text-normal',
                        'transition-colors duration-150'
                      )}
                    >
                      {group?.name ?? 'Ungrouped'}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] tabular-nums px-1.5 py-0.5 rounded-sm',
                        'bg-panel/20 text-low/60'
                      )}
                    >
                      {projects.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onExpandOnly(group?.id ?? null)}
                    className={cn(
                      'px-2 py-1 rounded-md',
                      'text-[10px] font-medium text-low/50',
                      'hover:text-normal hover:bg-panel/30',
                      'opacity-0 group-hover/header:opacity-100',
                      'transition-all duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30'
                    )}
                    title="Focus on this group"
                  >
                    Focus
                  </button>
                </div>

                {/* Swimlane table */}
                <AnimatePresence initial={false}>
                  {isGroupExpanded && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                    >
                      {/* Project rows */}
                      {projects.length === 0 ? (
                        <EmptyState variant="no-group-items" size="sm" />
                      ) : (
                        projects.map((project) => (
                          <ProjectSwimlane
                            key={project.id}
                            project={project}
                            groupId={group?.id ?? null}
                            groups={groups}
                            selectedTaskId={selectedTaskId}
                            onTaskClick={onTaskClick}
                            onCreateTask={onCreateTask}
                            onMoveToGroup={onMoveToGroup}
                            onOpenBoard={onOpenBoard}
                            onStatusChange={onStatusChange}
                            filterState={filterState}
                            allowedTaskIds={allowedTaskIds}
                          />
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
