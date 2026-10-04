import { api, type Params } from './client';
import type { Role, User } from './types';

export const usersApi = {
  list: (params: Params, signal?: AbortSignal) => api.page<User>('/users', params, signal),
  create: (body: { name: string; email: string; password: string; role: Role }) =>
    api.post<User>('/users', body),
  changeRole: (id: string, role: Role) => api.patch<User>(`/users/${id}/role`, { role }),
};
