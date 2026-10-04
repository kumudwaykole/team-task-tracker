import { describe, expect, it } from 'vitest';
import { Role } from '../../src/generated/prisma/enums.js';
import { canManageProject, projectScope } from '../../src/modules/projects/projects.policy.js';
import {
  canComment,
  capabilityFor,
  permissionsFor,
  workItemScope,
} from '../../src/modules/workItems/workItems.policy.js';
import type { AuthUser } from '../../src/types/auth.js';

const user = (id: string, role: Role): AuthUser => ({ id, role, name: id, email: `${id}@x.dev` });

const admin = user('admin', Role.ADMIN);
const manager = user('manager', Role.MANAGER);
const otherManager = user('other-manager', Role.MANAGER);
const member = user('member', Role.MEMBER);

// An item in `manager`'s project. Requester and assignee are filled in per case.
const item = (overrides: {
  requesterId?: string;
  assigneeId?: string | null;
  managerId?: string | null;
}) => ({
  type: 'TICKET' as const,
  status: 'OPEN' as const,
  requesterId: overrides.requesterId ?? 'someone-else',
  assigneeId: overrides.assigneeId ?? null,
  project: overrides.managerId === null ? null : { managerId: overrides.managerId ?? manager.id },
});

describe('capabilityFor and canComment: role x relation', () => {
  it.each([
    // [case, user, item, capability, canComment]
    ['Admin, any item', admin, item({}), 'FULL', true],
    ['Admin, ticket without a project', admin, item({ managerId: null }), 'FULL', true],
    ['Manager of the project', manager, item({}), 'FULL', true],
    ['Other Manager, not involved', otherManager, item({}), 'NONE', false],
    [
      'Other Manager who raised it',
      otherManager,
      item({ requesterId: otherManager.id }),
      'NONE',
      true,
    ],
    [
      'Manager assigned a project-less ticket',
      manager,
      item({ managerId: null, assigneeId: manager.id }),
      'STATUS_ONLY',
      true,
    ],
    [
      'Manager, project-less ticket, not involved',
      manager,
      item({ managerId: null }),
      'NONE',
      false,
    ],
    ['Member assignee', member, item({ assigneeId: member.id }), 'STATUS_ONLY', true],
    ['Member requester', member, item({ requesterId: member.id }), 'NONE', true],
    [
      'Member requester and assignee',
      member,
      item({ requesterId: member.id, assigneeId: member.id }),
      'STATUS_ONLY',
      true,
    ],
    ['Member, project-only', member, item({}), 'NONE', false],
  ] as const)('%s', (_name, who, target, capability, comment) => {
    expect(capabilityFor(who, target)).toBe(capability);
    expect(canComment(who, target)).toBe(comment);
  });
});

describe('permissionsFor (UI hints)', () => {
  it('gives an assigned Member status moves only, without escalation', () => {
    const hints = permissionsFor(member, item({ assigneeId: member.id }));
    expect(hints.permissions).toEqual({
      canEdit: false,
      canChangeStatus: true,
      canAssign: false,
      canDelete: false,
      canComment: true,
    });
    expect(hints.allowedTransitions).toEqual(['IN_PROGRESS', 'CLOSED']);
  });

  it('gives the project Manager full rights and escalation, but not delete', () => {
    const hints = permissionsFor(manager, item({}));
    expect(hints.permissions).toMatchObject({ canEdit: true, canAssign: true, canDelete: false });
    expect(hints.allowedTransitions).toContain('ESCALATED');
  });

  it('lets only an Admin delete', () => {
    expect(permissionsFor(admin, item({})).permissions.canDelete).toBe(true);
  });

  it('offers no moves without a capability', () => {
    const hints = permissionsFor(member, item({ requesterId: member.id }));
    expect(hints.allowedTransitions).toEqual([]);
    expect(hints.permissions.canChangeStatus).toBe(false);
  });
});

describe('read scopes', () => {
  it('lets an Admin see every project and work item', () => {
    expect(projectScope(admin)).toEqual({});
    expect(workItemScope(admin)).toEqual({});
  });

  it('limits a Manager to managed projects and items they manage, raised or hold', () => {
    expect(projectScope(manager)).toEqual({ managerId: manager.id });
    expect(workItemScope(manager)).toEqual({
      OR: [
        { project: { managerId: manager.id } },
        { requesterId: manager.id },
        { assigneeId: manager.id },
      ],
    });
  });

  it('limits a Member to joined projects and items they hold, raised or share a project with', () => {
    expect(projectScope(member)).toEqual({ members: { some: { userId: member.id } } });
    expect(workItemScope(member)).toEqual({
      OR: [
        { assigneeId: member.id },
        { requesterId: member.id },
        { project: { members: { some: { userId: member.id } } } },
      ],
    });
  });
});

describe('canManageProject', () => {
  it.each([
    ['Admin', admin, true],
    ['owning Manager', manager, true],
    ['other Manager', otherManager, false],
    ['Member, even with a matching id', user(manager.id, Role.MEMBER), false],
  ] as const)('%s -> %s', (_name, who, expected) => {
    expect(canManageProject(who, { managerId: manager.id })).toBe(expected);
  });
});
