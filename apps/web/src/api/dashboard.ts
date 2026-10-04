import { api } from './client';
import type { Summary } from './types';

export const dashboardApi = {
  summary: (signal?: AbortSignal) => api.get<Summary>('/dashboard/summary', undefined, signal),
};
