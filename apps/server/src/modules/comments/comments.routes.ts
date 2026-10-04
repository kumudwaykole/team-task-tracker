import { Router } from 'express';
import { commentLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { idParams } from '../../utils/schemas.js';
import * as commentsController from './comments.controller.js';
import { createCommentSchema, listCommentsQuery } from './comments.schema.js';

/** Mounted at /work-items/:id/comments, behind the work-items router's `authenticate`. */
export const commentsRouter = Router({ mergeParams: true });

commentsRouter.get(
  '/',
  validate({ params: idParams, query: listCommentsQuery }),
  commentsController.list,
);
commentsRouter.post(
  '/',
  commentLimiter,
  validate({ params: idParams, body: createCommentSchema }),
  commentsController.create,
);
