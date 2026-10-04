import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { loginLimiter, registerLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as authController from './auth.controller.js';
import { loginSchema, registerSchema } from './auth.schema.js';

export const authRouter = Router();

authRouter.post(
  '/register',
  registerLimiter,
  validate({ body: registerSchema }),
  authController.register,
);
authRouter.post('/login', loginLimiter, validate({ body: loginSchema }), authController.login);
authRouter.get('/me', authenticate, authController.me);
