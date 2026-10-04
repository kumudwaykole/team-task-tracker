import { api, type Params } from './client';
import type { Notification, NotificationMeta } from './types';

export const notificationsApi = {
  /** `meta.unreadCount` carries the badge number, so the bell needs no extra request. */
  list: (params: Params, signal?: AbortSignal) =>
    api.page<Notification, NotificationMeta>('/notifications', params, signal),
  unreadCount: (signal?: AbortSignal) =>
    api.get<{ count: number }>('/notifications/unread-count', undefined, signal),
  markRead: (id: string) =>
    api.patch<{ id: string; isRead: true; unreadCount: number }>(`/notifications/${id}/read`),
  markAllRead: () => api.patch<{ updated: number; unreadCount: number }>('/notifications/read-all'),
};
