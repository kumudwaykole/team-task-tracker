import { Router } from 'express';
import { Role } from '../../generated/prisma/enums.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { idParams } from '../../utils/schemas.js';
import * as usersController from './users.controller.js';
import { changeRoleSchema, createUserSchema, listUsersQuery } from './users.schema.js';

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.get(
  '/',
  authorize(Role.ADMIN, Role.MANAGER),
  validate({ query: listUsersQuery }),
  usersController.list,
);
usersRouter.post(
  '/',
  authorize(Role.ADMIN),
  validate({ body: createUserSchema }),
  usersController.create,
);
usersRouter.patch(
  '/:id/role',
  authorize(Role.ADMIN),
  validate({ params: idParams, body: changeRoleSchema }),
  usersController.changeRole,
);
