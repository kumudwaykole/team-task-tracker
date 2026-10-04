import type { Response } from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { api } from './helpers/auth.js';
import { buildWorld, hoursFromNow, type World } from './helpers/factories.js';

type Who = keyof World['users'] | 'anonymous';
type Method = 'get' | 'post' | 'patch' | 'delete';

interface Case {
  /** What the row proves; shown as the test name. */
  rule: string;
  who: Who;
  method: Method;
  url: (w: World) => string;
  body?: (w: World) => object;
  status: number;
  /** Expected `error.code`, for rejections. */
  code?: string;
  /** Extra assertions on the response. */
  check?: (res: Response, w: World) => void;
}

const ids = (res: Response) => (res.body.data as { id: string }[]).map((row) => row.id);
const taskIn = (projectId: string, extra: object = {}) => ({
  type: 'TASK',
  title: 'Matrix task',
  description: 'Created by the RBAC matrix',
  projectId,
  ...extra,
});
const ticket = (extra: object = {}) => ({
  type: 'TICKET',
  title: 'Matrix ticket',
  description: 'Raised by the RBAC matrix',
  ...extra,
});
const newUser = { name: 'New Person', email: 'new.person@example.com', password: 'Password@123' };

// One row per rule in the permission matrix. Cast (see buildWorld):
// projectA = manager1 + member1, member2   projectB = manager2 + member3   member4 = no project
// taskA (A) -> member1   ticketA (A) raised by member2 -> member1   looseTicket raised by member4
const cases: Case[] = [
  // ---------- Authentication
  {
    rule: 'protected routes need a token',
    who: 'anonymous',
    method: 'get',
    url: () => '/api/work-items',
    status: 401,
    code: 'UNAUTHENTICATED',
  },
  {
    rule: 'dashboard needs a token',
    who: 'anonymous',
    method: 'get',
    url: () => '/api/dashboard/summary',
    status: 401,
  },
  {
    rule: 'any role reads its dashboard',
    who: 'member1',
    method: 'get',
    url: () => '/api/dashboard/summary',
    status: 200,
  },

  // ---------- Projects
  {
    rule: 'Member cannot create a project',
    who: 'member1',
    method: 'post',
    url: () => '/api/projects',
    body: () => ({ name: 'Nope' }),
    status: 403,
    code: 'FORBIDDEN',
  },
  {
    rule: 'Manager creates a project and becomes its manager',
    who: 'manager1',
    method: 'post',
    url: () => '/api/projects',
    body: (w) => ({ name: 'Mine', managerId: w.users.manager2.id }),
    status: 201,
    check: (res, w) => expect(res.body.data.manager.id).toBe(w.users.manager1.id),
  },
  {
    rule: 'Admin creates a project for a Manager',
    who: 'admin',
    method: 'post',
    url: () => '/api/projects',
    body: (w) => ({ name: 'For M2', managerId: w.users.manager2.id }),
    status: 201,
  },
  {
    rule: 'Manager lists only own projects',
    who: 'manager1',
    method: 'get',
    url: () => '/api/projects',
    status: 200,
    check: (res, w) => expect(ids(res)).toEqual([w.projectA.id]),
  },
  {
    rule: 'Member lists only joined projects',
    who: 'member3',
    method: 'get',
    url: () => '/api/projects',
    status: 200,
    check: (res, w) => expect(ids(res)).toEqual([w.projectB.id]),
  },
  {
    rule: 'Admin lists every project',
    who: 'admin',
    method: 'get',
    url: () => '/api/projects',
    status: 200,
    check: (res) => expect(res.body.meta.total).toBe(2),
  },
  {
    rule: 'other Manager gets 404 for a project',
    who: 'manager2',
    method: 'get',
    url: (w) => `/api/projects/${w.projectA.id}`,
    status: 404,
    code: 'NOT_FOUND',
  },
  {
    rule: 'non-member Member gets 404 for a project',
    who: 'member3',
    method: 'get',
    url: (w) => `/api/projects/${w.projectA.id}`,
    status: 404,
  },
  {
    rule: 'project member reads the project',
    who: 'member1',
    method: 'get',
    url: (w) => `/api/projects/${w.projectA.id}`,
    status: 200,
  },
  {
    rule: 'Member cannot rename a project',
    who: 'member1',
    method: 'patch',
    url: (w) => `/api/projects/${w.projectA.id}`,
    body: () => ({ name: 'Renamed' }),
    status: 403,
  },
  {
    rule: 'other Manager cannot rename a project (404)',
    who: 'manager2',
    method: 'patch',
    url: (w) => `/api/projects/${w.projectA.id}`,
    body: () => ({ name: 'Renamed' }),
    status: 404,
  },
  {
    rule: 'owning Manager renames the project',
    who: 'manager1',
    method: 'patch',
    url: (w) => `/api/projects/${w.projectA.id}`,
    body: () => ({ name: 'Renamed' }),
    status: 200,
  },
  {
    rule: 'only an Admin changes the project manager',
    who: 'manager1',
    method: 'patch',
    url: (w) => `/api/projects/${w.projectA.id}`,
    body: (w) => ({ managerId: w.users.manager2.id }),
    status: 403,
  },
  {
    rule: 'Admin changes the project manager',
    who: 'admin',
    method: 'patch',
    url: (w) => `/api/projects/${w.projectA.id}`,
    body: (w) => ({ managerId: w.users.manager2.id }),
    status: 200,
  },
  {
    rule: 'a project with work items cannot be deleted',
    who: 'manager1',
    method: 'delete',
    url: (w) => `/api/projects/${w.projectA.id}`,
    status: 409,
    code: 'PROJECT_HAS_WORK_ITEMS',
  },
  {
    rule: 'other Manager cannot delete a project (404)',
    who: 'manager2',
    method: 'delete',
    url: (w) => `/api/projects/${w.projectA.id}`,
    status: 404,
  },
  {
    rule: 'project member reads the board',
    who: 'member2',
    method: 'get',
    url: (w) => `/api/projects/${w.projectA.id}/board`,
    status: 200,
  },
  {
    rule: 'outsider gets 404 for the board',
    who: 'member3',
    method: 'get',
    url: (w) => `/api/projects/${w.projectA.id}/board`,
    status: 404,
  },

  // ---------- Members
  {
    rule: 'Member cannot add project members',
    who: 'member1',
    method: 'post',
    url: (w) => `/api/projects/${w.projectA.id}/members`,
    body: (w) => ({ userIds: [w.users.member4.id] }),
    status: 403,
  },
  {
    rule: 'other Manager cannot add members (404)',
    who: 'manager2',
    method: 'post',
    url: (w) => `/api/projects/${w.projectA.id}/members`,
    body: (w) => ({ userIds: [w.users.member4.id] }),
    status: 404,
  },
  {
    rule: 'owning Manager adds a member',
    who: 'manager1',
    method: 'post',
    url: (w) => `/api/projects/${w.projectA.id}/members`,
    body: (w) => ({ userIds: [w.users.member4.id] }),
    status: 200,
    check: (res) => expect(res.body.data).toEqual({ added: 1 }),
  },
  {
    rule: 'Admin adds a member to any project',
    who: 'admin',
    method: 'post',
    url: (w) => `/api/projects/${w.projectB.id}/members`,
    body: (w) => ({ userIds: [w.users.member4.id] }),
    status: 200,
  },
  {
    rule: 'a MANAGER cannot be added as a member',
    who: 'manager1',
    method: 'post',
    url: (w) => `/api/projects/${w.projectA.id}/members`,
    body: (w) => ({ userIds: [w.users.manager2.id] }),
    status: 400,
    code: 'INVALID_MEMBER',
  },
  {
    rule: 'an ADMIN cannot be added as a member',
    who: 'manager1',
    method: 'post',
    url: (w) => `/api/projects/${w.projectA.id}/members`,
    body: (w) => ({ userIds: [w.users.admin.id] }),
    status: 400,
    code: 'INVALID_MEMBER',
  },
  {
    rule: 'a member with active work cannot be removed',
    who: 'manager1',
    method: 'delete',
    url: (w) => `/api/projects/${w.projectA.id}/members/${w.users.member1.id}`,
    status: 409,
    code: 'MEMBER_HAS_ACTIVE_WORK',
  },
  {
    rule: 'a member without active work is removed',
    who: 'manager1',
    method: 'delete',
    url: (w) => `/api/projects/${w.projectA.id}/members/${w.users.member2.id}`,
    status: 204,
  },
  {
    rule: 'Member cannot remove members',
    who: 'member1',
    method: 'delete',
    url: (w) => `/api/projects/${w.projectA.id}/members/${w.users.member2.id}`,
    status: 403,
  },

  // ---------- Work items: read
  {
    rule: 'assignee reads the item',
    who: 'member1',
    method: 'get',
    url: (w) => `/api/work-items/${w.taskA.id}`,
    status: 200,
  },
  {
    rule: 'project member reads a project item',
    who: 'member2',
    method: 'get',
    url: (w) => `/api/work-items/${w.taskA.id}`,
    status: 200,
  },
  {
    rule: 'outsider Member gets 404 for an item',
    who: 'member3',
    method: 'get',
    url: (w) => `/api/work-items/${w.taskA.id}`,
    status: 404,
    code: 'NOT_FOUND',
  },
  {
    rule: 'other Manager gets 404 for an item',
    who: 'manager2',
    method: 'get',
    url: (w) => `/api/work-items/${w.taskA.id}`,
    status: 404,
  },
  {
    rule: 'requester reads a project-less ticket',
    who: 'member4',
    method: 'get',
    url: (w) => `/api/work-items/${w.looseTicket.id}`,
    status: 200,
  },
  {
    rule: 'Manager gets 404 for an unrelated project-less ticket',
    who: 'manager1',
    method: 'get',
    url: (w) => `/api/work-items/${w.looseTicket.id}`,
    status: 404,
  },
  {
    rule: 'Admin reads a project-less ticket',
    who: 'admin',
    method: 'get',
    url: (w) => `/api/work-items/${w.looseTicket.id}`,
    status: 200,
  },
  {
    rule: 'list total never counts hidden rows',
    who: 'member3',
    method: 'get',
    url: () => '/api/work-items',
    status: 200,
    check: (res, w) => {
      expect(ids(res)).toEqual([w.taskB.id]);
      expect(res.body.meta.total).toBe(1);
    },
  },
  {
    rule: 'Member sees assigned, raised and project items',
    who: 'member2',
    method: 'get',
    url: () => '/api/work-items',
    status: 200,
    check: (res, w) => expect(ids(res).sort()).toEqual([w.taskA.id, w.ticketA.id].sort()),
  },
  {
    rule: 'filtering by an inaccessible project returns nothing',
    who: 'member3',
    method: 'get',
    url: (w) => `/api/work-items?projectId=${w.projectA.id}`,
    status: 200,
    check: (res) => expect(res.body.meta.total).toBe(0),
  },

  // ---------- Work items: create
  {
    rule: 'Member cannot create a TASK',
    who: 'member1',
    method: 'post',
    url: () => '/api/work-items',
    body: (w) => taskIn(w.projectA.id),
    status: 403,
  },
  {
    rule: 'Member raises a TICKET in a joined project',
    who: 'member1',
    method: 'post',
    url: () => '/api/work-items',
    body: (w) => ticket({ projectId: w.projectA.id }),
    status: 201,
  },
  {
    rule: 'Member raises a TICKET without a project',
    who: 'member4',
    method: 'post',
    url: () => '/api/work-items',
    body: () => ticket(),
    status: 201,
  },
  {
    rule: 'Member cannot raise a TICKET in another project (404)',
    who: 'member3',
    method: 'post',
    url: () => '/api/work-items',
    body: (w) => ticket({ projectId: w.projectA.id }),
    status: 404,
  },
  {
    rule: 'Manager creates a TASK in own project',
    who: 'manager1',
    method: 'post',
    url: () => '/api/work-items',
    body: (w) => taskIn(w.projectA.id, { assigneeId: w.users.member1.id }),
    status: 201,
  },
  {
    rule: "Manager cannot create a TASK in another Manager's project",
    who: 'manager2',
    method: 'post',
    url: () => '/api/work-items',
    body: (w) => taskIn(w.projectA.id),
    status: 404,
  },
  {
    rule: 'Admin creates a TASK in any project',
    who: 'admin',
    method: 'post',
    url: () => '/api/work-items',
    body: (w) => taskIn(w.projectB.id),
    status: 201,
  },

  // ---------- Work items: update
  {
    rule: 'assigned Member changes the status',
    who: 'member1',
    method: 'patch',
    url: (w) => `/api/work-items/${w.taskA.id}`,
    body: () => ({ status: 'IN_PROGRESS' }),
    status: 200,
  },
  {
    rule: 'assigned Member cannot change priority',
    who: 'member1',
    method: 'patch',
    url: (w) => `/api/work-items/${w.taskA.id}`,
    body: () => ({ priority: 'HIGH' }),
    status: 403,
    code: 'FORBIDDEN_FIELD',
  },
  {
    rule: 'assigned Member cannot reassign',
    who: 'member1',
    method: 'patch',
    url: (w) => `/api/work-items/${w.taskA.id}`,
    body: (w) => ({ status: 'IN_PROGRESS', assigneeId: w.users.member2.id }),
    status: 403,
    code: 'FORBIDDEN_FIELD',
  },
  {
    rule: 'non-assignee Member cannot change the status',
    who: 'member2',
    method: 'patch',
    url: (w) => `/api/work-items/${w.taskA.id}`,
    body: () => ({ status: 'IN_PROGRESS' }),
    status: 403,
    code: 'FORBIDDEN',
  },
  {
    rule: 'requester Member cannot edit their ticket',
    who: 'member2',
    method: 'patch',
    url: (w) => `/api/work-items/${w.ticketA.id}`,
    body: () => ({ title: 'Edited' }),
    status: 403,
    code: 'FORBIDDEN',
  },
  {
    rule: 'project Manager has full rights',
    who: 'manager1',
    method: 'patch',
    url: (w) => `/api/work-items/${w.taskA.id}`,
    body: (w) => ({ priority: 'URGENT', assigneeId: w.users.member2.id, title: 'Edited' }),
    status: 200,
  },
  {
    rule: 'other Manager cannot update (404)',
    who: 'manager2',
    method: 'patch',
    url: (w) => `/api/work-items/${w.taskA.id}`,
    body: () => ({ priority: 'LOW' }),
    status: 404,
  },
  {
    rule: 'Admin updates any item',
    who: 'admin',
    method: 'patch',
    url: (w) => `/api/work-items/${w.taskB.id}`,
    body: () => ({ title: 'Admin edit' }),
    status: 200,
  },

  // ---------- Assignment
  {
    rule: 'assignee outside the project is rejected (PATCH)',
    who: 'manager1',
    method: 'patch',
    url: (w) => `/api/work-items/${w.taskA.id}`,
    body: (w) => ({ assigneeId: w.users.member3.id }),
    status: 400,
    code: 'ASSIGNEE_NOT_IN_PROJECT',
  },
  {
    rule: 'assignee outside the project is rejected (POST)',
    who: 'manager1',
    method: 'post',
    url: () => '/api/work-items',
    body: (w) => taskIn(w.projectA.id, { assigneeId: w.users.member3.id }),
    status: 400,
    code: 'ASSIGNEE_NOT_IN_PROJECT',
  },
  {
    rule: 'a project ticket can go to the project manager',
    who: 'manager1',
    method: 'patch',
    url: (w) => `/api/work-items/${w.ticketA.id}`,
    body: (w) => ({ assigneeId: w.users.manager1.id }),
    status: 200,
  },
  {
    rule: 'a project task cannot go to the project manager',
    who: 'manager1',
    method: 'patch',
    url: (w) => `/api/work-items/${w.taskA.id}`,
    body: (w) => ({ assigneeId: w.users.manager1.id }),
    status: 400,
    code: 'ASSIGNEE_NOT_IN_PROJECT',
  },
  {
    rule: 'Admin assigns a project-less ticket to a Manager',
    who: 'admin',
    method: 'patch',
    url: (w) => `/api/work-items/${w.looseTicket.id}`,
    body: (w) => ({ assigneeId: w.users.manager1.id }),
    status: 200,
  },
  {
    rule: 'a project-less ticket cannot go to a Member',
    who: 'admin',
    method: 'patch',
    url: (w) => `/api/work-items/${w.looseTicket.id}`,
    body: (w) => ({ assigneeId: w.users.member1.id }),
    status: 400,
    code: 'ASSIGNEE_NOT_IN_PROJECT',
  },
  {
    rule: 'only an Admin assigns a project-less ticket',
    who: 'manager1',
    method: 'post',
    url: () => '/api/work-items',
    body: (w) => ticket({ assigneeId: w.users.manager1.id }),
    status: 403,
    code: 'FORBIDDEN_FIELD',
  },
  {
    rule: 'a Member cannot assign the ticket they raise',
    who: 'member1',
    method: 'post',
    url: () => '/api/work-items',
    body: (w) => ticket({ projectId: w.projectA.id, assigneeId: w.users.member2.id }),
    status: 403,
    code: 'FORBIDDEN_FIELD',
  },

  // ---------- Escalation
  {
    rule: 'Member cannot escalate a ticket',
    who: 'member1',
    method: 'patch',
    url: (w) => `/api/work-items/${w.ticketA.id}`,
    body: () => ({ status: 'ESCALATED' }),
    status: 403,
  },
  {
    rule: 'Manager escalates a ticket',
    who: 'manager1',
    method: 'patch',
    url: (w) => `/api/work-items/${w.ticketA.id}`,
    body: () => ({ status: 'ESCALATED' }),
    status: 200,
  },
  {
    rule: 'Admin escalates a ticket',
    who: 'admin',
    method: 'patch',
    url: (w) => `/api/work-items/${w.looseTicket.id}`,
    body: () => ({ status: 'ESCALATED' }),
    status: 200,
  },
  {
    rule: 'a TASK can never be escalated',
    who: 'admin',
    method: 'patch',
    url: (w) => `/api/work-items/${w.taskA.id}`,
    body: () => ({ status: 'ESCALATED' }),
    status: 409,
    code: 'INVALID_TRANSITION',
  },

  // ---------- Delete
  {
    rule: 'Manager cannot delete a work item',
    who: 'manager1',
    method: 'delete',
    url: (w) => `/api/work-items/${w.taskA.id}`,
    status: 403,
  },
  {
    rule: 'Member cannot delete a work item',
    who: 'member1',
    method: 'delete',
    url: (w) => `/api/work-items/${w.taskA.id}`,
    status: 403,
  },
  {
    rule: 'Admin deletes a work item',
    who: 'admin',
    method: 'delete',
    url: (w) => `/api/work-items/${w.taskA.id}`,
    status: 204,
  },

  // ---------- Comments
  {
    rule: 'requester comments',
    who: 'member2',
    method: 'post',
    url: (w) => `/api/work-items/${w.ticketA.id}/comments`,
    body: () => ({ body: 'Any update?' }),
    status: 201,
  },
  {
    rule: 'assignee comments',
    who: 'member1',
    method: 'post',
    url: (w) => `/api/work-items/${w.taskA.id}/comments`,
    body: () => ({ body: 'Working on it' }),
    status: 201,
  },
  {
    rule: 'project Manager comments',
    who: 'manager1',
    method: 'post',
    url: (w) => `/api/work-items/${w.taskA.id}/comments`,
    body: () => ({ body: 'Thanks' }),
    status: 201,
  },
  {
    rule: 'Admin comments',
    who: 'admin',
    method: 'post',
    url: (w) => `/api/work-items/${w.looseTicket.id}/comments`,
    body: () => ({ body: 'Looking' }),
    status: 201,
  },
  {
    rule: 'project-only Member cannot comment',
    who: 'member2',
    method: 'post',
    url: (w) => `/api/work-items/${w.taskA.id}/comments`,
    body: () => ({ body: 'Hi' }),
    status: 403,
  },
  {
    rule: 'project-only Member reads comments',
    who: 'member2',
    method: 'get',
    url: (w) => `/api/work-items/${w.taskA.id}/comments`,
    status: 200,
  },
  {
    rule: 'outsider cannot comment (404)',
    who: 'member3',
    method: 'post',
    url: (w) => `/api/work-items/${w.taskA.id}/comments`,
    body: () => ({ body: 'Hi' }),
    status: 404,
  },
  {
    rule: 'outsider cannot read comments (404)',
    who: 'member3',
    method: 'get',
    url: (w) => `/api/work-items/${w.taskA.id}/comments`,
    status: 404,
  },

  // ---------- Notifications
  {
    rule: 'a user lists only their own notifications',
    who: 'member1',
    method: 'get',
    url: () => '/api/notifications',
    status: 200,
    check: (res, w) => expect(ids(res)).not.toContain(w.member2Notification.id),
  },
  {
    rule: "cannot mark another user's notification read (404)",
    who: 'member1',
    method: 'patch',
    url: (w) => `/api/notifications/${w.member2Notification.id}/read`,
    status: 404,
  },
  {
    rule: 'owner marks their notification read',
    who: 'member2',
    method: 'patch',
    url: (w) => `/api/notifications/${w.member2Notification.id}/read`,
    status: 200,
  },
  {
    rule: 'scope=all is Admin only',
    who: 'manager1',
    method: 'get',
    url: () => '/api/notifications?scope=all',
    status: 403,
  },
  {
    rule: "Admin lists everyone's notifications",
    who: 'admin',
    method: 'get',
    url: () => '/api/notifications?scope=all',
    status: 200,
    check: (res, w) => expect(ids(res)).toContain(w.member2Notification.id),
  },

  // ---------- Users
  {
    rule: 'Member cannot list users',
    who: 'member1',
    method: 'get',
    url: () => '/api/users',
    status: 403,
  },
  {
    rule: 'Manager sees only MEMBER users, even when asking for admins',
    who: 'manager1',
    method: 'get',
    url: () => '/api/users?role=ADMIN&limit=100',
    status: 200,
    check: (res) => {
      const roles = new Set((res.body.data as { role: string }[]).map((u) => u.role));
      expect([...roles]).toEqual(['MEMBER']);
      expect(res.body.meta.total).toBe(4);
    },
  },
  {
    rule: 'Manager cannot create users',
    who: 'manager1',
    method: 'post',
    url: () => '/api/users',
    body: () => ({ ...newUser, role: 'MEMBER' }),
    status: 403,
  },
  {
    rule: 'Admin creates a user with any role',
    who: 'admin',
    method: 'post',
    url: () => '/api/users',
    body: () => ({ ...newUser, role: 'MANAGER' }),
    status: 201,
  },
  {
    rule: 'Manager cannot change roles',
    who: 'manager1',
    method: 'patch',
    url: (w) => `/api/users/${w.users.member1.id}/role`,
    body: () => ({ role: 'MANAGER' }),
    status: 403,
  },
  {
    rule: 'Admin changes a role',
    who: 'admin',
    method: 'patch',
    url: (w) => `/api/users/${w.users.member4.id}/role`,
    body: () => ({ role: 'MANAGER' }),
    status: 200,
  },
  {
    rule: 'Admin cannot change their own role',
    who: 'admin',
    method: 'patch',
    url: (w) => `/api/users/${w.users.admin.id}/role`,
    body: () => ({ role: 'MEMBER' }),
    status: 409,
    code: 'CANNOT_CHANGE_OWN_ROLE',
  },

  // ---------- Privilege escalation and mass assignment
  {
    rule: 'register cannot choose a role',
    who: 'anonymous',
    method: 'post',
    url: () => '/api/auth/register',
    body: () => ({ ...newUser, role: 'ADMIN' }),
    status: 400,
  },
  {
    rule: 'PATCH cannot change the type',
    who: 'manager1',
    method: 'patch',
    url: (w) => `/api/work-items/${w.taskA.id}`,
    body: () => ({ type: 'TICKET' }),
    status: 400,
  },
  {
    rule: 'PATCH cannot move an item to another project',
    who: 'admin',
    method: 'patch',
    url: (w) => `/api/work-items/${w.taskA.id}`,
    body: (w) => ({ projectId: w.projectB.id }),
    status: 400,
  },
  {
    rule: 'PATCH cannot change the requester',
    who: 'manager1',
    method: 'patch',
    url: (w) => `/api/work-items/${w.taskA.id}`,
    body: (w) => ({ requesterId: w.users.member2.id }),
    status: 400,
  },
  {
    rule: 'create cannot set the status',
    who: 'member1',
    method: 'post',
    url: () => '/api/work-items',
    body: () => ticket({ status: 'CLOSED' }),
    status: 400,
  },
  {
    rule: 'create cannot set the requester',
    who: 'member1',
    method: 'post',
    url: () => '/api/work-items',
    body: (w) => ticket({ requesterId: w.users.member2.id }),
    status: 400,
  },
  {
    rule: 'create cannot set remindedAt',
    who: 'manager1',
    method: 'post',
    url: () => '/api/work-items',
    body: (w) => taskIn(w.projectA.id, { dueDate: hoursFromNow(48), remindedAt: hoursFromNow(1) }),
    status: 400,
  },
  {
    rule: 'Admin user creation rejects unknown fields',
    who: 'admin',
    method: 'post',
    url: () => '/api/users',
    body: () => ({ ...newUser, role: 'MEMBER', isSuperuser: true }),
    status: 400,
  },
];

describe('RBAC matrix', () => {
  let world: World;
  beforeEach(async () => {
    world = await buildWorld();
  });

  it.each(
    cases.map((c) => [`${c.who} ${c.method.toUpperCase()}: ${c.rule} -> ${c.status}`, c] as const),
  )('%s', async (_name, c) => {
    const token = c.who === 'anonymous' ? undefined : world.users[c.who].token;
    const req = api(token)[c.method](c.url(world));
    const res = c.body ? await req.send(c.body(world)) : await req;

    expect(res.status, JSON.stringify(res.body)).toBe(c.status);
    if (c.code) expect(res.body.error?.code).toBe(c.code);
    c.check?.(res, world);
  });
});
