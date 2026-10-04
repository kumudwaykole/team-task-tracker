import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { idParams } from '../../utils/schemas.js';
import * as notificationsController from './notifications.controller.js';
import { listNotificationsQuery } from './notifications.schema.js';

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

notificationsRouter.get(
  '/',
  validate({ query: listNotificationsQuery }),
  notificationsController.list,
);
notificationsRouter.get('/unread-count', notificationsController.unreadCount);
// Defined before "/:id/read" to keep the intent explicit (the paths cannot collide anyway).
notificationsRouter.patch('/read-all', notificationsController.markAllRead);
notificationsRouter.patch(
  '/:id/read',
  validate({ params: idParams }),
  notificationsController.markRead,
);
