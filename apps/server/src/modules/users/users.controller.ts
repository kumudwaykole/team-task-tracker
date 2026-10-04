import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/authenticate.js';
import { getValidated } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/response.js';
import type { IdParams } from '../../utils/schemas.js';
import type { ChangeRoleInput, CreateUserInput, ListUsersQuery } from './users.schema.js';
import * as usersService from './users.service.js';

export async function list(req: Request, res: Response) {
  const { data, meta } = await usersService.list(
    getAuthUser(req),
    getValidated<ListUsersQuery>(req, 'query'),
  );
  sendSuccess(res, data, { meta });
}

export async function create(req: Request, res: Response) {
  const user = await usersService.createUser(getValidated<CreateUserInput>(req, 'body'));
  sendSuccess(res, user, { status: 201 });
}

export async function changeRole(req: Request, res: Response) {
  const { id } = getValidated<IdParams>(req, 'params');
  const { role } = getValidated<ChangeRoleInput>(req, 'body');
  sendSuccess(res, await usersService.changeRole(getAuthUser(req), id, role));
}
