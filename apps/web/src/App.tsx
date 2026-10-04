import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, type CSSProperties } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { isApiError } from './api/client';
import { AppShell } from './components/layout/AppShell';
import { ProjectLayout } from './components/layout/ProjectLayout';
import { ProtectedRoute, PublicOnlyRoute } from './components/layout/routeGuards';
import { ErrorState } from './components/ui/ErrorState';
import { AuthSkeleton } from './components/ui/skeletons';
import { AuthProvider } from './context/AuthProvider';
import { SocketProvider } from './context/SocketProvider';

// Each page is its own chunk, loaded when first visited.
const AdminUsersPage = lazy(() =>
  import('./pages/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })),
);
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const NotificationsPage = lazy(() =>
  import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
);
const ProjectBoardPage = lazy(() =>
  import('./pages/ProjectBoardPage').then((m) => ({ default: m.ProjectBoardPage })),
);
const ProjectListPage = lazy(() =>
  import('./pages/ProjectListPage').then((m) => ({ default: m.ProjectListPage })),
);
const ProjectMembersPage = lazy(() =>
  import('./pages/ProjectMembersPage').then((m) => ({ default: m.ProjectMembersPage })),
);
const ProjectsPage = lazy(() =>
  import('./pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })),
);
const RegisterPage = lazy(() =>
  import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })),
);
const WorkItemDetailPage = lazy(() =>
  import('./pages/WorkItemDetailPage').then((m) => ({ default: m.WorkItemDetailPage })),
);
const WorkItemsPage = lazy(() =>
  import('./pages/WorkItemsPage').then((m) => ({ default: m.WorkItemsPage })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retry only network failures and 5xx; a 4xx will not change by retrying.
      retry: (count, error) =>
        count < 2 && (!isApiError(error) || error.status === 0 || error.status >= 500),
      refetchOnWindowFocus: true,
    },
  },
});

// Toasts use the same colour tokens as the rest of the app.
const toasterStyle = {
  '--normal-bg': 'var(--color-raised)',
  '--normal-border': 'var(--color-border)',
  '--normal-text': 'var(--color-fg-strong)',
} as CSSProperties;

export function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SocketProvider>
            {/* Only the login and register pages load here; the app shell has its own fallback. */}
            <Suspense fallback={<AuthSkeleton />}>
              <Routes>
                <Route element={<PublicOnlyRoute />}>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                </Route>

                <Route element={<ProtectedRoute />}>
                  <Route element={<AppShell />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="projects" element={<ProjectsPage />} />
                    <Route path="projects/:projectId" element={<ProjectLayout />}>
                      <Route index element={<Navigate to="board" replace />} />
                      <Route path="board" element={<ProjectBoardPage />} />
                      <Route path="list" element={<ProjectListPage />} />
                      <Route path="members" element={<ProjectMembersPage />} />
                    </Route>
                    <Route path="work-items" element={<WorkItemsPage />} />
                    <Route path="work-items/:id" element={<WorkItemDetailPage />} />
                    <Route path="notifications" element={<NotificationsPage />} />
                    <Route
                      path="admin/users"
                      element={
                        <ProtectedRoute roles={['ADMIN']}>
                          <AdminUsersPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="403" element={<ErrorState kind="forbidden" />} />
                    <Route path="*" element={<ErrorState kind="not-found" />} />
                  </Route>
                </Route>
              </Routes>
            </Suspense>
            <Toaster theme="dark" position="bottom-right" style={toasterStyle} closeButton />
          </SocketProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
