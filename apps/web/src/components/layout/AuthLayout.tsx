import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

/** Centered card for the login and register pages. */
export function AuthLayout({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-lg font-semibold text-fg-strong">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-on-primary">
            <Check className="size-5" strokeWidth={3} aria-hidden />
          </span>
          Tracker
        </div>
        <div className="rounded-lg border border-border bg-surface p-6 shadow-overlay">
          <h1 className="mb-5 text-center text-base font-semibold text-fg-strong">{title}</h1>
          {children}
        </div>
        <p className="mt-4 text-center text-fg-subtle">{footer}</p>
      </div>
    </main>
  );
}
