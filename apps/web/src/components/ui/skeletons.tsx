import type { ReactNode } from 'react';
import { Skeleton } from '@/components/shadcn/skeleton';
import { cx } from '../../lib/cx';

// Loading placeholders shaped like the content they stand in for, so the page does not jump
// when the data arrives. All are built from the shadcn Skeleton.

/** Varied widths, so placeholder rows do not look like a barcode. */
const WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6', 'w-2/5', 'w-3/5'];
const width = (index: number) => WIDTHS[index % WIDTHS.length];

function Busy({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={className} aria-busy="true" aria-label="Loading">
      {children}
    </div>
  );
}

/** A bordered table: header row, then `rows` rows of `columns` cells (the first one wider). */
export function TableSkeleton({
  rows = 8,
  columns = 6,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  const cells = Array.from({ length: columns }, (_, column) => column);
  return (
    <Busy className={cx('overflow-hidden rounded-lg border border-border bg-surface', className)}>
      <div className="flex gap-4 border-b border-border px-3 py-2.5">
        {cells.map((column) => (
          <Skeleton key={column} className={cx('h-3', column === 0 ? 'flex-2' : 'flex-1')} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="flex items-center gap-4 border-b border-border px-3 py-3 last:border-0"
        >
          {cells.map((column) => (
            <div key={column} className={column === 0 ? 'flex-2' : 'flex-1'}>
              <Skeleton className={cx('h-3.5', width(row + column))} />
            </div>
          ))}
        </div>
      ))}
    </Busy>
  );
}

/** Board columns with a few cards each. */
export function BoardSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <Busy className="flex gap-3 overflow-hidden">
      {Array.from({ length: columns }, (_, column) => (
        <div key={column} className="max-w-80 min-w-56 flex-1 space-y-2 rounded-lg bg-sunken p-2">
          <Skeleton className="mx-1 my-1.5 h-3 w-24" />
          {Array.from({ length: 4 - (column % 3) }, (_, card) => (
            <div key={card} className="space-y-3 rounded-md border border-border bg-surface p-3">
              <Skeleton className={cx('h-3.5', width(column + card))} />
              <div className="flex items-center gap-2">
                <Skeleton className="size-4 rounded-sm" />
                <Skeleton className="h-3 w-14" />
                <Skeleton className="ml-auto size-5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </Busy>
  );
}

/** The dashboard's summary grid: one tall card and five number cards. */
export function DashboardSkeleton() {
  return (
    <Busy className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-3 rounded-lg border border-border bg-surface p-4 sm:col-span-2 lg:row-span-2">
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: 3 }, (_, row) => (
          <div key={row} className="flex items-center justify-between px-2 py-1.5">
            <Skeleton className="h-5 w-24 rounded-sm" />
            <Skeleton className="h-5 w-6" />
          </div>
        ))}
      </div>
      {Array.from({ length: 5 }, (_, card) => (
        <div key={card} className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-7 w-12" />
        </div>
      ))}
    </Busy>
  );
}

/** Avatar and two lines per row: notifications and comments. */
export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <Busy className={cx('space-y-1', className)}>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-start gap-3 rounded-md px-3 py-2.5">
          <Skeleton className="size-6 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2 pt-0.5">
            <Skeleton className={cx('h-3.5', width(row))} />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </Busy>
  );
}

/** Label and input pairs: a form whose options are still loading. */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <Busy className="space-y-4">
      <Skeleton className="h-8 w-40" />
      {Array.from({ length: fields }, (_, field) => (
        <div key={field} className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className={cx('w-full', field === 3 ? 'h-24' : 'h-8')} />
        </div>
      ))}
    </Busy>
  );
}

/** The issue page: title, description and activity on the left, the details panel on the right. */
export function WorkItemDetailSkeleton() {
  return (
    <Busy className="mx-auto max-w-6xl p-6">
      <Skeleton className="h-3.5 w-56" />
      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Skeleton className="h-7 w-2/3" />
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-3/5" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-20" />
            <ListSkeleton rows={2} />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-6 w-28 rounded-sm" />
          <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
            <Skeleton className="h-4 w-16" />
            {Array.from({ length: 6 }, (_, row) => (
              <div key={row} className="flex items-center gap-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className={cx('h-5 flex-1', width(row))} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Busy>
  );
}

/** A page heading with an action button, then a table. Used while a page's code loads. */
export function PageSkeleton() {
  return (
    <Busy className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-8 w-28" />
      </div>
      <Skeleton className="h-8 w-64" />
      <TableSkeleton rows={6} />
    </Busy>
  );
}

/** The whole app frame (sidebar, top bar, page), shown while the session is being checked. */
export function AppShellSkeleton() {
  return (
    <Busy className="flex min-h-svh">
      <div className="hidden w-60 shrink-0 space-y-6 border-r border-border bg-surface p-3 md:block">
        <div className="flex items-center gap-2 p-1">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-4 w-24" />
        </div>
        {[3, 4].map((items, group) => (
          <div key={group} className="space-y-2">
            <Skeleton className="mx-2 h-3 w-16" />
            {Array.from({ length: items }, (_, item) => (
              <div key={item} className="flex items-center gap-2 px-2 py-1.5">
                <Skeleton className="size-4 rounded-sm" />
                <Skeleton className={cx('h-3.5', width(item + group))} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex-1">
        <div className="flex h-14 items-center gap-3 border-b border-border px-4">
          <Skeleton className="size-7" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="ml-auto size-8 rounded-full" />
        </div>
        <PageSkeleton />
      </div>
    </Busy>
  );
}

/** The login/register card while its code loads. */
export function AuthSkeleton() {
  return (
    <Busy className="grid min-h-svh place-items-center px-6">
      <div className="w-full max-w-sm space-y-4">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="mt-6 h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </Busy>
  );
}

/** A project page: its side panel (name, sections) and a board. */
export function ProjectSkeleton() {
  return (
    <Busy className="flex min-h-[calc(100vh-3.5rem)] flex-col lg:flex-row">
      <div className="shrink-0 space-y-4 border-b border-border p-3 lg:w-60 lg:border-r lg:border-b-0">
        <div className="space-y-2 px-2 py-1">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-28" />
        </div>
        {Array.from({ length: 3 }, (_, item) => (
          <div key={item} className="flex items-center gap-2 px-2 py-1">
            <Skeleton className="size-4 rounded-sm" />
            <Skeleton className="h-3.5 w-20" />
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1 space-y-4 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-8 w-72" />
        <BoardSkeleton />
      </div>
    </Busy>
  );
}
