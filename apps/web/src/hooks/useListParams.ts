import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

type Change = string | number | string[] | null | undefined;

/**
 * List state (page, search, filters, sort) kept in the URL, so refresh and the back button work.
 * Any change that does not set `page` resets to page 1.
 */
export function useListParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const get = useCallback((key: string) => searchParams.get(key) ?? undefined, [searchParams]);

  /** Comma-separated values, e.g. `status=TODO,IN_PROGRESS`. */
  const getList = useCallback(
    (key: string) => searchParams.get(key)?.split(',').filter(Boolean) ?? [],
    [searchParams],
  );

  const update = useCallback(
    (changes: Record<string, Change>) => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(changes)) {
          const text = Array.isArray(value) ? value.join(',') : value;
          if (text === undefined || text === null || text === '') next.delete(key);
          else next.set(key, String(text));
        }
        if (!('page' in changes)) next.delete('page');
        if (next.get('page') === '1') next.delete('page');
        return next;
      });
    },
    [setSearchParams],
  );

  /** The whole query string: a stable key for memoising derived query params. */
  const search = searchParams.toString();

  return useMemo(
    () => ({ page, get, getList, update, search }),
    [page, get, getList, update, search],
  );
}
