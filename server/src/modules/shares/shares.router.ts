import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/middleware/async-handler.js';
import { sendSuccess } from '../../core/envelope.js';
import type { ApplicationContext } from '../../app/context.js';
import { getShareDetail, getShareDownloadInfo, unlockShare } from './shares.service.js';

const unlockSchema = z.object({
  password: z.string().optional()
});

export const createSharesRouter = (context: ApplicationContext) => {
  const router = Router();

  router.get(
    '/:token',
    asyncHandler(async (req, res) => {
      const detail = await getShareDetail(context.db, req.params.token);
      sendSuccess(res, detail);
    })
  );

  router.post(
    '/:token/unlock',
    asyncHandler(async (req, res) => {
      const payload = unlockSchema.parse(req.body ?? {});
      const result = await unlockShare(context.db, req.params.token, payload.password ?? null);
      sendSuccess(res, result);
    })
  );

  router.get(
    '/:token/download',
    asyncHandler(async (req, res) => {
      const sessionHeader = req.header('x-share-session');
      const sessionQuery = typeof req.query.session === 'string' ? req.query.session : undefined;
      const sessionToken = sessionHeader ?? sessionQuery;
      const info = await getShareDownloadInfo(context.db, req.params.token, sessionToken);
      sendSuccess(res, info);
    })
  );

  return router;
};
