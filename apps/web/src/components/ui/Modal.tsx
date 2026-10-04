import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { IconButton } from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

/** Native <dialog>: focus is trapped, Esc closes, clicking the backdrop closes. */
export function Modal({ open, onClose, title, children, footer, wide }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cx(
        'm-auto w-[calc(100%-2rem)] rounded-lg border border-border bg-raised text-fg shadow-overlay',
        wide ? 'max-w-2xl' : 'max-w-lg',
      )}
    >
      {/* Content mounts only while open, so forms start fresh each time. */}
      {open && (
        <>
          <div className="flex items-center justify-between border-b border-border py-2 pr-2 pl-5">
            <h2 id={titleId} className="text-base font-semibold text-fg-strong">
              {title}
            </h2>
            <IconButton icon={X} label="Close" onClick={onClose} />
          </div>
          <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
          )}
        </>
      )}
    </dialog>
  );
}
