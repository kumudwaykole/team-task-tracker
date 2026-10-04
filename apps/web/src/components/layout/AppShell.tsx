import { Plus } from 'lucide-react';
import { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Separator } from '@/components/shadcn/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/shadcn/sidebar';
import { NotificationBell } from '../notifications/NotificationBell';
import { Button } from '../ui/Button';
import { PageSkeleton } from '../ui/skeletons';
import { CreateWorkItemModal } from '../workItems/CreateWorkItemModal';
import { AppSidebar } from './AppSidebar';

/** The sidebar saves open/closed in a cookie when toggled (Ctrl/Cmd+B too); read it on load. */
const sidebarWasOpen = () => !document.cookie.split('; ').includes('sidebar_state=false');

export function AppShell() {
  const [defaultOpen] = useState(sidebarWasOpen);

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <TopBar />
        {/* A block wrapper: in the flex column, centred pages (mx-auto) would shrink to their content. */}
        <div className="min-w-0 flex-1">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function TopBar() {
  const [creating, setCreating] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-canvas/90 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1 text-fg-subtle hover:text-fg-strong" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-5" />
      <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
        Create
      </Button>
      <div className="ml-auto flex items-center gap-1">
        <NotificationBell />
      </div>
      <CreateWorkItemModal open={creating} onClose={() => setCreating(false)} />
    </header>
  );
}
