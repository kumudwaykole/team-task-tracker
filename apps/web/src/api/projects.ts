import { api, type Params } from './client';
import type { Board, Project, ProjectMember } from './types';

export const projectsApi = {
  list: (params: Params, signal?: AbortSignal) => api.page<Project>('/projects', params, signal),
  get: (id: string, signal?: AbortSignal) => api.get<Project>(`/projects/${id}`, undefined, signal),
  create: (body: { name: string; managerId?: string }) => api.post<Project>('/projects', body),
  update: (id: string, body: { name?: string; managerId?: string }) =>
    api.patch<Project>(`/projects/${id}`, body),
  remove: (id: string) => api.delete(`/projects/${id}`),

  members: (id: string, params: Params, signal?: AbortSignal) =>
    api.page<ProjectMember>(`/projects/${id}/members`, params, signal),
  addMembers: (id: string, userIds: string[]) =>
    api.post<{ added: number }>(`/projects/${id}/members`, { userIds }),
  removeMember: (id: string, userId: string) => api.delete(`/projects/${id}/members/${userId}`),

  board: (id: string, params: Params, signal?: AbortSignal) =>
    api.get<Board>(`/projects/${id}/board`, params, signal),
};
