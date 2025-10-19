import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/middleware/async-handler.js';
import { sendSuccess } from '../../core/envelope.js';
import { login } from './auth.service.js';
import type { ApplicationContext } from '../../app/context.js';
import { env } from '../../config/env.js';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  tenantId: z.string().optional()
});

export const createAuthRouter = (context: ApplicationContext) => {
  const router = Router();

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const payload = loginSchema.parse(req.body ?? {});
      const tenantId = payload.tenantId ?? env.DEFAULT_TENANT;
      const result = await login(context.db, payload.username, payload.password, tenantId);
      sendSuccess(res, {
        access_token: result.accessToken,
        expires_in: result.expiresIn,
        token_type: result.tokenType,
        user: result.user
      });
    })
  );

  return router;
};
