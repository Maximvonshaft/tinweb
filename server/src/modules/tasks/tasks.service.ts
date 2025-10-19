import { Kysely } from 'kysely';
import type { Database } from '../../database/schema.js';
import { createNotFoundError } from '../../core/errors.js';

export interface TaskStatusPayload {
  status: 'queued' | 'running' | 'succeed' | 'failed';
  progress: number | null;
  speed_bps: number | null;
  eta_seconds: number | null;
  error: string | null;
}

export const getTaskStatus = async (
  db: Kysely<Database>,
  tenantId: string,
  taskId: number
): Promise<TaskStatusPayload> => {
  const task = await db
    .selectFrom('tasks')
    .selectAll()
    .where('tenant_id', '=', tenantId)
    .where('id', '=', taskId)
    .executeTakeFirst();

  if (!task) {
    throw createNotFoundError('任务不存在');
  }

  return {
    status: mapStatus(task.status),
    progress: task.progress ?? null,
    speed_bps: null,
    eta_seconds: null,
    error: task.error ?? null
  };
};

const mapStatus = (status: string): TaskStatusPayload['status'] => {
  switch (status) {
    case 'PENDING':
      return 'queued';
    case 'RUNNING':
      return 'running';
    case 'SUCCESS':
      return 'succeed';
    case 'FAILED':
    case 'CANCELLED':
    default:
      return 'failed';
  }
};
