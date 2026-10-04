import { z } from 'zod';
import { NotificationType } from '../../generated/prisma/enums.js';
import { paginationSchema } from '../../utils/pagination.js';

export const listNotificationsQuery = paginationSchema
  .pick({ page: true })
  .extend({
    limit: z.coerce.number().int().min(1).max(50).default(10),
    // stringbool parses "false" as false (z.coerce.boolean would turn it into true).
    unread: z.stringbool().optional(),
    type: z.enum(NotificationType).optional(),
    // "all" is Admin only (checked in the service).
    scope: z.enum(['mine', 'all']).default('mine'),
    userId: z.uuid().optional(),
  })
  .refine((query) => !query.userId || query.scope === 'all', {
    path: ['userId'],
    message: 'userId can only be used with scope=all',
  });

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuery>;
