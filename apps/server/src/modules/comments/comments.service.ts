import { runInTransaction } from '../../config/prisma.js';
import type { AuthUser } from '../../types/auth.js';
import { forbidden } from '../../utils/AppError.js';
import { buildMeta, toSkipTake } from '../../utils/pagination.js';
import { publishNotifications } from '../notifications/notifications.publisher.js';
import * as recipients from '../notifications/notifications.recipients.js';
import * as notificationsRepository from '../notifications/notifications.repository.js';
import { canComment } from '../workItems/workItems.policy.js';
import { getAccessibleItem } from '../workItems/workItems.service.js';
import * as commentsRepository from './comments.repository.js';
import type { ListCommentsQuery } from './comments.schema.js';

/** Reading needs only visibility of the item (404 otherwise). */
export async function list(user: AuthUser, workItemId: string, query: ListCommentsQuery) {
  const item = await getAccessibleItem(user, workItemId);
  const [data, total] = await commentsRepository.findPage({
    workItemId: item.id,
    order: query.order,
    ...toSkipTake(query),
  });
  return { data, meta: buildMeta(query, total) };
}

export async function create(user: AuthUser, workItemId: string, body: string) {
  const item = await getAccessibleItem(user, workItemId);
  if (!canComment(user, item)) {
    throw forbidden('You can view this item but cannot comment on it');
  }

  // The comment and its notifications commit together; they are pushed only after the commit.
  const { comment, notifications } = await runInTransaction(async (tx) => {
    const comment = await commentsRepository.create(
      { workItemId: item.id, userId: user.id, body },
      tx,
    );
    const notifications = await notificationsRepository.createMany(
      recipients.commented(item, user),
      tx,
    );
    return { comment, notifications };
  });
  publishNotifications(notifications);

  return comment;
}
