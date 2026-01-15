import {
  MagnifyingGlassIcon,
  ListChecksIcon,
  CodeIcon,
  CheckCircleIcon,
  TestTubeIcon,
  BugIcon,
  CaretDownIcon,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { WorkSectionType } from '@/utils/workSectionDetection';

interface ChatWorkSectionProps {
  type: WorkSectionType;
  entryCount: number;
  expanded: boolean;
  onToggle: () => void;
  className?: string;
}

const sectionConfig: Record<
  WorkSectionType,
  {
    label: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  exploration: {
    label: 'Exploration',
    icon: MagnifyingGlassIcon,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  planning: {
    label: 'Planning',
    icon: ListChecksIcon,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  implementation: {
    label: 'Implementation',
    icon: CodeIcon,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-200 dark:border-green-800',
  },
  review: {
    label: 'Review',
    icon: CheckCircleIcon,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  testing: {
    label: 'Testing',
    icon: TestTubeIcon,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-50 dark:bg-cyan-950/30',
    borderColor: 'border-cyan-200 dark:border-cyan-800',
  },
  debugging: {
    label: 'Debugging',
    icon: BugIcon,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800',
  },
};

export function ChatWorkSection({
  type,
  entryCount,
  expanded,
  onToggle,
  className,
}: ChatWorkSectionProps) {
  const config = sectionConfig[type];
  const Icon = config.icon;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'w-full flex items-center gap-base px-double py-base',
        'border rounded-sm cursor-pointer',
        'transition-colors hover:opacity-80',
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      <Icon className={cn('size-icon-base shrink-0', config.color)} />
      <span className={cn('text-sm font-medium', config.color)}>
        {config.label}
      </span>
      <span className="text-xs text-low ml-auto">
        {entryCount} {entryCount === 1 ? 'item' : 'items'}
      </span>
      <CaretDownIcon
        className={cn(
          'size-icon-xs shrink-0 text-low transition-transform',
          !expanded && '-rotate-90'
        )}
      />
    </button>
  );
}
