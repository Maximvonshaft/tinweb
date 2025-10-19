import { Kysely } from 'kysely';
import type { Database } from '../../database/schema.js';

export interface HealthSummary {
  disks: Array<{ name: string; status: 'ok' | 'degraded' | 'down'; latency_ms: number; note: string | null }>;
  queue: { waiting: number; running: number; failed: number };
}

export const getHealthSummary = async (db: Kysely<Database>): Promise<HealthSummary> => {
  const disks = await db.selectFrom('disks').select(['name']).execute();
  const [waiting, running, failed] = await Promise.all([
    countTasks(db, 'PENDING'),
    countTasks(db, 'RUNNING'),
    countTasks(db, 'FAILED')
  ]);

  const healthDisks = disks.map((disk) => ({
    name: disk.name,
    status: 'ok' as const,
    latency_ms: 20,
    note: null
  }));

  return {
    disks: healthDisks,
    queue: {
      waiting,
      running,
      failed
    }
  };
};

const countTasks = async (db: Kysely<Database>, status: string) => {
  const result = await db
    .selectFrom('tasks')
    .select((eb) => eb.fn.count<number>('id').as('count'))
    .where('status', '=', status)
    .executeTakeFirst();
  return result?.count ?? 0;
};
