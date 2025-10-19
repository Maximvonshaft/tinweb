import express from 'express';
import cors from 'cors';
import type { ApplicationContext } from './context.js';
import { createAuthRouter } from '../modules/auth/auth.router.js';
import { createFilesRouter } from '../modules/files/files.router.js';
import { createTasksRouter } from '../modules/tasks/tasks.router.js';
import { createSharesRouter } from '../modules/shares/shares.router.js';
import { createHealthRouter } from '../modules/health/health.router.js';
import { requireAuth } from '../core/middleware/auth.js';
import { asyncHandler } from '../core/middleware/async-handler.js';
import { sendSuccess } from '../core/envelope.js';
import { emptyRecycleBin } from '../modules/files/files.service.js';
import { errorHandler } from '../core/middleware/error-handler.js';

export const createApp = (context: ApplicationContext) => {
  const app = express();

  app.locals.context = context;

  app.use(cors());
  app.use(express.json());

  app.use((req, res, next) => {
    res.setHeader('X-API-Version', '1.0.0');
    next();
  });

  app.use('/api/auth', createAuthRouter(context));
  app.use('/api/files', createFilesRouter(context));
  app.use('/api/tasks', createTasksRouter(context));
  app.use('/s', createSharesRouter(context));
  app.use('/api/health', createHealthRouter(context));

  app.post(
    '/api/recycle/empty',
    requireAuth,
    asyncHandler(async (req, res) => {
      const tenantId = req.currentUser!.tenantId;
      await emptyRecycleBin(context.db, tenantId);
      sendSuccess(res, { cleared: true });
    })
  );

  app.use((_req, res) => {
    res.status(404).json({ code: 404, message: 'Not Found', data: null });
  });

  app.use(errorHandler);

  return app;
};
