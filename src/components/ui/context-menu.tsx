import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';
import { clsx } from 'clsx';
import { forwardRef } from 'react';

type ContextMenuContentProps = ContextMenuPrimitive.ContextMenuContentProps & {
  className?: string;
};

type ContextMenuItemProps = ContextMenuPrimitive.ContextMenuItemProps & {
  inset?: boolean;
};

type ContextMenuLabelProps = ContextMenuPrimitive.ContextMenuLabelProps;

type ContextMenuSeparatorProps = ContextMenuPrimitive.ContextMenuSeparatorProps;

type ContextMenuShortcutProps = React.HTMLAttributes<HTMLSpanElement>;

export const ContextMenu = ContextMenuPrimitive.Root;
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger;
export const ContextMenuGroup = ContextMenuPrimitive.Group;
export const ContextMenuPortal = ContextMenuPrimitive.Portal;
export const ContextMenuSub = ContextMenuPrimitive.Sub;
export const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;

export const ContextMenuSubTrigger = forwardRef<HTMLDivElement, ContextMenuPrimitive.ContextMenuSubTriggerProps>(
  ({ className, inset, children, ...props }, ref) => (
    <ContextMenuPrimitive.SubTrigger
      ref={ref}
      className={clsx(
        'flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-sm outline-none',
        inset && 'pl-8',
        'text-[var(--fg-2)] hover:bg-[var(--hover)] hover:text-[var(--fg)]',
        className
      )}
      {...props}
    >
      {children}
    </ContextMenuPrimitive.SubTrigger>
  )
);
ContextMenuSubTrigger.displayName = ContextMenuPrimitive.SubTrigger.displayName;

export const ContextMenuSubContent = forwardRef<HTMLDivElement, ContextMenuContentProps>(
  ({ className, ...props }, ref) => (
    <ContextMenuPrimitive.SubContent
      ref={ref}
      className={clsx(
        'z-[1100] min-w-[180px] overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg-2)] p-1 shadow-elevated',
        className
      )}
      {...props}
    />
  )
);
ContextMenuSubContent.displayName = ContextMenuPrimitive.SubContent.displayName;

export const ContextMenuContent = forwardRef<HTMLDivElement, ContextMenuContentProps>(
  ({ className, ...props }, ref) => (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        ref={ref}
        className={clsx(
          'z-[1100] min-w-[200px] overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg-2)] p-1 shadow-elevated',
          className
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  )
);
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName;

export const ContextMenuItem = forwardRef<HTMLDivElement, ContextMenuItemProps>(
  ({ className, inset, ...props }, ref) => (
    <ContextMenuPrimitive.Item
      ref={ref}
      className={clsx(
        'flex cursor-pointer select-none items-center justify-between gap-2 rounded px-2 py-1.5 text-sm text-[var(--fg-2)] outline-none',
        inset && 'pl-8',
        'focus:bg-[var(--hover)] focus:text-[var(--fg)]',
        props.disabled && 'pointer-events-none opacity-50',
        className
      )}
      {...props}
    />
  )
);
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName;

export const ContextMenuCheckboxItem = forwardRef<
  HTMLDivElement,
  ContextMenuPrimitive.ContextMenuCheckboxItemProps
>(({ className, children, ...props }, ref) => (
  <ContextMenuPrimitive.CheckboxItem
    ref={ref}
    className={clsx(
      'flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-sm text-[var(--fg-2)] outline-none focus:bg-[var(--hover)] focus:text-[var(--fg)]',
      props.disabled && 'pointer-events-none opacity-50',
      className
    )}
    {...props}
  >
    {children}
  </ContextMenuPrimitive.CheckboxItem>
));
ContextMenuCheckboxItem.displayName = ContextMenuPrimitive.CheckboxItem.displayName;

export const ContextMenuRadioItem = forwardRef<
  HTMLDivElement,
  ContextMenuPrimitive.ContextMenuRadioItemProps
>(({ className, children, ...props }, ref) => (
  <ContextMenuPrimitive.RadioItem
    ref={ref}
    className={clsx(
      'flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-sm text-[var(--fg-2)] outline-none focus:bg-[var(--hover)] focus:text-[var(--fg)]',
      props.disabled && 'pointer-events-none opacity-50',
      className
    )}
    {...props}
  >
    {children}
  </ContextMenuPrimitive.RadioItem>
));
ContextMenuRadioItem.displayName = ContextMenuPrimitive.RadioItem.displayName;

export const ContextMenuLabel = forwardRef<HTMLDivElement, ContextMenuLabelProps>(
  ({ className, inset, ...props }, ref) => (
    <ContextMenuPrimitive.Label
      ref={ref}
      className={clsx(
        'px-2 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-[var(--fg-3)]',
        inset && 'pl-8',
        className
      )}
      {...props}
    />
  )
);
ContextMenuLabel.displayName = ContextMenuPrimitive.Label.displayName;

export const ContextMenuSeparator = forwardRef<HTMLDivElement, ContextMenuSeparatorProps>(
  ({ className, ...props }, ref) => (
    <ContextMenuPrimitive.Separator
      ref={ref}
      className={clsx('my-1 h-px bg-[var(--line)]/60', className)}
      {...props}
    />
  )
);
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName;

export const ContextMenuShortcut = ({ className, ...props }: ContextMenuShortcutProps) => (
  <span className={clsx('ml-auto text-xs tracking-widest text-[var(--fg-3)]', className)} {...props} />
);
