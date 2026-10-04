import { env } from '../../config/env.js';
import type { AuthUser } from '../../types/auth.js';
import { projectScope } from '../projects/projects.policy.js';
import { FINAL_STATUSES } from '../workItems/workItems.transitions.js';
import * as dashboardRepository from './dashboard.repository.js';

/** Everything the "Your work" page needs, in one request. */
export async function summary(user: AuthUser) {
  const now = new Date();
  const [assigned, overdue, dueSoon, raised, unreadNotifications, projects] =
    await dashboardRepository.summaryCounts({
      userId: user.id,
      projectScope: projectScope(user),
      now,
      dueSoonUntil: new Date(now.getTime() + env.DUE_SOON_WINDOW_HOURS * 60 * 60 * 1000),
    });

  const raisedClosed = raised
    .filter((group) => FINAL_STATUSES.includes(group.status))
    .reduce((sum, group) => sum + group._count._all, 0);
  const raisedTotal = raised.reduce((sum, group) => sum + group._count._all, 0);

  return {
    assignedToMe: Object.fromEntries(assigned.map((group) => [group.status, group._count._all])),
    overdue,
    dueSoon,
    raisedByMe: { open: raisedTotal - raisedClosed, closed: raisedClosed },
    unreadNotifications,
    projects,
  };
}
