import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import { type Kysely } from 'kysely';
import { env } from '../config/env.js';
import type { Database } from './schema.js';
import { logger } from '../core/logger.js';

const DEFAULT_ADMIN = {
  username: 'admin',
  password: 'admin123',
  role: 'ADMIN' as const
};

export const seedDatabase = async (db: Kysely<Database>) => {
  const admin = await db
    .selectFrom('users')
    .select(['id'])
    .where('tenant_id', '=', env.DEFAULT_TENANT)
    .where('username', '=', DEFAULT_ADMIN.username)
    .executeTakeFirst();

  if (!admin) {
    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN.password, 10);
    const inserted = await db
      .insertInto('users')
      .values({
        tenant_id: env.DEFAULT_TENANT,
        username: DEFAULT_ADMIN.username,
        password_hash: passwordHash,
        role: DEFAULT_ADMIN.role,
        status: 'ACTIVE'
      })
      .executeTakeFirst();

    const adminId = inserted?.insertId ? Number(inserted.insertId) : undefined;
    if (adminId == null) {
      const adminRow = await db
        .selectFrom('users')
        .select(['id'])
        .where('tenant_id', '=', env.DEFAULT_TENANT)
        .where('username', '=', DEFAULT_ADMIN.username)
        .executeTakeFirst();
      if (!adminRow) {
        throw new Error('无法创建默认管理员');
      }
      await createDefaultDiskAndRoot(db, adminRow.id);
    } else {
      await createDefaultDiskAndRoot(db, adminId);
    }
    logger.info('默认管理员账号已创建：admin / admin123');
  } else {
    logger.info('默认管理员账号已存在，跳过初始化');
  }

  // Update timestamps to now for new rows to avoid outdated values
  await db
    .updateTable('users')
    .set({ updated_at: dayjs().toISOString() })
    .where('tenant_id', '=', env.DEFAULT_TENANT)
    .execute();
};

const createDefaultDiskAndRoot = async (db: Kysely<Database>, adminId: number) => {
  const disk = await db
    .selectFrom('disks')
    .select(['id'])
    .where('tenant_id', '=', env.DEFAULT_TENANT)
    .where('code', '=', 'local')
    .executeTakeFirst();

  if (!disk) {
    await db
      .insertInto('disks')
      .values({
        tenant_id: env.DEFAULT_TENANT,
        code: 'local',
        name: '本地盘',
        type: 'LOCAL',
        config: JSON.stringify({ root: './storage' }),
        owner_id: adminId
      })
      .execute();
  }

  const diskRow = disk ??
    (await db
      .selectFrom('disks')
      .select(['id'])
      .where('tenant_id', '=', env.DEFAULT_TENANT)
      .where('code', '=', 'local')
      .executeTakeFirst());

  if (!diskRow) {
    throw new Error('无法创建默认磁盘');
  }

  const rootExists = await db
    .selectFrom('files')
    .select(['id'])
    .where('tenant_id', '=', env.DEFAULT_TENANT)
    .where('disk_id', '=', diskRow.id)
    .where('parent_id', 'is', null)
    .where('name', '=', 'root')
    .executeTakeFirst();

  if (!rootExists) {
    await db
      .insertInto('files')
      .values({
        tenant_id: env.DEFAULT_TENANT,
        disk_id: diskRow.id,
        parent_id: null,
        name: 'root',
        ext: null,
        mime: null,
        hash: null,
        size: 0,
        path: '/',
        is_dir: 1,
        deleted_at: null,
        owner_id: adminId
      })
      .execute();
  }
};
