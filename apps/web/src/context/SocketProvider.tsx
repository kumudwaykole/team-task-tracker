import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { io, type Socket } from 'socket.io-client';
import { tokenStore } from '../api/client';
import type { Notification } from '../api/types';
import { useAuth } from './AuthContext';

interface ServerToClientEvents {
  'notification:new': (payload: { notification: Notification; unreadCount: number }) => void;
  'notification:count': (payload: { unreadCount: number }) => void;
  'notification:updated': (payload: { ids: string[] | 'all'; unreadCount: number }) => void;
}

/**
 * Keeps one authenticated Socket.IO connection while logged in, and turns server events into
 * cache updates: the badge count is set directly, related queries are refetched, and a toast is shown.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const userId = user?.id;

  // Read the latest navigate/logout without reconnecting the socket when they change.
  const showToast = useEffectEvent((notification: Notification) => {
    const itemId = notification.workItemId;
    toast(notification.message, {
      ...(itemId && {
        action: { label: 'View', onClick: () => navigate(`/work-items/${itemId}`) },
      }),
    });
  });
  const onAuthFailure = useEffectEvent(() => logout());

  useEffect(() => {
    if (!userId) return;

    const setUnreadCount = (count: number) => queryClient.setQueryData(['unreadCount'], { count });
    const refetch = (queryKey: string[]) => void queryClient.invalidateQueries({ queryKey });

    // Same origin; the token is read on every (re)connect, so it is always the current one.
    const socket: Socket<ServerToClientEvents> = io({
      auth: (send) => send({ token: tokenStore.get() }),
      transports: ['websocket'],
    });

    socket.on('notification:new', ({ notification, unreadCount }) => {
      setUnreadCount(unreadCount);
      refetch(['notifications']);
      refetch(['summary']);
      const itemId = notification.workItemId;
      if (itemId) {
        // An open issue page, list or board updates live when someone else changes the item.
        refetch(['workItem', itemId]);
        refetch(['comments', itemId]);
        refetch(['workItems']);
        refetch(['board']);
      }
      showToast(notification);
    });
    socket.on('notification:count', ({ unreadCount }) => setUnreadCount(unreadCount));
    socket.on('notification:updated', ({ unreadCount }) => {
      setUnreadCount(unreadCount);
      refetch(['notifications']);
    });
    // Catch up on anything missed while disconnected.
    socket.on('connect', () => refetch(['notifications']));
    // The server disconnects when the token expires; reconnecting then fails auth and logs out.
    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') socket.connect();
    });
    socket.on('connect_error', (error) => {
      if (error.message === 'UNAUTHENTICATED') onAuthFailure();
    });

    return () => {
      socket.disconnect();
    };
  }, [userId, queryClient]);

  return children;
}
