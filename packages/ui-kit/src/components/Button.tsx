import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap rounded-md transition-all duration-fast ease-out disabled:opacity-50 disabled:pointer-events-none select-none',
  {
    variants: {
      variant: {
        primary:
          'bg-accent-600 text-fg-on-accent hover:bg-accent-700 active:bg-accent-700 shadow-xs',
        secondary:
          'bg-surface-elevated text-fg-default border border-border hover:bg-surface-muted active:bg-surface-muted shadow-xs',
        ghost: 'bg-transparent text-fg-muted hover:bg-surface-muted hover:text-fg-default',
        danger: 'bg-danger text-white hover:opacity-90 active:opacity-90 shadow-xs',
        link: 'bg-transparent text-accent-600 hover:underline underline-offset-4 px-0 h-auto',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-9 px-3.5 text-sm',
        lg: 'h-11 px-5 text-md',
        icon: 'h-9 w-9 text-sm',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
