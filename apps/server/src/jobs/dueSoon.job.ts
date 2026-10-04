import { env } from '../config/env.js';
import { runInTransaction } from '../config/prisma.js';
import { publishNotifications } from '../modules/notifications/notifications.publisher.js';
import * as recipients from '../modules/notifications/notifications.recipients.js';
import * as notificationsRepository from '../modules/notifications/notifications.repository.js';
import * as workItemsRepository from '../modules/workItems/workItems.repository.js';

const BATCH_SIZE = 200;

let running = false;

/**
 * Reminds assignees of unfinished items due within the window (or already overdue).
 * State-based: it asks the DB for "due soon and not reminded yet", so a run missed while the
 * server was down is caught up by the next one. Claim and insert share one transaction, so a
 * failed insert un-claims the items and the next run retries them. Returns how many were sent.
 */
export async function runDueSoonJob(): Promise<number> {
  if (running) return 0; // no overlapping runs inside one process
  running = true;
  let sent = 0;
  try {
    for (;;) {
      const created = await runInTransaction(async (tx) => {
        const items = await workItemsRepository.claimDueSoon(
          tx,
          env.DUE_SOON_WINDOW_HOURS,
          BATCH_SIZE,
        );
        const now = new Date();
        return notificationsRepository.createMany(
          items.flatMap((item) =>
            recipients.dueSoon(item, item.dueDate < now, env.DUE_SOON_WINDOW_HOURS),
          ),
          tx,
        );
      });
      publishNotifications(created);
      sent += created.length;
      if (created.length < BATCH_SIZE) return sent;
    }
  } finally {
    running = false;
  }
}
