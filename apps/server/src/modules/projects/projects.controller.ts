import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/authenticate.js';
import { getValidated } from '../../middleware/validate.js';
import { sendNoContent, sendSuccess } from '../../utils/response.js';
import type { IdParams } from '../../utils/schemas.js';
import type {
  AddMembersInput,
  CreateProjectInput,
  ListMembersQuery,
  ListProjectsQuery,
  MemberParams,
  UpdateProjectInput,
} from './projects.schema.js';
import * as projectsService from './projects.service.js';

export async function create(req: Request, res: Response) {
  const project = await projectsService.create(
    getAuthUser(req),
    getValidated<CreateProjectInput>(req, 'body'),
  );
  sendSuccess(res, project, { status: 201 });
}

export async function list(req: Request, res: Response) {
  const { data, meta } = await projectsService.list(
    getAuthUser(req),
    getValidated<ListProjectsQuery>(req, 'query'),
  );
  sendSuccess(res, data, { meta });
}

export async function getById(req: Request, res: Response) {
  const { id } = getValidated<IdParams>(req, 'params');
  sendSuccess(res, await projectsService.getById(getAuthUser(req), id));
}

export async function update(req: Request, res: Response) {
  const { id } = getValidated<IdParams>(req, 'params');
  const input = getValidated<UpdateProjectInput>(req, 'body');
  sendSuccess(res, await projectsService.update(getAuthUser(req), id, input));
}

export async function remove(req: Request, res: Response) {
  const { id } = getValidated<IdParams>(req, 'params');
  await projectsService.remove(getAuthUser(req), id);
  sendNoContent(res);
}

export async function listMembers(req: Request, res: Response) {
  const { id } = getValidated<IdParams>(req, 'params');
  const { data, meta } = await projectsService.listMembers(
    getAuthUser(req),
    id,
    getValidated<ListMembersQuery>(req, 'query'),
  );
  sendSuccess(res, data, { meta });
}

export async function addMembers(req: Request, res: Response) {
  const { id } = getValidated<IdParams>(req, 'params');
  const { userIds } = getValidated<AddMembersInput>(req, 'body');
  sendSuccess(res, await projectsService.addMembers(getAuthUser(req), id, userIds));
}

export async function removeMember(req: Request, res: Response) {
  const { id, userId } = getValidated<MemberParams>(req, 'params');
  await projectsService.removeMember(getAuthUser(req), id, userId);
  sendNoContent(res);
}
