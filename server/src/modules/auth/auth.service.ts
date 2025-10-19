import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Kysely } from 'kysely';
import { env } from '../../config/env.js';
import type { Database } from '../../database/schema.js';
import { createUnauthorizedError } from '../../core/errors.js';
import { nowIso } from '../../core/utils/time.js';

export interface LoginResult {
  accessToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  user: {
    id: number;
    username: string;
    role: 'ADMIN' | 'USER';
  };
}

export const login = async (
  db: Kysely<Database>,
  username: string,
  password: string,
  tenantId: string
): Promise<LoginResult> => {
  const user = await db
    .selectFrom('users')
    .selectAll()
    .where('username', '=', username)
    .where('tenant_id', '=', tenantId)
    .executeTakeFirst();

  if (!user) {
    throw createUnauthorizedError('用户名或密码错误');
  }

  if (user.status !== 'ACTIVE') {
    throw createUnauthorizedError('账户已被禁用');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw createUnauthorizedError('用户名或密码错误');
  }

  const payload = {
    sub: user.id,
    tenantId,
    username: user.username,
    role: user.role
  } satisfies Record<string, unknown>;

  const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

  await db
    .updateTable('users')
    .set({ last_login_at: nowIso(), updated_at: nowIso() })
    .where('id', '=', user.id)
    .execute();

  return {
    accessToken,
    expiresIn: env.JWT_EXPIRES_IN,
    tokenType: 'Bearer',
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    }
  };
};
