import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/authenticate.js';
import { getValidated } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/response.js';
import type { IdParams } from '../../utils/schemas.js';
import type { ListNotificationsQuery } from './notifications.schema.js';
import * as notificationsService from './notifications.service.js';

export async function list(req: Request, res: Response) {
  const { data, meta } = await notificationsService.list(
    getAuthUser(req),
    getValidated<ListNotificationsQuery>(req, 'query'),
  );
  sendSuccess(res, data, { meta });
}

export async function unreadCount(req: Request, res: Response) {
  sendSuccess(res, await notificationsService.unreadCount(getAuthUser(req)));
}

export async function markRead(req: Request, res: Response) {
  const { id } = getValidated<IdParams>(req, 'params');
  sendSuccess(res, await notificationsService.markRead(getAuthUser(req), id));
}

export async function markAllRead(req: Request, res: Response) {
  sendSuccess(res, await notificationsService.markAllRead(getAuthUser(req)));
}
