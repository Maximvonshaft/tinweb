import type { Kysely } from 'kysely';
import { nowIso } from '../../core/utils/time.js';
import type { Database, TasksTable } from '../../database/schema.js';
import { logger } from '../../core/logger.js';
import { createBadRequestError, createNotFoundError } from '../../core/errors.js';

export interface CopyTaskPayload {
  sourceId: number;
  targetDiskId: number;
  targetParentId: number | null;
  tenantId: string;
  ownerId: number;
}

export type TaskScheduler = ReturnType<typeof createTaskScheduler>;

const buildPath = (parentPath: string, name: string) => {
  if (parentPath === '/' || parentPath === '') {
    return `/${name}`;
  }
  return `${parentPath}/${name}`;
};

export const createTaskScheduler = (db: Kysely<Database>, pollInterval = 2000) => {
  let timer: NodeJS.Timeout | undefined;
  let running = false;

  const start = () => {
    if (!timer) {
      timer = setInterval(() => {
        void tick();
      }, pollInterval);
    }
  };

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };

  const tick = async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      const nextTask = await db
        .selectFrom('tasks')
        .selectAll()
        .where('status', '=', 'PENDING')
        .orderBy('created_at', 'asc')
        .executeTakeFirst();

      if (!nextTask) {
        return;
      }

      await processTask(nextTask);
    } catch (error) {
      logger.error({ err: error }, '处理任务失败');
    } finally {
      running = false;
    }
  };

  const queueCopyTask = async (payload: CopyTaskPayload) => {
    const insertResult = await db
      .insertInto('tasks')
      .values({
        tenant_id: payload.tenantId,
        type: 'COPY',
        status: 'PENDING',
        progress: 0,
        payload: JSON.stringify(payload),
        created_at: nowIso(),
        updated_at: nowIso(),
        owner_id: payload.ownerId
      })
      .executeTakeFirst();

    const taskId = insertResult?.insertId ? Number(insertResult.insertId) : undefined;
    if (taskId) {
      return taskId;
    }

    const created = await db
      .selectFrom('tasks')
      .select(['id'])
      .where('tenant_id', '=', payload.tenantId)
      .orderBy('id', 'desc')
      .executeTakeFirst();

    if (!created) {
      throw new Error('任务创建失败');
    }

    return created.id;
  };

  const processTask = async (task: TasksTable) => {
    await db
      .updateTable('tasks')
      .set({ status: 'RUNNING', updated_at: nowIso(), progress: 0 })
      .where('id', '=', task.id)
      .execute();

    try {
      const payload = JSON.parse(task.payload) as CopyTaskPayload;
      await processCopyTask(task.id, payload);
      await db
        .updateTable('tasks')
        .set({ status: 'SUCCESS', progress: 100, updated_at: nowIso() })
        .where('id', '=', task.id)
        .execute();
    } catch (error) {
      logger.error({ err: error, taskId: task.id }, '任务执行失败');
      await db
        .updateTable('tasks')
        .set({
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'unknown error',
          updated_at: nowIso()
        })
        .where('id', '=', task.id)
        .execute();
    }
  };

  const processCopyTask = async (taskId: number, payload: CopyTaskPayload) => {
    const source = await db
      .selectFrom('files')
      .selectAll()
      .where('id', '=', payload.sourceId)
      .where('tenant_id', '=', payload.tenantId)
      .executeTakeFirst();

    if (!source) {
      throw createNotFoundError('源文件不存在');
    }
    if (source.deleted_at) {
      throw createBadRequestError('无法复制已删除的文件');
    }

    const targetDisk = await db
      .selectFrom('disks')
      .selectAll()
      .where('id', '=', payload.targetDiskId)
      .where('tenant_id', '=', payload.tenantId)
      .executeTakeFirst();

    if (!targetDisk) {
      throw createNotFoundError('目标磁盘不存在');
    }

    let rootParentPath = '/';
    if (payload.targetParentId) {
      const parent = await db
        .selectFrom('files')
        .select(['path', 'is_dir'])
        .where('id', '=', payload.targetParentId)
        .where('tenant_id', '=', payload.tenantId)
        .executeTakeFirst();

      if (!parent) {
        throw createNotFoundError('目标父节点不存在');
      }
      if (parent.is_dir !== 1) {
        throw createBadRequestError('目标父节点不是文件夹');
      }
      rootParentPath = parent.path;
    }

    const queue: Array<{ sourceId: number; targetParentId: number | null; targetParentPath: string }> = [
      { sourceId: source.id, targetParentId: payload.targetParentId, targetParentPath: rootParentPath }
    ];
    const totalCount = await countDescendantsIncludingSelf(payload.sourceId, payload.tenantId);
    let processed = 0;

    while (queue.length > 0) {
      const { sourceId, targetParentId, targetParentPath } = queue.shift()!;
      const sourceNode = await db
        .selectFrom('files')
        .selectAll()
        .where('id', '=', sourceId)
        .executeTakeFirst();

      if (!sourceNode) {
        throw createNotFoundError('部分源文件丢失');
      }

      const newPath = buildPath(targetParentPath, sourceNode.name);
      const insert = await db
        .insertInto('files')
        .values({
          tenant_id: payload.tenantId,
          disk_id: payload.targetDiskId,
          parent_id: targetParentId,
          name: sourceNode.name,
          ext: sourceNode.ext,
          mime: sourceNode.mime,
          hash: sourceNode.hash,
          size: sourceNode.size,
          path: newPath,
          is_dir: sourceNode.is_dir,
          deleted_at: null,
          created_at: nowIso(),
          updated_at: nowIso(),
          owner_id: payload.ownerId
        })
        .executeTakeFirst();

      const createdId = insert?.insertId ? Number(insert.insertId) : await fetchLatestInsertedFileId(payload.tenantId);
      if (createdId == null) {
        throw new Error('写入复制文件失败');
      }

      processed += 1;
      await updateTaskProgress(taskId, Math.min(99, Math.floor((processed / totalCount) * 100)));

      if (sourceNode.is_dir === 1) {
        const children = await db
          .selectFrom('files')
          .select(['id'])
          .where('parent_id', '=', sourceNode.id)
          .where('tenant_id', '=', payload.tenantId)
          .where('deleted_at', 'is', null)
          .execute();
        for (const child of children) {
          queue.push({
            sourceId: child.id,
            targetParentId: createdId,
            targetParentPath: newPath
          });
        }
      }
    }
  };

  const countDescendantsIncludingSelf = async (sourceId: number, tenantId: string) => {
    const visited = new Set<number>();
    const queue: number[] = [sourceId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      const children = await db
        .selectFrom('files')
        .select(['id'])
        .where('parent_id', '=', current)
        .where('tenant_id', '=', tenantId)
        .where('deleted_at', 'is', null)
        .execute();
      for (const child of children) {
        queue.push(child.id);
      }
    }

    return visited.size;
  };

  const fetchLatestInsertedFileId = async (tenantId: string): Promise<number | undefined> => {
    const row = await db
      .selectFrom('files')
      .select(['id'])
      .where('tenant_id', '=', tenantId)
      .orderBy('id', 'desc')
      .executeTakeFirst();
    return row?.id;
  };

  const updateTaskProgress = async (taskId: number, progress: number) => {
    await db
      .updateTable('tasks')
      .set({ progress, updated_at: nowIso() })
      .where('id', '=', taskId)
      .execute();
  };

  return {
    start,
    stop,
    queueCopyTask
  };
};
