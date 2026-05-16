import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../utils/cn';

export interface SectionHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode;
  trailing?: ReactNode;
}

export const SectionHeader = forwardRef<HTMLDivElement, SectionHeaderProps>(
  ({ className, title, trailing, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-between px-1.5 pt-2 pb-1.5',
        className,
      )}
      {...props}
    >
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
        {title}
      </h4>
      {trailing ? <div className="text-fg-subtle">{trailing}</div> : null}
    </div>
  ),
);
SectionHeader.displayName = 'SectionHeader';
