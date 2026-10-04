import { BellRing, Check, Kanban, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Avatar, PriorityIcon, StatusLozenge, TypeIcon } from '../ui/badges';

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Kanban,
    title: 'A board for every project',
    text: 'Drag tasks from To Do to Done, and tickets from Open to Resolved.',
  },
  {
    icon: ShieldCheck,
    title: 'Access by role',
    text: 'Admins, Managers and Members each see and change exactly what they should.',
  },
  {
    icon: BellRing,
    title: 'Real-time notifications',
    text: 'Assignments, status changes and comments arrive the moment they happen.',
  },
];

// Soft glows in the brand colours, made from the colour tokens.
const GLOW = {
  backgroundImage: [
    'radial-gradient(55% 45% at 15% 10%, color-mix(in oklab, var(--color-primary) 22%, transparent), transparent 70%)',
    'radial-gradient(45% 40% at 95% 95%, color-mix(in oklab, var(--color-purple) 18%, transparent), transparent 70%)',
  ].join(','),
};
// A faint grid that fades out towards the edges.
const GRID = {
  backgroundImage:
    'linear-gradient(to right, var(--color-border) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)',
  backgroundSize: '32px 32px',
  maskImage: 'radial-gradient(70% 60% at 50% 40%, black, transparent)',
};

function Logo() {
  return (
    <span className="flex items-center gap-2.5 text-lg font-semibold text-fg-strong">
      <span className="grid size-9 place-items-center rounded-lg bg-primary text-on-primary shadow-overlay">
        <Check className="size-5" strokeWidth={3} aria-hidden />
      </span>
      Tracker
    </span>
  );
}

/** Login and register: a brand panel beside the form on wide screens, the form alone on phones. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <aside
        className="relative hidden overflow-hidden border-r border-border bg-sunken lg:flex lg:flex-col lg:justify-between lg:p-12"
        style={GLOW}
      >
        <div className="pointer-events-none absolute inset-0 opacity-40" style={GRID} aria-hidden />

        <div className="relative">
          <Logo />
        </div>

        <div className="relative max-w-lg space-y-8">
          <div className="space-y-3">
            <h2 className="text-3xl leading-tight font-semibold text-fg-strong">
              Projects, tasks and support tickets in one place
            </h2>
            <p className="text-base text-fg-subtle">
              Plan work on a board, raise and escalate tickets, and know the moment something
              changes.
            </p>
          </div>
          <ul className="space-y-5">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-surface text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span>
                  <span className="block font-semibold text-fg-strong">{title}</span>
                  <span className="text-fg-subtle">{text}</span>
                </span>
              </li>
            ))}
          </ul>
          <Preview />
        </div>

        <p className="relative text-xs text-fg-subtle">
          Unified Team Task & Support Ticket Tracker
        </p>
      </aside>

      <main className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-2xl font-semibold text-fg-strong">{title}</h1>
          <p className="mt-1.5 text-fg-subtle">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-center text-fg-subtle">{footer}</p>
        </div>
      </main>
    </div>
  );
}

/** A task card and the notification it triggers, drawn with the app's own components. */
function Preview() {
  return (
    <div className="relative h-36" aria-hidden>
      <div className="absolute top-0 left-0 w-80 rounded-lg border border-border bg-surface p-4 shadow-overlay">
        <p className="font-medium text-fg-strong">Fix login redirect loop</p>
        <div className="mt-3 flex items-center gap-2 text-xs text-fg-subtle">
          <TypeIcon type="TASK" />
          TASK-2
          <PriorityIcon priority="URGENT" />
          <span className="ml-auto flex items-center gap-2">
            <StatusLozenge status="IN_PROGRESS" />
            <Avatar user={{ id: 'preview-member', name: 'Member Two' }} small />
          </span>
        </div>
      </div>
      <div className="absolute top-20 left-28 flex w-80 items-start gap-3 rounded-lg border border-border bg-raised p-3 shadow-overlay">
        <BellRing className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <p className="text-sm text-fg">
          <span className="font-semibold text-fg-strong">Manager One</span> assigned you &ldquo;Fix
          login redirect loop&rdquo;
        </p>
      </div>
    </div>
  );
}
