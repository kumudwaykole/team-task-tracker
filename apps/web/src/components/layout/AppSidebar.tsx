import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  Check,
  ChevronRight,
  ChevronsUpDown,
  FolderKanban,
  House,
  ListTodo,
  LogOut,
  Plus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/shadcn/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from '@/components/shadcn/sidebar';
import { projectsApi } from '../../api/projects';
import type { Project } from '../../api/types';
import { useAuth, useCurrentUser } from '../../context/AuthContext';
import { useUnreadCount } from '../../hooks/useNotifications';
import { ROLE_LABELS } from '../../lib/labels';
import { CreateProjectModal } from '../projects/CreateProjectModal';
import { Avatar } from '../ui/badges';

// Same key as the project picker in the Create modal, so both share one cached request.
const SIDEBAR_PROJECTS = { limit: 100, sortBy: 'name', order: 'asc' } as const;

// Menu items: a little larger than shadcn's default to match the 15px page text, and the
// selected item in the app's selection colours.
const ITEM = 'text-[0.93rem] data-[active=true]:bg-selected data-[active=true]:text-primary';

// A colour per project, from the token palette, so projects are easy to tell apart.
const PROJECT_COLOURS = [
  'bg-primary/20 text-primary',
  'bg-purple/20 text-purple',
  'bg-teal/20 text-teal',
  'bg-orange/20 text-orange',
  'bg-success/20 text-success',
  'bg-warning/20 text-warning',
];
const colourOf = (id: string) => {
  const hash = [...id].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  return PROJECT_COLOURS[hash % PROJECT_COLOURS.length];
};
/** "Project Alpha" -> "PA", "Website" -> "WE". */
const initialsOf = (name: string) => {
  const words = name.trim().split(/\s+/);
  const letters = words.length > 1 ? `${words[0]?.[0]}${words[1]?.[0]}` : name.slice(0, 2);
  return letters.toUpperCase();
};

/** Collapsible app navigation: workspace pages with the user's projects, admin, the account. */
export function AppSidebar() {
  const user = useCurrentUser();
  const { pathname } = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const unread = useUnreadCount().data?.count ?? 0;

  // On a phone the sidebar is a sheet over the page: close it once a link is followed.
  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/" onClick={closeOnMobile}>
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-on-primary">
                  <Check className="size-5" strokeWidth={3} aria-hidden />
                </span>
                <span className="grid leading-tight">
                  <span className="font-semibold text-fg-strong">Tracker</span>
                  <span className="text-xs text-fg-subtle">Tasks and tickets</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarMenu>
            <NavItem
              to="/"
              icon={House}
              label="Your work"
              active={pathname === '/'}
              onClick={closeOnMobile}
            />
            <ProjectsMenu pathname={pathname} onNavigate={closeOnMobile} />
            <NavItem
              to="/work-items"
              icon={ListTodo}
              label="Work items"
              active={pathname.startsWith('/work-items')}
              onClick={closeOnMobile}
            />
            <NavItem
              to="/notifications"
              icon={Bell}
              label="Notifications"
              active={pathname.startsWith('/notifications')}
              onClick={closeOnMobile}
              badge={unread}
            />
          </SidebarMenu>
        </SidebarGroup>

        {user.role === 'ADMIN' && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarMenu>
              <NavItem
                to="/admin/users"
                icon={Users}
                label="Users"
                active={pathname.startsWith('/admin/users')}
                onClick={closeOnMobile}
              />
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <AccountMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function NavItem({
  to,
  icon: Icon,
  label,
  active,
  onClick,
  badge = 0,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={label} className={ITEM}>
        <Link to={to} onClick={onClick}>
          <Icon />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
      {badge > 0 && (
        <SidebarMenuBadge className="rounded-full bg-danger text-on-primary peer-data-[active=true]/menu-button:text-on-primary">
          {badge > 99 ? '99+' : badge}
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
}

/** "Projects", with the user's projects in a dropdown under it. */
function ProjectsMenu({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const user = useCurrentUser();
  const { state, isMobile } = useSidebar();
  const [creating, setCreating] = useState(false);
  const projects = useQuery({
    queryKey: ['projects', SIDEBAR_PROJECTS],
    queryFn: ({ signal }) => projectsApi.list(SIDEBAR_PROJECTS, signal),
  });

  // Collapsed to icons there is no room for the list: the icon opens the projects page.
  if (state === 'collapsed' && !isMobile) {
    return (
      <NavItem
        to="/projects"
        icon={FolderKanban}
        label="Projects"
        active={pathname.startsWith('/projects')}
        onClick={onNavigate}
      />
    );
  }

  return (
    <Collapsible asChild defaultOpen className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip="Projects" className={ITEM}>
            <FolderKanban />
            <span>Projects</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {projects.isPending ? (
              Array.from({ length: 3 }, (_, index) => (
                <SidebarMenuSubItem key={index}>
                  <SidebarMenuSkeleton showIcon />
                </SidebarMenuSubItem>
              ))
            ) : projects.isError ? (
              <li className="px-2 py-1 text-xs text-danger">Could not load projects</li>
            ) : projects.data.data.length === 0 ? (
              <li className="px-2 py-1 text-xs text-fg-subtle">No projects yet</li>
            ) : (
              projects.data.data.map((project) => (
                <ProjectLink
                  key={project.id}
                  project={project}
                  active={pathname.startsWith(`/projects/${project.id}`)}
                  onNavigate={onNavigate}
                />
              ))
            )}
            <SidebarMenuSubItem>
              <SidebarMenuSubButton asChild isActive={pathname === '/projects'} className={ITEM}>
                <Link to="/projects" onClick={onNavigate}>
                  <span className="text-fg-subtle">View all projects</span>
                </Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
            {user.role !== 'MEMBER' && (
              <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild className={ITEM}>
                  <button type="button" onClick={() => setCreating(true)} className="w-full">
                    <Plus className="text-fg-subtle" />
                    <span className="text-fg-subtle">New project</span>
                  </button>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )}
          </SidebarMenuSub>
        </CollapsibleContent>
        <CreateProjectModal open={creating} onClose={() => setCreating(false)} />
      </SidebarMenuItem>
    </Collapsible>
  );
}

function ProjectLink({
  project,
  active,
  onNavigate,
}: {
  project: Project;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild isActive={active} className={ITEM}>
        <Link to={`/projects/${project.id}/board`} onClick={onNavigate} title={project.name}>
          <span
            className={`grid size-5 shrink-0 place-items-center rounded-sm text-[9px] font-bold ${colourOf(project.id)}`}
            aria-hidden
          >
            {initialsOf(project.name)}
          </span>
          <span>{project.name}</span>
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

/** The signed-in user, with log out. */
function AccountMenu() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const { isMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label="Account"
              className="data-[state=open]:bg-sidebar-accent"
            >
              <Avatar user={user} />
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate font-semibold text-fg-strong">{user.name}</span>
                <span className="truncate text-xs text-fg-subtle">{ROLE_LABELS[user.role]}</span>
              </span>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={8}
            className="min-w-56"
          >
            <DropdownMenuLabel className="font-normal">
              <p className="font-semibold text-fg-strong">{user.name}</p>
              <p className="text-xs text-fg-subtle">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={logout}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
