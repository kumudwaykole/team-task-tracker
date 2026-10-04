import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi } from '../api/auth';
import { setUnauthorizedHandler, tokenStore } from '../api/client';
import type { User } from '../api/types';
import { AuthContext, type AuthState } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(() => tokenStore.get() !== null);

  const startSession = useCallback(
    ({ token, user: loggedIn }: { token: string; user: User }) => {
      tokenStore.set(token);
      queryClient.clear();
      setUser(loggedIn);
    },
    [queryClient],
  );

  // Clearing the user makes <ProtectedRoute> redirect to /login.
  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    // Drop every cached response so one user's data never shows for the next.
    queryClient.clear();
  }, [queryClient]);

  // Any 401 from the API (expired, revoked, or deleted user) ends the session.
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // Restore the session on page load: the token proves identity, /auth/me returns the current role.
  useEffect(() => {
    if (!tokenStore.get()) return;
    const controller = new AbortController();
    authApi
      .me(controller.signal)
      .then(setUser)
      .catch(() => {
        if (!controller.signal.aborted) tokenStore.clear();
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isLoading,
      login: async (email, password) => startSession(await authApi.login({ email, password })),
      register: async (input) => startSession(await authApi.register(input)),
      logout,
    }),
    [user, isLoading, startSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
