import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/authenticate.js';
import { getValidated } from '../../middleware/validate.js';
import { sendNoContent, sendSuccess } from '../../utils/response.js';
import type { IdParams } from '../../utils/schemas.js';
import type {
  CreateWorkItemInput,
  ListWorkItemsQuery,
  UpdateWorkItemInput,
} from './workItems.schema.js';
import * as workItemsService from './workItems.service.js';

export async function create(req: Request, res: Response) {
  const item = await workItemsService.create(
    getAuthUser(req),
    getValidated<CreateWorkItemInput>(req, 'body'),
  );
  sendSuccess(res, item, { status: 201 });
}

export async function list(req: Request, res: Response) {
  const { data, meta } = await workItemsService.list(
    getAuthUser(req),
    getValidated<ListWorkItemsQuery>(req, 'query'),
  );
  sendSuccess(res, data, { meta });
}

export async function getById(req: Request, res: Response) {
  const { id } = getValidated<IdParams>(req, 'params');
  sendSuccess(res, await workItemsService.getById(getAuthUser(req), id));
}

export async function update(req: Request, res: Response) {
  const { id } = getValidated<IdParams>(req, 'params');
  const input = getValidated<UpdateWorkItemInput>(req, 'body');
  sendSuccess(res, await workItemsService.update(getAuthUser(req), id, input));
}

export async function remove(req: Request, res: Response) {
  const { id } = getValidated<IdParams>(req, 'params');
  await workItemsService.remove(id);
  sendNoContent(res);
}
