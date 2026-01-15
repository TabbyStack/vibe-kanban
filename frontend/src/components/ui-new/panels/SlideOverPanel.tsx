import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useHotkeysContext } from 'react-hotkeys-hook';
import {
  ArrowsInSimpleIcon,
  ArrowsOutSimpleIcon,
  XIcon,
} from '@phosphor-icons/react';

import { cn } from '@/lib/utils';
import { useKeyExit, useKeyToggleExpand, Scope } from '@/keyboard';
import { usePaneSize, PERSIST_KEYS } from '@/stores/useUiPreferencesStore';

const MIN_WIDTH = 360;
const MAX_WIDTH = 900;
const DEFAULT_WIDTH = 480;

export interface SlideOverPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const transition = {
  duration: 0.25,
  ease: [0.2, 0, 0, 1] as const,
};

export function SlideOverPanel({
  open,
  onOpenChange,
  expanded = false,
  onExpandedChange,
  title,
  children,
  className,
}: SlideOverPanelProps) {
  const { enableScope, disableScope } = useHotkeysContext();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = React.useState(false);

  // Persist panel width
  const [persistedWidth, setPersistedWidth] = usePaneSize(
    PERSIST_KEYS.slideOverPanelWidth,
    DEFAULT_WIDTH
  );
  const [width, setWidth] = React.useState(Number(persistedWidth));

  // Sync with persisted value on mount
  React.useEffect(() => {
    setWidth(Number(persistedWidth));
  }, [persistedWidth]);

  // Manage keyboard scope when open/closed
  React.useEffect(() => {
    if (open) {
      enableScope(Scope.SLIDE_PANEL);
      disableScope(Scope.KANBAN);
      disableScope(Scope.PROJECTS);
    } else {
      disableScope(Scope.SLIDE_PANEL);
      enableScope(Scope.KANBAN);
      enableScope(Scope.PROJECTS);
    }
    return () => {
      disableScope(Scope.SLIDE_PANEL);
      enableScope(Scope.KANBAN);
      enableScope(Scope.PROJECTS);
    };
  }, [open, enableScope, disableScope]);

  // Esc key handling: collapse if expanded, close if not
  useKeyExit(
    (e) => {
      // Two-step Esc behavior for inputs
      const activeElement = document.activeElement as HTMLElement;
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable)
      ) {
        activeElement.blur();
        e?.preventDefault();
        return;
      }

      // If expanded, collapse first
      if (expanded && onExpandedChange) {
        onExpandedChange(false);
        e?.preventDefault();
        return;
      }

      // Otherwise close
      onOpenChange(false);
    },
    {
      scope: Scope.SLIDE_PANEL,
      when: () => open,
    }
  );

  // Cmd+E to toggle expand
  useKeyToggleExpand(
    (e) => {
      if (onExpandedChange) {
        onExpandedChange(!expanded);
        e?.preventDefault();
      }
    },
    {
      scope: Scope.SLIDE_PANEL,
      when: () => open && !!onExpandedChange,
    }
  );

  const handleClose = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleToggleExpand = React.useCallback(() => {
    onExpandedChange?.(!expanded);
  }, [expanded, onExpandedChange]);

  const handleBackdropClick = React.useCallback(() => {
    if (!expanded) {
      onOpenChange(false);
    }
  }, [expanded, onOpenChange]);

  // Resize handling
  const handleResizeStart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);

      const startX = e.clientX;
      const startWidth = width;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = startX - moveEvent.clientX;
        const newWidth = Math.min(
          MAX_WIDTH,
          Math.max(MIN_WIDTH, startWidth + deltaX)
        );
        setWidth(newWidth);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        setPersistedWidth(width);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [width, setPersistedWidth]
  );

  // Save width on resize end
  React.useEffect(() => {
    if (!isResizing && width !== Number(persistedWidth)) {
      setPersistedWidth(width);
    }
  }, [isResizing, width, persistedWidth, setPersistedWidth]);

  const panelWidth = expanded ? '100%' : `${width}px`;

  const content = (
    <AnimatePresence mode="wait">
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'fixed inset-0 z-40 bg-black/40',
              expanded && 'pointer-events-none opacity-0'
            )}
            onClick={handleBackdropClick}
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={transition}
            style={{ width: panelWidth }}
            className={cn(
              'fixed inset-y-0 right-0 z-50',
              'flex flex-col',
              'bg-primary border-l border-panel/40',
              'shadow-xl shadow-black/20',
              className
            )}
          >
            {/* Resize handle */}
            {!expanded && (
              <div
                onMouseDown={handleResizeStart}
                className={cn(
                  'absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize',
                  'hover:bg-brand/50 transition-colors',
                  isResizing && 'bg-brand'
                )}
              />
            )}

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-panel/40">
              <div className="flex-1 min-w-0">
                {title && (
                  <div className="text-base font-medium text-high truncate">
                    {title}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 ml-2">
                {onExpandedChange && (
                  <button
                    onClick={handleToggleExpand}
                    className="flex items-center justify-center w-7 h-7 rounded hover:bg-secondary text-low hover:text-normal transition-colors"
                    title={expanded ? 'Collapse panel' : 'Expand to full page'}
                  >
                    {expanded ? (
                      <ArrowsInSimpleIcon className="size-icon-sm" weight="bold" />
                    ) : (
                      <ArrowsOutSimpleIcon className="size-icon-sm" weight="bold" />
                    )}
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="flex items-center justify-center w-7 h-7 rounded hover:bg-secondary text-low hover:text-normal transition-colors"
                  title="Close panel"
                >
                  <XIcon className="size-icon-sm" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return content;
}
