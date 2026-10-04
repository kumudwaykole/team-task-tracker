import {
  ChevronDown,
  ChevronsUp,
  ChevronUp,
  Equal,
  SquareCheckBig,
  Ticket,
  type LucideIcon,
} from 'lucide-react';
import type { Priority, Status, WorkItemType } from '../../api/types';

/** Status lozenges (tinted background, as in Jira). */
export const STATUS_STYLES: Record<Status, string> = {
  TODO: 'bg-secondary text-fg-strong',
  OPEN: 'bg-secondary text-fg-strong',
  IN_PROGRESS: 'bg-primary/20 text-primary',
  IN_REVIEW: 'bg-purple/20 text-purple',
  ESCALATED: 'bg-orange/20 text-orange',
  RESOLVED: 'bg-teal/20 text-teal',
  DONE: 'bg-success/20 text-success',
  CLOSED: 'bg-success/20 text-success',
};

export const PRIORITY_STYLES: Record<Priority, { icon: LucideIcon; className: string }> = {
  URGENT: { icon: ChevronsUp, className: 'text-danger' },
  HIGH: { icon: ChevronUp, className: 'text-orange' },
  MEDIUM: { icon: Equal, className: 'text-warning' },
  LOW: { icon: ChevronDown, className: 'text-primary' },
};

export const TYPE_STYLES: Record<WorkItemType, { icon: LucideIcon; className: string }> = {
  TASK: { icon: SquareCheckBig, className: 'text-primary' },
  TICKET: { icon: Ticket, className: 'text-orange' },
};

/** Avatar colours, picked by hashing the user id. */
export const AVATAR_STYLES = [
  'bg-primary/25 text-primary',
  'bg-purple/25 text-purple',
  'bg-teal/25 text-teal',
  'bg-orange/25 text-orange',
  'bg-success/25 text-success',
  'bg-warning/25 text-warning',
];
