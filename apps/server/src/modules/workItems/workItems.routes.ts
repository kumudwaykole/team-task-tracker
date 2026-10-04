import { Router } from 'express';
import { Role } from '../../generated/prisma/enums.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { idParams } from '../../utils/schemas.js';
import * as workItemsController from './workItems.controller.js';
import {
  createWorkItemSchema,
  listWorkItemsQuery,
  updateWorkItemSchema,
} from './workItems.schema.js';

export const workItemsRouter = Router();

// Access to a work item depends on the record itself, so apart from delete it is
// decided in the service through the work-item policy.
workItemsRouter.use(authenticate);

workItemsRouter.post('/', validate({ body: createWorkItemSchema }), workItemsController.create);
workItemsRouter.get('/', validate({ query: listWorkItemsQuery }), workItemsController.list);
workItemsRouter.get('/:id', validate({ params: idParams }), workItemsController.getById);
workItemsRouter.patch(
  '/:id',
  validate({ params: idParams, body: updateWorkItemSchema }),
  workItemsController.update,
);
workItemsRouter.delete(
  '/:id',
  authorize(Role.ADMIN),
  validate({ params: idParams }),
  workItemsController.remove,
);
