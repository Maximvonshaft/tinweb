import { Router } from 'express';
import type { ApplicationContext } from '../../app/context.js';
import { requireAuth } from '../../core/middleware/auth.js';
import { asyncHandler } from '../../core/middleware/async-handler.js';
import { createForbiddenError } from '../../core/errors.js';
import { sendSuccess } from '../../core/envelope.js';
import { runIndexer } from './indexer.service.js';

export const createIndexerRouter = (context: ApplicationContext) => {
  const router = Router();

  router.post(
    '/run',
    requireAuth,
    asyncHandler(async (req, res) => {
      if (req.currentUser!.role !== 'ADMIN') {
        throw createForbiddenError('仅管理员可触发索引');
      }
      const tenantId = req.currentUser!.tenantId;
      const summary = await runIndexer(context.db, tenantId, req.currentUser!.id);
      sendSuccess(res, summary);
    })
  );

  return router;
};
