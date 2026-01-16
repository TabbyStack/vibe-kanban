import { TaskStatus } from 'shared/types';

export const statusLabels: Record<TaskStatus, string> = {
  todo: 'To Do',
  inprogress: 'In Progress',
  inreview: 'In Review',
  done: 'Done',
  cancelled: 'Cancelled',
};

export const statusBoardColors: Record<TaskStatus, string> = {
  todo: '--neutral-foreground',
  inprogress: '--info',
  inreview: '--warning',
  done: '--success',
  cancelled: '--destructive',
};

// Subtle background tints for status columns (using HSL with low opacity)
export const statusColumnBgColors: Record<TaskStatus, string> = {
  todo: 'hsl(var(--neutral-foreground) / 0.03)',
  inprogress: 'hsl(var(--info) / 0.05)',
  inreview: 'hsl(var(--warning) / 0.05)',
  done: 'hsl(var(--success) / 0.05)',
  cancelled: 'hsl(var(--destructive) / 0.03)',
};

// Status group types for organized board view
export type StatusGroupId = 'backlog' | 'active' | 'review' | 'closed';

export interface StatusGroup {
  id: StatusGroupId;
  label: string;
  statuses: TaskStatus[];
  color: string;
  bgColor: string;
}

export const STATUS_GROUPS: StatusGroup[] = [
  {
    id: 'backlog',
    label: 'Backlog',
    statuses: ['todo'],
    color: '--neutral-foreground',
    bgColor: 'hsl(var(--neutral-foreground) / 0.03)',
  },
  {
    id: 'active',
    label: 'Active',
    statuses: ['inprogress'],
    color: '--info',
    bgColor: 'hsl(var(--info) / 0.05)',
  },
  {
    id: 'review',
    label: 'Review',
    statuses: ['inreview'],
    color: '--warning',
    bgColor: 'hsl(var(--warning) / 0.05)',
  },
  {
    id: 'closed',
    label: 'Closed',
    statuses: ['done', 'cancelled'],
    color: '--success',
    bgColor: 'hsl(var(--success) / 0.03)',
  },
];

// Map from status to its parent group
export const statusToGroup: Record<TaskStatus, StatusGroupId> = {
  todo: 'backlog',
  inprogress: 'active',
  inreview: 'review',
  done: 'closed',
  cancelled: 'closed',
};

// Get the status group for a given status
export function getStatusGroup(status: TaskStatus): StatusGroup {
  const groupId = statusToGroup[status];
  return STATUS_GROUPS.find((g) => g.id === groupId)!;
}

// Check if two statuses are in the same group
export function isSameStatusGroup(
  status1: TaskStatus,
  status2: TaskStatus
): boolean {
  return statusToGroup[status1] === statusToGroup[status2];
}
