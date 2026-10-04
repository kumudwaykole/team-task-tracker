import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/authenticate.js';
import { getValidated } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/response.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';
import * as authService from './auth.service.js';

export async function register(req: Request, res: Response) {
  const result = await authService.register(getValidated<RegisterInput>(req, 'body'));
  sendSuccess(res, result, { status: 201 });
}

export async function login(req: Request, res: Response) {
  const result = await authService.login(getValidated<LoginInput>(req, 'body'));
  sendSuccess(res, result);
}

export function me(req: Request, res: Response) {
  sendSuccess(res, getAuthUser(req));
}
