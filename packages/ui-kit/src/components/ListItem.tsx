import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../utils/cn';

export interface ListItemProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  trailing?: ReactNode;
  showChevron?: boolean;
  interactive?: boolean;
  iconTone?: 'iris' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

const toneClasses: Record<NonNullable<ListItemProps['iconTone']>, string> = {
  iris: 'bg-accent-500/12 text-accent-600 dark:text-accent-400',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/12 text-danger',
  info: 'bg-info/12 text-info',
  neutral: 'bg-surface-muted text-fg-muted',
};

export const ListItem = forwardRef<HTMLDivElement, ListItemProps>(
  (
    {
      className,
      icon,
      title,
      description,
      trailing,
      showChevron = false,
      interactive = false,
      iconTone = 'iris',
      ...props
    },
    ref,
  ) => (
    <div
      ref={ref}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors duration-fast',
        interactive &&
          'cursor-pointer hover:bg-surface-muted focus-visible:bg-surface-muted',
        className,
      )}
      {...props}
    >
      {icon ? (
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
            toneClasses[iconTone],
          )}
        >
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-fg-default leading-tight truncate">
          {title}
        </div>
        {description ? (
          <div className="text-xs text-fg-muted mt-0.5 leading-snug truncate">
            {description}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {trailing}
        {showChevron ? <ChevronRight className="h-4 w-4 text-fg-subtle" /> : null}
      </div>
    </div>
  ),
);
ListItem.displayName = 'ListItem';
