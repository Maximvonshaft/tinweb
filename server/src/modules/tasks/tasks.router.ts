import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../core/middleware/auth.js';
import { asyncHandler } from '../../core/middleware/async-handler.js';
import { sendSuccess } from '../../core/envelope.js';
import { getTaskStatus } from './tasks.service.js';
import type { ApplicationContext } from '../../app/context.js';

const taskIdSchema = z.object({
  id: z.union([z.number(), z.string()]).transform((value) => Number(value))
});

export const createTasksRouter = (context: ApplicationContext) => {
  const router = Router();

  router.get(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const params = taskIdSchema.parse({ id: req.params.id });
      const tenantId = req.currentUser!.tenantId;
      const status = await getTaskStatus(context.db, tenantId, params.id);
      sendSuccess(res, status);
    })
  );

  return router;
};
