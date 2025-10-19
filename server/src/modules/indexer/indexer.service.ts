import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Database } from '../../database/schema.js';
import { nowIso } from '../../core/utils/time.js';

export interface IndexerSummary {
  files: number;
  directories: number;
  duration_ms: number;
  indexed_at: string;
}

export const runIndexer = async (
  db: Kysely<Database>,
  tenantId: string,
  userId: number
): Promise<IndexerSummary> => {
  const started = Date.now();
  const stats = await db
    .selectFrom('files')
    .select([
      sql<number>`SUM(CASE WHEN is_dir = 0 THEN 1 ELSE 0 END)`.as('files'),
      sql<number>`SUM(CASE WHEN is_dir = 1 THEN 1 ELSE 0 END)`.as('directories')
    ])
    .where('tenant_id', '=', tenantId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  const summary: IndexerSummary = {
    files: stats?.files ?? 0,
    directories: stats?.directories ?? 0,
    duration_ms: Date.now() - started,
    indexed_at: nowIso()
  };

  await db
    .insertInto('audit_logs')
    .values({
      tenant_id: tenantId,
      user_id: userId,
      action: 'INDEX_RUN',
      metadata: JSON.stringify(summary),
      created_at: summary.indexed_at
    })
    .execute();

  return summary;
};
