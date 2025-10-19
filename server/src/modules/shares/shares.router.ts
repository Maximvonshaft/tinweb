import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/middleware/async-handler.js';
import { sendSuccess } from '../../core/envelope.js';
import type { ApplicationContext } from '../../app/context.js';
import { getShareContent, getShareDetail, getShareDownloadInfo, getSharePreview, unlockShare } from './shares.service.js';
import { resolveMimeType } from '../files/preview.service.js';

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
    '/:token/preview',
    asyncHandler(async (req, res) => {
      const sessionHeader = req.header('x-share-session');
      const sessionQuery = typeof req.query.session === 'string' ? req.query.session : undefined;
      const sessionToken = sessionHeader ?? sessionQuery;
      const preview = await getSharePreview(context.db, req.params.token, sessionToken);
      sendSuccess(res, preview);
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

  router.get(
    '/:token/content',
    asyncHandler(async (req, res) => {
      const sessionHeader = req.header('x-share-session');
      const sessionQuery = typeof req.query.session === 'string' ? req.query.session : undefined;
      const sessionToken = sessionHeader ?? sessionQuery;
      const { metadata, stream } = await getShareContent(context.db, req.params.token, sessionToken);
      res.setHeader('Content-Type', resolveMimeType(metadata));
      res.setHeader('Content-Length', String(metadata.size));
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(metadata.name)}"`);
      stream.pipe(res);
    })
  );

  return router;
};
