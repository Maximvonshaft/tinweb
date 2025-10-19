import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/middleware/async-handler.js';
import { sendSuccess } from '../../core/envelope.js';
import { requireAuth } from '../../core/middleware/auth.js';
import type { ApplicationContext } from '../../app/context.js';
import {
  createFolder,
  listFiles,
  renameFile,
  resolveDisk,
  restoreFile,
  softDeleteFile
} from './files.service.js';

const listSchema = z.object({
  disk: z.string().optional(),
  parent_id: z.string().optional(),
  deleted: z.string().optional(),
  q: z.string().optional(),
  cursor: z.string().optional(),
  page_size: z.string().optional()
});

const createFolderSchema = z.object({
  disk: z.string().optional(),
  parent_id: z
    .union([z.number(), z.string()])
    .nullable()
    .optional()
    .transform((value) => {
      if (value === null || value === undefined) {
        return null;
      }
      if (typeof value === 'string') {
        return value === 'null' ? null : Number.parseInt(value, 10);
      }
      return value;
    }),
  name: z.string().min(1)
});

const renameSchema = z.object({
  name: z.string().min(1)
});

const copySchema = z.object({
  id: z.union([z.number(), z.string()]).transform((value) => Number(value)),
  target_disk: z.union([z.string(), z.number()]),
  target_parent_id: z
    .union([z.number(), z.string()])
    .nullable()
    .optional()
    .transform((value) => {
      if (value === null || value === undefined) {
        return null;
      }
      if (typeof value === 'string' && value === 'null') {
        return null;
      }
      const numeric = Number(value);
      return Number.isNaN(numeric) ? null : numeric;
    })
});

export const createFilesRouter = (context: ApplicationContext) => {
  const router = Router();

  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const query = listSchema.parse(req.query ?? {});
      const tenantId = req.currentUser!.tenantId;
      const parentId = (() => {
        if (query.parent_id === undefined) {
          return undefined;
        }
        if (query.parent_id === 'null') {
          return null;
        }
        const value = Number(query.parent_id);
        return Number.isNaN(value) ? undefined : value;
      })();
      const deleted = query.deleted ? query.deleted === 'true' : undefined;
      const cursor = query.cursor ? Number.parseInt(query.cursor, 10) : undefined;
      const pageSize = query.page_size ? Number.parseInt(query.page_size, 10) : undefined;

      const result = await listFiles(context.db, {
        tenantId,
        diskCode: query.disk ?? undefined,
        parentId,
        deleted,
        search: query.q ?? undefined,
        cursor,
        pageSize
      });

      sendSuccess(res, {
        items: result.items,
        next_cursor: result.nextCursor
      });
    })
  );

  router.post(
    '/folders',
    requireAuth,
    asyncHandler(async (req, res) => {
      const payload = createFolderSchema.parse(req.body ?? {});
      const tenantId = req.currentUser!.tenantId;
      const ownerId = req.currentUser!.id;
      await createFolder(context.db, tenantId, payload.disk, payload.parent_id ?? null, payload.name, ownerId);
      sendSuccess(res, { created: true });
    })
  );

  router.patch(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = Number.parseInt(req.params.id, 10);
      const payload = renameSchema.parse(req.body ?? {});
      const tenantId = req.currentUser!.tenantId;
      await renameFile(context.db, tenantId, id, payload.name);
      sendSuccess(res, { updated: true });
    })
  );

  router.delete(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = Number.parseInt(req.params.id, 10);
      const force = req.query.force === 'true';
      const tenantId = req.currentUser!.tenantId;
      await softDeleteFile(context.db, tenantId, id, force);
      sendSuccess(res, { removed: true });
    })
  );

  router.post(
    '/restore/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = Number.parseInt(req.params.id, 10);
      const tenantId = req.currentUser!.tenantId;
      await restoreFile(context.db, tenantId, id);
      sendSuccess(res, { restored: true });
    })
  );

  router.post(
    '/copy',
    requireAuth,
    asyncHandler(async (req, res) => {
      const payload = copySchema.parse(req.body ?? {});
      const tenantId = req.currentUser!.tenantId;
      const ownerId = req.currentUser!.id;
      const diskId = typeof payload.target_disk === 'number'
        ? payload.target_disk
        : /^\d+$/.test(payload.target_disk)
          ? Number(payload.target_disk)
          : (await resolveDisk(context.db, tenantId, payload.target_disk)).id;
      const taskId = await context.taskScheduler.queueCopyTask({
        sourceId: payload.id,
        targetDiskId: diskId,
        targetParentId: payload.target_parent_id ?? null,
        tenantId,
        ownerId
      });
      sendSuccess(res, { task_id: taskId });
    })
  );

  return router;
};
