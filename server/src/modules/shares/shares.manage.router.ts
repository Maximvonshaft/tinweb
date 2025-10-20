import { Router } from 'express';
import { z } from 'zod';
import type { ApplicationContext } from '../../app/context.js';
import { asyncHandler } from '../../core/middleware/async-handler.js';
import { requireAuth } from '../../core/middleware/auth.js';
import { sendSuccess } from '../../core/envelope.js';
import { createBadRequestError } from '../../core/errors.js';
import { deleteShare, listActiveSharesForFile, updateShare } from './shares.service.js';

const updateSchema = z
  .object({
    expires_in_hours: z.number().int().positive().nullable().optional(),
    expires_at: z.string().datetime().nullable().optional()
  })
  .refine((data) => data.expires_in_hours !== undefined || data.expires_at !== undefined, {
    message: '需提供有效期'
  });

export const createShareManageRouter = (context: ApplicationContext) => {
  const router = Router();

  router.get(
    '/file/:fileId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const fileId = Number.parseInt(req.params.fileId, 10);
      if (Number.isNaN(fileId)) {
        throw createBadRequestError('文件 ID 无效');
      }
      const tenantId = req.currentUser!.tenantId;
      const items = await listActiveSharesForFile(context.db, tenantId, fileId);
      sendSuccess(res, { items });
    })
  );

  router.patch(
    '/:shareId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const shareId = Number.parseInt(req.params.shareId, 10);
      if (Number.isNaN(shareId)) {
        throw createBadRequestError('分享 ID 无效');
      }
      const payload = updateSchema.parse(req.body ?? {});
      const tenantId = req.currentUser!.tenantId;
      const updated = await updateShare(context.db, tenantId, shareId, {
        expiresInHours: payload.expires_in_hours ?? undefined,
        expiresAt: payload.expires_at ?? undefined
      });
      sendSuccess(res, updated);
    })
  );

  router.delete(
    '/:shareId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const shareId = Number.parseInt(req.params.shareId, 10);
      if (Number.isNaN(shareId)) {
        throw createBadRequestError('分享 ID 无效');
      }
      const tenantId = req.currentUser!.tenantId;
      await deleteShare(context.db, tenantId, shareId);
      sendSuccess(res, { removed: true });
    })
  );

  return router;
};
