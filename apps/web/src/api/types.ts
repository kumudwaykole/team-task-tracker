export type Role = 'ADMIN' | 'MANAGER' | 'MEMBER';
export type WorkItemType = 'TASK' | 'TICKET';
export type Status =
  'TODO' | 'OPEN' | 'IN_PROGRESS' | 'IN_REVIEW' | 'ESCALATED' | 'RESOLVED' | 'CLOSED' | 'DONE';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type NotificationType =
  'ASSIGNED' | 'STATUS_CHANGED' | 'COMMENTED' | 'TICKET_CREATED' | 'DUE_SOON';
export type SortOrder = 'asc' | 'desc';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Paginated<T, M extends PageMeta = PageMeta> {
  data: T[];
  meta: M;
}

export interface UserRef {
  id: string;
  name: string;
}

export interface User extends UserRef {
  email: string;
  role: Role;
  createdAt?: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  manager: UserRef;
  _count: { members: number; workItems: number };
}

export interface ProjectMember extends User {
  addedAt: string;
}

export interface Permissions {
  canEdit: boolean;
  canChangeStatus: boolean;
  canAssign: boolean;
  canDelete: boolean;
  canComment: boolean;
}

export interface WorkItem {
  id: string;
  number: number;
  type: WorkItemType;
  title: string;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string } | null;
  requester: UserRef;
  assignee: UserRef | null;
  permissions: Permissions;
  allowedTransitions: Status[];
}

export interface WorkItemDetail extends WorkItem {
  description: string;
  _count: { comments: number };
}

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  user: UserRef;
}

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  workItemId: string | null;
  isRead: boolean;
  createdAt: string;
  /** Only in the Admin "all users" view. */
  user?: UserRef;
}

export interface NotificationMeta extends PageMeta {
  unreadCount: number;
}

export interface BoardColumn {
  status: Status;
  total: number;
  items: WorkItem[];
}

export interface Board {
  type: WorkItemType;
  columns: BoardColumn[];
}

export interface Summary {
  assignedToMe: Partial<Record<Status, number>>;
  overdue: number;
  dueSoon: number;
  raisedByMe: { open: number; closed: number };
  unreadNotifications: number;
  projects: number;
}
