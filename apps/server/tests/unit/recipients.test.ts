import { describe, expect, it } from 'vitest';
import { Role } from '../../src/generated/prisma/enums.js';
import * as recipients from '../../src/modules/notifications/notifications.recipients.js';
import type { AuthUser } from '../../src/types/auth.js';

const actor = (id: string): AuthUser => ({
  id,
  name: `User ${id}`,
  email: `${id}@x.dev`,
  role: Role.MEMBER,
});

const item = {
  id: 'item-1',
  title: 'Fix the login page',
  requesterId: 'requester',
  assigneeId: 'assignee',
  project: { managerId: 'manager' },
};

const userIds = (rows: recipients.NewNotification[]) => rows.map((row) => row.userId).sort();

describe('notification recipients', () => {
  it('notifies the new assignee of an assignment', () => {
    const rows = recipients.assigned(item, actor('manager'));
    expect(rows).toEqual([
      {
        userId: 'assignee',
        type: 'ASSIGNED',
        workItemId: 'item-1',
        message: 'User manager assigned you "Fix the login page"',
      },
    ]);
  });

  it('does not notify someone who assigns themselves', () => {
    expect(recipients.assigned(item, actor('assignee'))).toEqual([]);
  });

  it('notifies requester, assignee and manager of a status change, minus the actor', () => {
    const rows = recipients.statusChanged(item, actor('assignee'), 'OPEN', 'IN_PROGRESS');
    expect(userIds(rows)).toEqual(['manager', 'requester']);
    expect(rows[0]?.message).toBe(
      'User assignee moved "Fix the login page" from Open to In Progress',
    );
  });

  it('notifies each person once when they hold several roles', () => {
    const managerRaised = { ...item, requesterId: 'manager' };
    expect(
      userIds(recipients.statusChanged(managerRaised, actor('admin'), 'TODO', 'IN_PROGRESS')),
    ).toEqual(['assignee', 'manager']);
  });

  it('leaves out the commenter', () => {
    expect(userIds(recipients.commented(item, actor('requester')))).toEqual([
      'assignee',
      'manager',
    ]);
  });

  it('ignores a missing assignee and a missing project', () => {
    const bare = { ...item, assigneeId: null, project: null };
    expect(userIds(recipients.commented(bare, actor('admin')))).toEqual(['requester']);
  });

  it('announces a project ticket to the project manager, never to the requester', () => {
    expect(userIds(recipients.ticketCreated(item, actor('requester'), ['admin']))).toEqual([
      'manager',
    ]);
    const raisedByManager = { ...item, requesterId: 'manager' };
    expect(recipients.ticketCreated(raisedByManager, actor('manager'), ['admin'])).toEqual([]);
  });

  it('announces a project-less ticket to every Admin except the requester', () => {
    const loose = { ...item, project: null, requesterId: 'admin-1' };
    expect(
      userIds(recipients.ticketCreated(loose, actor('admin-1'), ['admin-1', 'admin-2'])),
    ).toEqual(['admin-2']);
  });

  it('words due-soon reminders for upcoming and overdue items', () => {
    const due = { id: 'item-1', title: 'Ship it', assigneeId: 'assignee' };
    expect(recipients.dueSoon(due, false, 24)[0]?.message).toBe('"Ship it" is due within 24 hours');
    expect(recipients.dueSoon(due, true, 24)[0]?.message).toBe('"Ship it" is overdue');
  });

  it('shortens long titles in messages', () => {
    const long = { ...item, title: 'x'.repeat(200) };
    const message = recipients.assigned(long, actor('manager'))[0]?.message ?? '';
    expect(message).toContain(`"${'x'.repeat(79)}…"`);
  });
});
