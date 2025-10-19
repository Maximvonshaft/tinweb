import { sql, type Kysely } from 'kysely';
import type { Database } from './schema.js';
import { logger } from '../core/logger.js';

interface Migration {
  name: string;
  up: (db: Kysely<Database>) => Promise<void>;
}

const migrations: Migration[] = [
  {
    name: '000_init_schema',
    up: async (db) => {
      await db.schema
        .createTable('users')
        .ifNotExists()
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('tenant_id', 'text', (col) => col.notNull())
        .addColumn('username', 'text', (col) => col.notNull())
        .addColumn('password_hash', 'text', (col) => col.notNull())
        .addColumn('role', 'text', (col) => col.notNull().defaultTo('USER'))
        .addColumn('status', 'text', (col) => col.notNull().defaultTo('ACTIVE'))
        .addColumn('last_login_at', 'text')
        .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .execute();

      await db.schema
        .createIndex('idx_users_tenant_username')
        .ifNotExists()
        .on('users')
        .columns(['tenant_id', 'username'])
        .unique()
        .execute();

      await db.schema
        .createTable('disks')
        .ifNotExists()
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('tenant_id', 'text', (col) => col.notNull())
        .addColumn('code', 'text', (col) => col.notNull())
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('type', 'text', (col) => col.notNull())
        .addColumn('config', 'text', (col) => col.notNull())
        .addColumn('owner_id', 'integer', (col) => col.notNull().references('users.id'))
        .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .execute();

      await db.schema
        .createIndex('idx_disks_tenant_code')
        .ifNotExists()
        .on('disks')
        .columns(['tenant_id', 'code'])
        .unique()
        .execute();

      await db.schema
        .createTable('files')
        .ifNotExists()
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('tenant_id', 'text', (col) => col.notNull())
        .addColumn('disk_id', 'integer', (col) => col.notNull().references('disks.id').onDelete('cascade'))
        .addColumn('parent_id', 'integer', (col) => col.references('files.id').onDelete('set null'))
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('ext', 'text')
        .addColumn('mime', 'text')
        .addColumn('hash', 'text')
        .addColumn('size', 'integer', (col) => col.notNull().defaultTo(0))
        .addColumn('path', 'text', (col) => col.notNull())
        .addColumn('is_dir', 'integer', (col) => col.notNull().defaultTo(0))
        .addColumn('deleted_at', 'text')
        .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .addColumn('owner_id', 'integer', (col) => col.notNull().references('users.id'))
        .execute();

      await db.schema
        .createIndex('idx_files_listing')
        .ifNotExists()
        .on('files')
        .columns(['tenant_id', 'disk_id', 'parent_id', 'is_dir', 'deleted_at'])
        .execute();

      await db.schema
        .createIndex('idx_files_deleted')
        .ifNotExists()
        .on('files')
        .columns(['tenant_id', 'deleted_at'])
        .execute();

      await db.schema
        .createTable('tasks')
        .ifNotExists()
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('tenant_id', 'text', (col) => col.notNull())
        .addColumn('type', 'text', (col) => col.notNull())
        .addColumn('status', 'text', (col) => col.notNull().defaultTo('PENDING'))
        .addColumn('progress', 'integer', (col) => col.notNull().defaultTo(0))
        .addColumn('payload', 'text', (col) => col.notNull())
        .addColumn('result', 'text')
        .addColumn('error', 'text')
        .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .addColumn('owner_id', 'integer', (col) => col.notNull().references('users.id'))
        .execute();

      await db.schema
        .createTable('shares')
        .ifNotExists()
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('tenant_id', 'text', (col) => col.notNull())
        .addColumn('token', 'text', (col) => col.notNull().unique())
        .addColumn('file_id', 'integer', (col) => col.notNull().references('files.id').onDelete('cascade'))
        .addColumn('requires_password', 'integer', (col) => col.notNull().defaultTo(0))
        .addColumn('password_hash', 'text')
        .addColumn('expires_at', 'text')
        .addColumn('created_by_id', 'integer', (col) => col.notNull().references('users.id'))
        .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .execute();

      await db.schema
        .createTable('share_sessions')
        .ifNotExists()
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('tenant_id', 'text', (col) => col.notNull())
        .addColumn('share_id', 'integer', (col) => col.notNull().references('shares.id').onDelete('cascade'))
        .addColumn('session_token', 'text', (col) => col.notNull().unique())
        .addColumn('expires_at', 'text', (col) => col.notNull())
        .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .execute();

      await db.schema
        .createTable('audit_logs')
        .ifNotExists()
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('tenant_id', 'text', (col) => col.notNull())
        .addColumn('user_id', 'integer', (col) => col.references('users.id'))
        .addColumn('action', 'text', (col) => col.notNull())
        .addColumn('metadata', 'text')
        .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .execute();
    }
  }
];

export const migrateToLatest = async (db: Kysely<Database>) => {
  await db.schema
    .createTable('migrations')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('name', 'text', (col) => col.notNull().unique())
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  const executed = await db.selectFrom('migrations').select(['name']).execute();
  const executedNames = new Set(executed.map((row) => row.name));

  for (const migration of migrations) {
    if (executedNames.has(migration.name)) {
      continue;
    }
    logger.info({ migration: migration.name }, '执行数据库迁移');
    await migration.up(db);
    await db.insertInto('migrations').values({ name: migration.name }).execute();
  }
};
