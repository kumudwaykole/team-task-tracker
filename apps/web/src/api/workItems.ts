import { api, type Params } from './client';
import type { Priority, Status, WorkItem, WorkItemDetail, WorkItemType } from './types';

export interface CreateWorkItemBody {
  type: WorkItemType;
  title: string;
  description: string;
  priority: Priority;
  projectId?: string;
  assigneeId?: string;
  dueDate?: string;
}

export interface UpdateWorkItemBody {
  title?: string;
  description?: string;
  priority?: Priority;
  status?: Status;
  assigneeId?: string | null;
  dueDate?: string | null;
}

export const workItemsApi = {
  list: (params: Params, signal?: AbortSignal) => api.page<WorkItem>('/work-items', params, signal),
  get: (id: string, signal?: AbortSignal) =>
    api.get<WorkItemDetail>(`/work-items/${id}`, undefined, signal),
  create: (body: CreateWorkItemBody) => api.post<WorkItemDetail>('/work-items', body),
  update: (id: string, body: UpdateWorkItemBody) =>
    api.patch<WorkItemDetail>(`/work-items/${id}`, body),
  remove: (id: string) => api.delete(`/work-items/${id}`),
};
