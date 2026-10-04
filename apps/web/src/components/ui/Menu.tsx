import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../../lib/cx';

interface MenuProps {
  trigger: (state: { open: boolean; toggle: () => void }) => ReactNode;
  /** Receives `close`, so an item can close the menu after acting. */
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

/** A dropdown that closes on outside click and on Escape. */
export function Menu({ trigger, children, align = 'left', className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((value) => !value) })}
      {open && (
        <div
          role="menu"
          className={cx(
            'absolute z-40 mt-1 min-w-48 rounded-md border border-border bg-raised py-1 shadow-overlay',
            align === 'right' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

interface MenuItemProps {
  onSelect: () => void;
  children: ReactNode;
  selected?: boolean;
  disabled?: boolean;
}

export function MenuItem({ onSelect, children, selected, disabled }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className={cx(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50',
        selected && 'bg-selected text-primary',
      )}
    >
      {children}
    </button>
  );
}
