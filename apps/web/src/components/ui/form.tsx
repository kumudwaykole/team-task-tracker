import { Eye, EyeOff, Lock, type LucideIcon } from 'lucide-react';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { cx } from '../../lib/cx';

const control =
  'rounded-md border border-border-strong bg-sunken px-2.5 text-fg-strong placeholder:text-fg-subtle transition-colors hover:bg-hover focus:bg-sunken disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cx(control, 'h-8 w-full', className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cx(control, 'min-h-24 w-full py-2 leading-relaxed', className)}
      {...props}
    />
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

interface IconInputProps extends ComponentProps<'input'> {
  icon: LucideIcon;
  /** A control inside the right edge, e.g. a show-password button. */
  trailing?: ReactNode;
}

/** A tall input with an icon inside its left edge (login and register forms). */
export function IconInput({ icon: Icon, trailing, className, ...props }: IconInputProps) {
  return (
    <div className="relative">
      <Icon
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
        aria-hidden
      />
      <input
        className={cx(control, 'h-10 w-full pl-9', trailing ? 'pr-10' : 'pr-3', className)}
        {...props}
      />
      {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
    </div>
  );
}

/** A password input with a button to show or hide what was typed. */
export function PasswordInput(props: Omit<IconInputProps, 'icon' | 'trailing' | 'type'>) {
  const [visible, setVisible] = useState(false);
  const Toggle = visible ? EyeOff : Eye;
  return (
    <IconInput
      icon={Lock}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="grid size-8 place-items-center rounded-md text-fg-subtle hover:bg-secondary hover:text-fg-strong"
        >
          <Toggle className="size-4" aria-hidden />
        </button>
      }
      {...props}
    />
  );
}
