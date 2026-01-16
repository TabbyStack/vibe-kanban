import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useHotkeysContext } from 'react-hotkeys-hook';
import {
  ArrowsInSimpleIcon,
  ArrowsOutSimpleIcon,
  CaretDoubleRightIcon,
  SidebarSimpleIcon,
  BrowserIcon,
} from '@phosphor-icons/react';

import { cn } from '@/lib/utils';
import { useKeyExit, useKeyToggleExpand, Scope } from '@/keyboard';
import {
  usePaneSize,
  usePersistedExpanded,
  PERSIST_KEYS,
} from '@/stores/useUiPreferencesStore';

const MIN_WIDTH = 360;
const MAX_WIDTH = 1600;
const DEFAULT_WIDTH = 480;
// Center mode uses percentage-based width for responsive sizing
const CENTER_MAX_WIDTH = 1400;
const CENTER_WIDTH_PERCENT = 90; // 90% of viewport

export type PeekMode = 'side' | 'center';

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

  // Persist panel width and peek mode
  const [persistedWidth, setPersistedWidth] = usePaneSize(
    PERSIST_KEYS.slideOverPanelWidth,
    DEFAULT_WIDTH
  );
  const [width, setWidth] = React.useState(Number(persistedWidth));
  const [peekMode, setPeekMode] = usePersistedExpanded(
    'slide-over-peek-mode' as const,
    true // true = side, false = center
  );
  const currentPeekMode: PeekMode = peekMode ? 'side' : 'center';

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
    onOpenChange(false);
  }, [onOpenChange]);

  const handleTogglePeekMode = React.useCallback(() => {
    setPeekMode(!peekMode);
  }, [peekMode, setPeekMode]);

  // Resize handling (only for side mode)
  const handleResizeStart = React.useCallback(
    (e: React.MouseEvent) => {
      if (currentPeekMode !== 'side') return;
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
    [width, setPersistedWidth, currentPeekMode]
  );

  // Save width on resize end
  React.useEffect(() => {
    if (!isResizing && width !== Number(persistedWidth)) {
      setPersistedWidth(width);
    }
  }, [isResizing, width, persistedWidth, setPersistedWidth]);

  // Determine panel dimensions based on mode
  const isSideMode = currentPeekMode === 'side';
  const panelWidth = expanded
    ? '100%'
    : isSideMode
      ? `${width}px`
      : `${CENTER_WIDTH_PERCENT}vw`;

  // Render the panel header and content (shared between modes)
  const renderPanelInner = () => (
    <>
      {/* Resize handle (side mode only) */}
      {isSideMode && !expanded && (
        <div
          onMouseDown={handleResizeStart}
          className={cn(
            'absolute -left-2 top-0 bottom-0 w-5 cursor-ew-resize group',
            'flex items-center justify-center z-10'
          )}
        >
          {/* Visual indicator line */}
          <div
            className={cn(
              'absolute left-2 top-0 bottom-0 w-[4px] rounded-full transition-colors',
              'bg-transparent group-hover:bg-brand/60',
              isResizing && 'bg-brand'
            )}
          />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center px-3 py-2 border-b border-panel/40 shrink-0">
        {/* Left side: Controls */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Close button */}
          <button
            onClick={handleClose}
            className="flex items-center justify-center w-7 h-7 rounded hover:bg-secondary text-low hover:text-normal transition-colors"
            title="Close panel"
          >
            <CaretDoubleRightIcon className="size-icon-sm" weight="bold" />
          </button>

          {/* Peek mode toggle */}
          <button
            onClick={handleTogglePeekMode}
            className={cn(
              'flex items-center justify-center w-7 h-7 rounded transition-colors',
              'text-low hover:text-normal hover:bg-secondary'
            )}
            title={isSideMode ? 'Switch to center peek' : 'Switch to side peek'}
          >
            {isSideMode ? (
              <BrowserIcon className="size-icon-sm" />
            ) : (
              <SidebarSimpleIcon className="size-icon-sm" />
            )}
          </button>

          {/* Expand/Collapse toggle */}
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
        </div>

        {/* Title */}
        {title && (
          <div className="text-sm text-high truncate min-w-0 ml-2 flex-1">
            {title}
          </div>
        )}
      </div>

      {/* Content - use relative/absolute pattern for reliable height in both side and center modes */}
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 overflow-hidden">{children}</div>
      </div>
    </>
  );

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

          {/* Center mode: uses flex container for centering */}
          {!isSideMode && !expanded && (
            <div className="fixed inset-0 z-50 flex items-start justify-center px-16 pt-10 pointer-events-none">
              <motion.div
                ref={panelRef}
                key="panel-center"
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={transition}
                style={{
                  width: panelWidth,
                  maxWidth: `${CENTER_MAX_WIDTH}px`,
                  height: 'calc(100vh - 80px)',
                }}
                className={cn(
                  'flex flex-col pointer-events-auto',
                  'bg-primary',
                  'shadow-xl shadow-black/20',
                  'rounded-lg border border-panel/40',
                  'px-6 py-4',
                  className
                )}
              >
                {renderPanelInner()}
              </motion.div>
            </div>
          )}

          {/* Side mode or Expanded mode */}
          {(isSideMode || expanded) && (
            <motion.div
              ref={panelRef}
              key="panel-side"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={transition}
              style={{ width: panelWidth }}
              className={cn(
                'z-50 flex flex-col',
                'bg-primary',
                'shadow-xl shadow-black/20',
                // Side mode positioning
                !expanded && 'fixed inset-y-0 right-0 border-l border-panel/40',
                // Expanded mode
                expanded && 'fixed inset-0',
                className
              )}
            >
              {renderPanelInner()}
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );

  return content;
}
