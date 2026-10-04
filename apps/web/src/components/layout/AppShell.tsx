import { Check, LogOut, Plus } from 'lucide-react';
import { Suspense, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth, useCurrentUser } from '../../context/AuthContext';
import { cx } from '../../lib/cx';
import { ROLE_LABELS } from '../../lib/labels';
import { NotificationBell } from '../notifications/NotificationBell';
import { Avatar } from '../ui/badges';
import { SkeletonRows } from '../ui/feedback';
import { Button } from '../ui/Button';
import { Menu, MenuItem } from '../ui/Menu';
import { CreateWorkItemModal } from '../workItems/CreateWorkItemModal';

export function AppShell() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <main className="min-h-0 flex-1">
        <Suspense fallback={<SkeletonRows className="mx-auto max-w-6xl p-6" />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

function TopNav() {
  const user = useCurrentUser();
  const [creating, setCreating] = useState(false);

  const links = [
    { to: '/', label: 'Your work', end: true },
    { to: '/projects', label: 'Projects', end: false },
    { to: '/work-items', label: 'Work items', end: false },
    ...(user.role === 'ADMIN' ? [{ to: '/admin/users', label: 'Users', end: false }] : []),
  ];

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-surface px-4">
      <Link to="/" className="mr-3 flex shrink-0 items-center gap-2 font-semibold text-fg-strong">
        <span className="grid size-7 place-items-center rounded-md bg-primary text-on-primary">
          <Check className="size-4" strokeWidth={3} aria-hidden />
        </span>
        <span className="hidden sm:inline">Tracker</span>
      </Link>

      <nav aria-label="Main" className="flex min-w-0 items-center gap-1 overflow-x-auto">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              cx(
                'rounded-md px-3 py-1.5 font-medium whitespace-nowrap transition-colors',
                isActive ? 'bg-selected text-primary' : 'text-fg hover:bg-secondary',
              )
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <Button variant="primary" icon={Plus} onClick={() => setCreating(true)} className="ml-1">
        <span className="hidden sm:inline">Create</span>
      </Button>

      <div className="ml-auto flex items-center gap-1">
        <NotificationBell />
        <UserMenu />
      </div>

      <CreateWorkItemModal open={creating} onClose={() => setCreating(false)} />
    </header>
  );
}

function UserMenu() {
  const user = useCurrentUser();
  const { logout } = useAuth();

  return (
    <Menu
      align="right"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label="Account"
          className="grid size-8 place-items-center rounded-full hover:bg-secondary"
        >
          <Avatar user={user} />
        </button>
      )}
    >
      {() => (
        <>
          <div className="border-b border-border px-3 py-2">
            <p className="font-semibold text-fg-strong">{user.name}</p>
            <p className="text-xs text-fg-subtle">{user.email}</p>
            <p className="mt-1 text-xs text-fg-subtle">{ROLE_LABELS[user.role]}</p>
          </div>
          <MenuItem onSelect={logout}>
            <LogOut className="size-4" aria-hidden /> Log out
          </MenuItem>
        </>
      )}
    </Menu>
  );
}
