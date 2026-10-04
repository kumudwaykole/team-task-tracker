import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/authenticate.js';
import { getValidated } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/response.js';
import type { IdParams } from '../../utils/schemas.js';
import type { CreateCommentInput, ListCommentsQuery } from './comments.schema.js';
import * as commentsService from './comments.service.js';

export async function list(req: Request, res: Response) {
  const { id } = getValidated<IdParams>(req, 'params');
  const { data, meta } = await commentsService.list(
    getAuthUser(req),
    id,
    getValidated<ListCommentsQuery>(req, 'query'),
  );
  sendSuccess(res, data, { meta });
}

export async function create(req: Request, res: Response) {
  const { id } = getValidated<IdParams>(req, 'params');
  const { body } = getValidated<CreateCommentInput>(req, 'body');
  sendSuccess(res, await commentsService.create(getAuthUser(req), id, body), { status: 201 });
}
