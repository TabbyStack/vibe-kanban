import { type ReactNode } from 'react';
import { CheckIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { toPrettyCase } from '@/utils/string';
import WYSIWYGEditor from '@/components/ui/wysiwyg';
import type { LocalImageMetadata } from '@/components/ui/wysiwyg/context/task-attempt-context';
import { Toolbar, ToolbarDropdown } from './Toolbar';
import { DropdownMenuItem, DropdownMenuLabel } from './Dropdown';

export interface EditorProps {
  value: string;
  onChange: (value: string) => void;
}

export interface VariantProps {
  selected: string | null;
  options: string[];
  onChange: (variant: string | null) => void;
}

export enum VisualVariant {
  NORMAL = 'NORMAL',
  FEEDBACK = 'FEEDBACK',
  EDIT = 'EDIT',
  PLAN = 'PLAN',
}

interface ChatBoxBaseProps {
  // Editor
  editor: EditorProps;
  placeholder: string;
  onCmdEnter: () => void;
  disabled?: boolean;
  projectId?: string;
  autoFocus?: boolean;

  // Variant selection
  variant?: VariantProps;

  // Error display
  error?: string | null;

  // Header content (right side - session/executor dropdown)
  headerRight?: ReactNode;

  // Header content (left side - stats)
  headerLeft?: ReactNode;

  // Footer left content (additional toolbar items like attach button)
  footerLeft?: ReactNode;

  // Footer right content (action buttons)
  footerRight: ReactNode;

  // Banner content (queued message indicator, feedback mode indicator)
  banner?: ReactNode;

  // visualVariant
  visualVariant: VisualVariant;

  // File paste handler for attachments
  onPasteFiles?: (files: File[]) => void;

  // Whether the workspace is running (shows animated border)
  isRunning?: boolean;

  // Key to force editor remount (e.g., when entering feedback mode to trigger auto-focus)
  focusKey?: string;

  // Local images for immediate preview (before saved to server)
  localImages?: LocalImageMetadata[];

  // Whether to use full width (no w-chat constraint)
  fullWidth?: boolean;
}

/**
 * Base chat box layout component.
 * Provides shared structure for CreateChatBox and SessionChatBox.
 */
export function ChatBoxBase({
  editor,
  placeholder,
  onCmdEnter,
  disabled,
  projectId,
  autoFocus,
  variant,
  error,
  headerRight,
  headerLeft,
  footerLeft,
  footerRight,
  banner,
  visualVariant,
  onPasteFiles,
  isRunning,
  focusKey,
  localImages,
  fullWidth,
}: ChatBoxBaseProps) {
  const { t } = useTranslation('common');
  const variantLabel = toPrettyCase(variant?.selected || 'DEFAULT');
  const variantOptions = variant?.options ?? [];

  return (
    <div
      className={cn(
        'flex flex-col',
        fullWidth ? 'w-full' : 'w-chat max-w-full',
        'rounded-md border',
        'transition-colors duration-150',
        visualVariant === VisualVariant.NORMAL &&
          'border-panel/40 bg-secondary/20 focus-within:border-brand/40 focus-within:ring-1 focus-within:ring-brand/20',
        (visualVariant === VisualVariant.FEEDBACK ||
          visualVariant === VisualVariant.EDIT ||
          visualVariant === VisualVariant.PLAN) &&
          'border-brand bg-brand/10',
        isRunning && 'chat-box-running'
      )}
    >
      {/* Error alert */}
      {error && (
        <div className="bg-error/10 border-b border-panel/30 px-double py-base rounded-t-md">
          <p className="text-error text-sm">{error}</p>
        </div>
      )}

      {/* Banner content (queued indicator, feedback mode, etc.) */}
      {banner}

      {/* Header - Stats and selector */}
      {visualVariant === VisualVariant.NORMAL && (headerLeft || headerRight) && (
        <div className="flex items-center gap-base px-base py-[9px] rounded-t-md border-b border-panel/30">
          <div className="flex flex-1 items-center gap-base text-sm text-low">
            {headerLeft}
          </div>
          <Toolbar className="gap-[9px]">{headerRight}</Toolbar>
        </div>
      )}

      {/* Editor area */}
      <div className="flex flex-col gap-plusfifty px-base py-base">
        <WYSIWYGEditor
          key={focusKey}
          placeholder={placeholder}
          value={editor.value}
          onChange={editor.onChange}
          onCmdEnter={onCmdEnter}
          disabled={disabled}
          className="min-h-0 max-h-[50vh] overflow-y-auto"
          projectId={projectId}
          autoFocus={autoFocus}
          onPasteFiles={onPasteFiles}
          localImages={localImages}
        />
      </div>

      {/* Footer - Controls */}
      <div className="flex items-end justify-between px-base py-half border-t border-panel/30">
        <Toolbar className="flex-1 gap-double">
          {(visualVariant === VisualVariant.NORMAL ||
            visualVariant === VisualVariant.EDIT) &&
            variant &&
            variantOptions.length > 0 && (
              <ToolbarDropdown label={variantLabel} disabled={disabled}>
                <DropdownMenuLabel>{t('chatBox.variants')}</DropdownMenuLabel>
                {variantOptions.map((variantName) => (
                  <DropdownMenuItem
                    key={variantName}
                    icon={
                      variant?.selected === variantName
                        ? CheckIcon
                        : undefined
                    }
                    onClick={() => variant?.onChange(variantName)}
                  >
                    {toPrettyCase(variantName)}
                  </DropdownMenuItem>
                ))}
              </ToolbarDropdown>
            )}
          {footerLeft}
        </Toolbar>
        <div className="flex gap-base">{footerRight}</div>
      </div>
    </div>
  );
}
