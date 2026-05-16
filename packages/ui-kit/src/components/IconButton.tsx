import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../utils/cn';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, label, size = 'md', children, ...props }, ref) => (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(
        'text-fg-muted duration-fast hover:bg-surface-muted hover:text-fg-default inline-flex items-center justify-center rounded-md transition-colors',
        'focus-visible:ring-accent-500/50 focus-visible:outline-none focus-visible:ring-2',
        'disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'h-7 w-7' : 'h-9 w-9',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
IconButton.displayName = 'IconButton';
