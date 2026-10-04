import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/authenticate.js';
import { sendSuccess } from '../../utils/response.js';
import * as dashboardService from './dashboard.service.js';

export async function summary(req: Request, res: Response) {
  sendSuccess(res, await dashboardService.summary(getAuthUser(req)));
}
