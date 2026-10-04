import { ChevronLeft, ChevronRight, LoaderCircle, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PageMeta } from '../../api/types';
import { cx } from '../../lib/cx';
import { IconButton } from './Button';

export function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircle
      className={cx('size-5 animate-spin text-fg-subtle', className)}
      aria-label="Loading"
    />
  );
}

export function FullPageSpinner() {
  return (
    <div className="grid min-h-screen place-items-center">
      <Spinner className="size-7" />
    </div>
  );
}

/** Pulsing placeholder rows, used instead of spinners for lists and pages. */
export function SkeletonRows({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cx('space-y-2', className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-9 animate-pulse rounded-md bg-secondary" />
      ))}
    </div>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, children, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <Icon className="size-8 text-fg-subtle" aria-hidden />
      <p className="font-semibold text-fg-strong">{title}</p>
      {children && <p className="max-w-sm text-fg-subtle">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** 1 … 4 5 6 … 12 */
function pageStrip(page: number, totalPages: number): (number | 'gap')[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const strip: (number | 'gap')[] = [];
  sorted.forEach((p, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && p - previous > 1) strip.push('gap');
    strip.push(p);
  });
  return strip;
}

interface PaginationProps {
  meta: PageMeta;
  onPage: (page: number) => void;
  /** Disable while the next page is loading. */
  busy?: boolean;
}

export function Pagination({ meta, onPage, busy }: PaginationProps) {
  if (meta.total === 0) return null;
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 pt-3 text-fg-subtle"
    >
      <span>
        Showing {from} to {to} of {meta.total}
      </span>
      <div className="flex items-center gap-1">
        <IconButton
          icon={ChevronLeft}
          label="Previous page"
          disabled={!meta.hasPrev || busy}
          onClick={() => onPage(meta.page - 1)}
        />
        {pageStrip(meta.page, meta.totalPages).map((item, index) =>
          item === 'gap' ? (
            <span key={`gap-${index}`} className="px-1">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              disabled={busy}
              aria-current={item === meta.page ? 'page' : undefined}
              onClick={() => onPage(item)}
              className={cx(
                'h-8 min-w-8 rounded-md px-2 transition-colors disabled:cursor-not-allowed',
                item === meta.page
                  ? 'bg-selected font-semibold text-primary'
                  : 'hover:bg-secondary',
              )}
            >
              {item}
            </button>
          ),
        )}
        <IconButton
          icon={ChevronRight}
          label="Next page"
          disabled={!meta.hasNext || busy}
          onClick={() => onPage(meta.page + 1)}
        />
      </div>
    </nav>
  );
}

interface TabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
}

/** Segmented control. */
export function Tabs<T extends string>({ value, onChange, options, label }: TabsProps<T>) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-md bg-sunken p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
          className={cx(
            'h-7 rounded-sm px-3 text-sm transition-colors',
            option.value === value
              ? 'bg-selected font-semibold text-primary'
              : 'text-fg-subtle hover:text-fg-strong',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Page heading with optional actions on the right. */
export function PageHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-semibold text-fg-strong">{title}</h1>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
