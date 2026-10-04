import { LoaderCircle, type LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cx } from '../../lib/cx';

type Variant = 'primary' | 'secondary' | 'subtle' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active',
  secondary: 'bg-secondary text-fg-strong hover:bg-secondary-hover active:bg-secondary-active',
  subtle: 'text-fg hover:bg-secondary active:bg-secondary-active',
  danger: 'bg-danger text-on-primary hover:bg-danger/85',
};

const SIZES = {
  sm: 'h-7 px-2 text-xs',
  md: 'h-8 px-3',
  lg: 'h-10 px-4',
};

interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  /** Shows a spinner and disables the button (prevents double submits). */
  loading?: boolean;
  icon?: LucideIcon;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon: Icon,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {loading ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
      ) : (
        Icon && <Icon className="size-4" aria-hidden />
      )}
      {children}
    </button>
  );
}

interface IconButtonProps extends ComponentProps<'button'> {
  icon: LucideIcon;
  /** Required: icon-only buttons need an accessible name. */
  label: string;
}

export function IconButton({
  icon: Icon,
  label,
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-secondary hover:text-fg-strong disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...props}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
