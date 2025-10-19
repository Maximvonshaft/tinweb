import { Router } from 'express';
import { asyncHandler } from '../../core/middleware/async-handler.js';
import { sendSuccess } from '../../core/envelope.js';
import type { ApplicationContext } from '../../app/context.js';
import { getHealthSummary } from './health.service.js';

export const createHealthRouter = (context: ApplicationContext) => {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const summary = await getHealthSummary(context.db);
      sendSuccess(res, summary);
    })
  );

  return router;
};
