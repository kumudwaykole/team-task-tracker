import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as authController from './auth.controller.js';
import { loginSchema, registerSchema } from './auth.schema.js';

export const authRouter = Router();

authRouter.post(
  '/register',
  authLimiter,
  validate({ body: registerSchema }),
  authController.register,
);
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);
authRouter.get('/me', authenticate, authController.me);
