import { env } from '../config/env.js';
import * as notificationsRepository from '../modules/notifications/notifications.repository.js';

const BATCH_SIZE = 1000;

/**
 * Deletes read notifications older than NOTIFICATION_RETENTION_DAYS, in batches so no single
 * statement locks many rows. Unread notifications are kept. Returns how many were deleted.
 */
export async function runCleanupJob(): Promise<number> {
  let deleted = 0;
  for (;;) {
    const batch = await notificationsRepository.deleteReadOlderThan(
      env.NOTIFICATION_RETENTION_DAYS,
      BATCH_SIZE,
    );
    deleted += batch;
    if (batch < BATCH_SIZE) return deleted;
  }
}
