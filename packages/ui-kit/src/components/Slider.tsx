import * as SliderPrimitive from '@radix-ui/react-slider';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '../utils/cn';

export const Slider = forwardRef<
  ElementRef<typeof SliderPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('relative flex w-full touch-none select-none items-center', className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
      <SliderPrimitive.Range className="bg-accent-500 absolute h-full" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className={cn(
        'border-accent-500 bg-surface-elevated duration-fast block h-4 w-4 rounded-full border-2 shadow-sm transition-transform',
        'focus-visible:ring-accent-500/50 focus-visible:ring-offset-surface hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
      )}
    />
  </SliderPrimitive.Root>
));
Slider.displayName = 'Slider';
