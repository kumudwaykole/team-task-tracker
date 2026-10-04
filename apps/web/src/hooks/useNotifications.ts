import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Params } from '../api/client';
import { notificationsApi } from '../api/notifications';
import type { Notification, NotificationMeta, Paginated } from '../api/types';
import { errorMessage } from '../lib/errors';

type NotificationPage = Paginated<Notification, NotificationMeta>;

/** Bell badge. Seeded by list responses and updated by socket events, so it rarely refetches. */
export function useUnreadCount() {
  return useQuery({
    queryKey: ['unreadCount'],
    queryFn: ({ signal }) => notificationsApi.unreadCount(signal),
    staleTime: 60_000,
  });
}

export function useNotificationList(params: Params, enabled = true) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: async ({ signal }) => {
      const page = await notificationsApi.list(params, signal);
      // The list carries the unread count, so the badge needs no separate request.
      queryClient.setQueryData(['unreadCount'], { count: page.meta.unreadCount });
      return page;
    },
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Marks one as read immediately in every cached list and in the badge; rolls back on error. */
export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const lists = queryClient.getQueriesData<NotificationPage>({ queryKey: ['notifications'] });
      const badge = queryClient.getQueryData<{ count: number }>(['unreadCount']);
      const wasUnread = lists.some(([, page]) =>
        page?.data.some((item) => item.id === id && !item.isRead),
      );

      queryClient.setQueriesData<NotificationPage>(
        { queryKey: ['notifications'] },
        (page) =>
          page && {
            ...page,
            data: page.data.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
          },
      );
      if (badge && wasUnread) {
        queryClient.setQueryData(['unreadCount'], { count: Math.max(0, badge.count - 1) });
      }
      return { lists, badge };
    },
    onError: (error, _id, context) => {
      context?.lists.forEach(([key, page]: [QueryKey, NotificationPage | undefined]) =>
        queryClient.setQueryData(key, page),
      );
      if (context?.badge) queryClient.setQueryData(['unreadCount'], context.badge);
      toast.error(errorMessage(error));
    },
    onSuccess: ({ unreadCount }) =>
      queryClient.setQueryData(['unreadCount'], { count: unreadCount }),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: ({ unreadCount }) => {
      queryClient.setQueryData(['unreadCount'], { count: unreadCount });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['summary'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}
