import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'border-border bg-surface-elevated duration-fast flex h-9 w-full rounded-md border px-3 py-1 text-sm transition-colors',
        'placeholder:text-fg-subtle',
        'focus-visible:ring-accent-500/50 focus-visible:border-accent-400 focus-visible:outline-none focus-visible:ring-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid && 'border-danger/60 focus-visible:ring-danger/40 focus-visible:border-danger',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
