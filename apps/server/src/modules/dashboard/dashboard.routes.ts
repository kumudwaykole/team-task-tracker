import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import * as dashboardController from './dashboard.controller.js';

export const dashboardRouter = Router();

dashboardRouter.get('/summary', authenticate, dashboardController.summary);
