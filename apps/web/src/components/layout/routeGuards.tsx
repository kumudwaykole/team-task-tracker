import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation, type Location } from 'react-router-dom';
import type { Role } from '../../api/types';
import { useAuth } from '../../context/AuthContext';
import { ErrorState } from '../ui/ErrorState';
import { AppShellSkeleton, AuthSkeleton } from '../ui/skeletons';

/**
 * Requires a logged-in user, and optionally one of `roles`. This is for usability only:
 * the API enforces every rule again.
 */
export function ProtectedRoute({ roles, children }: { roles?: Role[]; children?: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AppShellSkeleton />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) return <ErrorState kind="forbidden" />;
  return children ?? <Outlet />;
}

/** Login and register: a logged-in user goes back to where they came from (or home). */
export function PublicOnlyRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthSkeleton />;
  if (user) {
    const from = (location.state as { from?: Location } | null)?.from;
    return <Navigate to={from ? `${from.pathname}${from.search}` : '/'} replace />;
  }
  return <Outlet />;
}
