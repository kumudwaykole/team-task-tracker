import { api } from './client';
import type { User } from './types';

interface AuthResult {
  token: string;
  user: User;
}

export const authApi = {
  login: (body: { email: string; password: string }) => api.post<AuthResult>('/auth/login', body),
  register: (body: { name: string; email: string; password: string }) =>
    api.post<AuthResult>('/auth/register', body),
  me: (signal?: AbortSignal) => api.get<User>('/auth/me', undefined, signal),
};
