import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { clsx } from 'clsx';
import type { ReactNode } from 'react';

export const TooltipProvider = TooltipPrimitive.Provider;
export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

interface TooltipContentProps extends TooltipPrimitive.TooltipContentProps {
  children: ReactNode;
}

export function TooltipContent({ className, sideOffset = 8, ...props }: TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={clsx(
          'z-[1200] max-w-xs rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2 text-xs text-[var(--fg)] shadow-elevated',
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}
