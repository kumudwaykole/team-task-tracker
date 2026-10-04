import { isApiError } from '../api/client';

// Codes whose server message is too technical for a toast. Most API messages are already
// written for users (they name the field, the count, the allowed moves), so they are shown as is.
const FRIENDLY: Record<string, string> = {
  VALIDATION_ERROR: 'Please check the highlighted fields.',
  STALE_STATE: 'Someone else changed this item. Reload to see the latest version.',
  RATE_LIMITED: 'Too many requests. Wait a moment and try again.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again.',
};

/** A message to show the user for any thrown value. */
export function errorMessage(error: unknown) {
  if (isApiError(error)) return FRIENDLY[error.code] ?? error.message;
  return 'Something went wrong. Please try again.';
}

/** Field errors from a VALIDATION_ERROR response, keyed by field path. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!isApiError(error) || !Array.isArray(error.details)) return {};
  const result: Record<string, string> = {};
  for (const issue of error.details as { path?: string; message?: string }[]) {
    if (issue.path && issue.message && !result[issue.path]) result[issue.path] = issue.message;
  }
  return result;
}

export const hasCode = (error: unknown, code: string) => isApiError(error) && error.code === code;
