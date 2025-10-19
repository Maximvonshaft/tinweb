import DatabaseConstructor from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { env } from '../config/env.js';
import type { Database } from './schema.js';
import { logger } from '../core/logger.js';

export const createDb = () => {
  const sqlite = new DatabaseConstructor(env.DATABASE_URL.replace('file:', ''), {
    fileMustExist: false
  });
  sqlite.pragma('foreign_keys = ON');

  const dialect = new SqliteDialect({ database: sqlite });
  const db = new Kysely<Database>({ dialect });
  logger.info({ url: env.DATABASE_URL }, 'SQLite 数据库初始化完成');
  return db;
};
