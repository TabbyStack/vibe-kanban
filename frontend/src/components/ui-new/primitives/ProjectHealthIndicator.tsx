import { useMemo } from 'react';
import {
  WarningIcon,
  ClockIcon,
  XCircleIcon,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Tooltip } from './Tooltip';
import type { TaskWithAttemptStatus } from 'shared/types';

export type HealthStatus = 'healthy' | 'warning' | 'critical';

export interface ProjectHealthInfo {
  status: HealthStatus;
  failedCount: number;
  staleCount: number;
  ciFailingCount: number;
  message: string;
}

interface ProjectHealthIndicatorProps {
  tasksByStatus: Record<string, TaskWithAttemptStatus[]>;
  className?: string;
}

const STALE_THRESHOLD_DAYS = 7;

function isTaskStale(task: TaskWithAttemptStatus): boolean {
  const updatedAt = new Date(task.updated_at);
  const now = new Date();
  const diffDays = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
  return task.status === 'inprogress' && diffDays > STALE_THRESHOLD_DAYS;
}

export function calculateProjectHealth(
  tasksByStatus: Record<string, TaskWithAttemptStatus[]>
): ProjectHealthInfo {
  const allTasks = Object.values(tasksByStatus).flat();

  const failedCount = allTasks.filter((t) => t.last_attempt_failed).length;
  const staleCount = allTasks.filter(isTaskStale).length;
  const ciFailingCount = allTasks.filter((t) => t.ci_status === 'failing').length;

  const issues: string[] = [];

  if (failedCount > 0) {
    issues.push(`${failedCount} failed task${failedCount > 1 ? 's' : ''}`);
  }
  if (staleCount > 0) {
    issues.push(`${staleCount} stale task${staleCount > 1 ? 's' : ''}`);
  }
  if (ciFailingCount > 0) {
    issues.push(`${ciFailingCount} failing CI${ciFailingCount > 1 ? ' checks' : ''}`);
  }

  let status: HealthStatus = 'healthy';
  if (failedCount > 0 || ciFailingCount > 0) {
    status = 'critical';
  } else if (staleCount > 0) {
    status = 'warning';
  }

  const message = issues.length > 0 ? issues.join(', ') : 'All tasks healthy';

  return {
    status,
    failedCount,
    staleCount,
    ciFailingCount,
    message,
  };
}

export function ProjectHealthIndicator({
  tasksByStatus,
  className,
}: ProjectHealthIndicatorProps) {
  const health = useMemo(
    () => calculateProjectHealth(tasksByStatus),
    [tasksByStatus]
  );

  if (health.status === 'healthy') {
    return null;
  }

  const Icon = health.status === 'critical' ? XCircleIcon :
               health.staleCount > 0 ? ClockIcon : WarningIcon;

  const colorClass = health.status === 'critical'
    ? 'text-error'
    : 'text-warning';

  return (
    <Tooltip content={health.message} side="right">
      <div className={cn('flex items-center', className)}>
        <Icon
          weight="fill"
          className={cn('size-icon-xs shrink-0', colorClass)}
        />
      </div>
    </Tooltip>
  );
}
