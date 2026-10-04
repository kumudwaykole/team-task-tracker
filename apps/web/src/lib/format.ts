import type { Status } from '../api/types';
import { FINAL_STATUSES } from './labels';

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

/** "2 hours ago", "in 3 days". Show the absolute date in a `title` next to it. */
export function timeAgo(iso: string) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

export const formatDate = (iso: string) => dateFormat.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));

/** ISO -> value for <input type="datetime-local"> (local time, minute precision). */
export function toLocalInput(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/** <input type="datetime-local"> value -> ISO (null when empty). */
export const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

export const isOverdue = (item: { dueDate: string | null; status: Status }) =>
  !!item.dueDate && new Date(item.dueDate) < new Date() && !FINAL_STATUSES.includes(item.status);

export const pluralize = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`;
