import * as React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useHotkeysContext } from 'react-hotkeys-hook';
import {
  ArrowsInSimpleIcon,
  ArrowsOutSimpleIcon,
  XIcon,
} from '@phosphor-icons/react';

import { cn } from '@/lib/utils';
import { useKeyExit, useKeyToggleExpand, Scope } from '@/keyboard';

const PANEL_WIDTHS = {
  sm: 360,
  md: 420,
  lg: 480,
  xl: 600,
} as const;

export type SlideOverWidth = keyof typeof PANEL_WIDTHS;

export interface SlideOverPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  width?: SlideOverWidth;
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
  width = 'lg',
  title,
  children,
  className,
}: SlideOverPanelProps) {
  const { enableScope, disableScope } = useHotkeysContext();
  const panelRef = React.useRef<HTMLDivElement>(null);

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

  const panelWidth = expanded ? '100%' : `${PANEL_WIDTHS[width]}px`;

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

  // Render as portal to body
  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
