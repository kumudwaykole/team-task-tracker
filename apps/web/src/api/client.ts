import axios, { isCancel } from 'axios';
import type { Paginated } from './types';

const TOKEN_KEY = 'tracker.token';

/** The JWT lives in localStorage (trade-off documented in DESIGN.md) and in memory via AuthProvider. */
export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** Every failed request becomes one of these, built from the API's standard error shape. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

// Same origin as the page, so there is no CORS and no API URL to configure.
const http = axios.create({ baseURL: '/api' });

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized: (() => void) | null = null;

/** AuthProvider registers its logout here, so any 401 (expired or revoked token) ends the session. */
export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  onUnauthorized = handler;
};

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    // Cancelled requests (React Query aborting a stale query) are not errors to report.
    if (isCancel(error) || !axios.isAxiosError(error)) return Promise.reject(error);

    const body = error.response?.data as
      { error?: { code?: string; message?: string; details?: unknown } } | undefined;
    const status = error.response?.status ?? 0;
    const apiError = new ApiError(
      status,
      body?.error?.code ?? (status === 0 ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR'),
      body?.error?.message ?? (status === 0 ? 'Cannot reach the server' : 'Something went wrong'),
      body?.error?.details,
    );

    const url = error.config?.url ?? '';
    if (status === 401 && !url.startsWith('/auth/login') && !url.startsWith('/auth/register')) {
      onUnauthorized?.();
    }
    return Promise.reject(apiError);
  },
);

type ParamValue = string | number | boolean | string[] | null | undefined;
export type Params = Record<string, ParamValue>;

/** Drops empty values and joins arrays with commas (`status=TODO,DONE`), as the API expects. */
function toQuery(params?: Params) {
  const query: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) query[key] = value.join(',');
    } else {
      query[key] = value;
    }
  }
  return query;
}

interface Envelope<T, M> {
  success: true;
  data: T;
  meta: M;
}

export const api = {
  get: async <T>(url: string, params?: Params, signal?: AbortSignal) =>
    (await http.get<Envelope<T, undefined>>(url, { params: toQuery(params), signal })).data.data,

  /** A list endpoint: returns `{ data, meta }`. */
  page: async <T, M = Paginated<T>['meta']>(url: string, params?: Params, signal?: AbortSignal) => {
    const { data } = await http.get<Envelope<T[], M>>(url, { params: toQuery(params), signal });
    return { data: data.data, meta: data.meta };
  },

  post: async <T>(url: string, body?: unknown) =>
    (await http.post<Envelope<T, undefined>>(url, body)).data.data,

  patch: async <T>(url: string, body?: unknown) =>
    (await http.patch<Envelope<T, undefined>>(url, body)).data.data,

  delete: async (url: string) => {
    await http.delete(url);
  },
};
