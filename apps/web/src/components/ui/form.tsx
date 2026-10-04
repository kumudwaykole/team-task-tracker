import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../../lib/cx';

const control =
  'rounded-md border border-border-strong bg-sunken px-2.5 text-fg-strong placeholder:text-fg-subtle transition-colors hover:bg-hover focus:bg-sunken disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cx(control, 'h-8 w-full', className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea className={cx(control, 'min-h-24 w-full py-2 leading-relaxed', className)} {...props} />
  );
}

/** Full width by default; a `className` takes over the width (e.g. `w-auto` in filter bars). */
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cx(control, 'h-8 pr-7', className ?? 'w-full')} {...props} />;
}

export function Checkbox({
  label,
  className,
  ...props
}: ComponentProps<'input'> & { label: ReactNode }) {
  return (
    <label className={cx('inline-flex cursor-pointer items-center gap-2 select-none', className)}>
      <input type="checkbox" className="size-4 accent-primary" {...props} />
      {label}
    </label>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

/** Label, control, and the field's error (from Zod or from the API's `details[]`). */
export function Field({ label, htmlFor, error, hint, required, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-fg-subtle">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-fg-subtle">{hint}</p>
      )}
    </div>
  );
}
