import { Router } from 'express';
import { Role } from '../../generated/prisma/enums.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { idParams } from '../../utils/schemas.js';
import * as workItemsController from '../workItems/workItems.controller.js';
import { boardQuery } from '../workItems/workItems.schema.js';
import * as projectsController from './projects.controller.js';
import {
  addMembersSchema,
  createProjectSchema,
  listMembersQuery,
  listProjectsQuery,
  memberParams,
  updateProjectSchema,
} from './projects.schema.js';

export const projectsRouter = Router();

// Reads are open to every role (the service scopes them); writes need ADMIN or MANAGER,
// and the service then checks that the Manager owns the project.
const canWrite = authorize(Role.ADMIN, Role.MANAGER);

projectsRouter.use(authenticate);

projectsRouter.post(
  '/',
  canWrite,
  validate({ body: createProjectSchema }),
  projectsController.create,
);
projectsRouter.get('/', validate({ query: listProjectsQuery }), projectsController.list);
projectsRouter.get('/:id', validate({ params: idParams }), projectsController.getById);
projectsRouter.patch(
  '/:id',
  canWrite,
  validate({ params: idParams, body: updateProjectSchema }),
  projectsController.update,
);
projectsRouter.delete('/:id', canWrite, validate({ params: idParams }), projectsController.remove);

projectsRouter.get(
  '/:id/members',
  validate({ params: idParams, query: listMembersQuery }),
  projectsController.listMembers,
);
projectsRouter.post(
  '/:id/members',
  canWrite,
  validate({ params: idParams, body: addMembersSchema }),
  projectsController.addMembers,
);
projectsRouter.delete(
  '/:id/members/:userId',
  canWrite,
  validate({ params: memberParams }),
  projectsController.removeMember,
);

// The board lists work items, so it is served by the work-items module.
projectsRouter.get(
  '/:id/board',
  validate({ params: idParams, query: boardQuery }),
  workItemsController.board,
);
