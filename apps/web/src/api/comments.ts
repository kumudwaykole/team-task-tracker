import { api, type Params } from './client';
import type { Comment } from './types';

export const commentsApi = {
  list: (workItemId: string, params: Params, signal?: AbortSignal) =>
    api.page<Comment>(`/work-items/${workItemId}/comments`, params, signal),
  create: (workItemId: string, body: string) =>
    api.post<Comment>(`/work-items/${workItemId}/comments`, { body }),
};
