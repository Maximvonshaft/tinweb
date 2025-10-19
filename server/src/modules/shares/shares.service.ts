import bcrypt from 'bcryptjs';
import { Kysely } from 'kysely';
import { randomUUID } from 'node:crypto';
import dayjs from 'dayjs';
import type { Database } from '../../database/schema.js';
import {
  createBadRequestError,
  createForbiddenError,
  createNotFoundError
} from '../../core/errors.js';
import { nowIso } from '../../core/utils/time.js';

export interface ShareDetailResult {
  file: {
    id: number;
    name: string;
    is_dir: boolean;
    ext: string | null;
    mime: string | null;
    size: number;
    disk: string;
    path: string;
    hash: string | null;
    updated_at: string;
    parent_id: number | null;
  };
  requires_password: boolean;
  expires_at: string | null;
}

export interface ShareDownloadInfo {
  url: string;
  headers?: Record<string, string>;
}

export const getShareDetail = async (db: Kysely<Database>, token: string): Promise<ShareDetailResult> => {
  const share = await db
    .selectFrom('shares')
    .innerJoin('files', 'files.id', 'shares.file_id')
    .innerJoin('disks', 'disks.id', 'files.disk_id')
    .select([
      'shares.id as share_id',
      'shares.expires_at',
      'shares.requires_password',
      'shares.password_hash',
      'files.id as file_id',
      'files.name',
      'files.is_dir',
      'files.ext',
      'files.mime',
      'files.size',
      'files.path',
      'files.hash',
      'files.updated_at',
      'files.parent_id',
      'disks.code as disk_code',
      'files.deleted_at'
    ])
    .where('shares.token', '=', token)
    .executeTakeFirst();

  if (!share) {
    throw createNotFoundError('分享不存在');
  }

  if (share.deleted_at) {
    throw createNotFoundError('分享文件已删除');
  }

  if (share.expires_at && dayjs(share.expires_at).isBefore(dayjs())) {
    throw createNotFoundError('分享已过期');
  }

  return {
    file: {
      id: share.file_id,
      name: share.name,
      is_dir: share.is_dir === 1,
      ext: share.ext,
      mime: share.mime,
      size: share.size,
      disk: share.disk_code,
      path: share.path,
      hash: share.hash,
      updated_at: share.updated_at,
      parent_id: share.parent_id ?? null
    },
    requires_password: share.requires_password === 1,
    expires_at: share.expires_at ?? null
  };
};

export const unlockShare = async (
  db: Kysely<Database>,
  token: string,
  password: string | null
): Promise<{ unlocked: boolean; session_token: string }> => {
  const share = await db
    .selectFrom('shares')
    .selectAll()
    .where('token', '=', token)
    .executeTakeFirst();

  if (!share) {
    throw createNotFoundError('分享不存在');
  }

  if (share.expires_at && dayjs(share.expires_at).isBefore(dayjs())) {
    throw createBadRequestError('分享已过期');
  }

  if (share.requires_password) {
    if (!password) {
      throw createBadRequestError('需要口令');
    }
    const ok = share.password_hash ? await bcrypt.compare(password, share.password_hash) : false;
    if (!ok) {
      throw createForbiddenError('口令错误');
    }
  }

  const sessionToken = randomUUID();
  const expiresAt = dayjs().add(12, 'hour').toISOString();
  await db
    .insertInto('share_sessions')
    .values({
      tenant_id: share.tenant_id,
      share_id: share.id,
      session_token: sessionToken,
      expires_at: expiresAt,
      created_at: nowIso()
    })
    .execute();

  return { unlocked: true, session_token: sessionToken };
};

export const getShareDownloadInfo = async (
  db: Kysely<Database>,
  token: string,
  sessionToken: string | undefined
): Promise<ShareDownloadInfo> => {
  const share = await db
    .selectFrom('shares')
    .innerJoin('files', 'files.id', 'shares.file_id')
    .innerJoin('disks', 'disks.id', 'files.disk_id')
    .select([
      'shares.id as share_id',
      'shares.requires_password',
      'shares.expires_at',
      'shares.tenant_id',
      'files.id as file_id',
      'files.deleted_at'
    ])
    .where('shares.token', '=', token)
    .executeTakeFirst();

  if (!share) {
    throw createNotFoundError('分享不存在');
  }

  if (share.deleted_at) {
    throw createNotFoundError('分享文件已删除');
  }

  if (share.expires_at && dayjs(share.expires_at).isBefore(dayjs())) {
    throw createBadRequestError('分享已过期');
  }

  if (share.requires_password) {
    if (!sessionToken) {
      throw createForbiddenError('缺少分享会话');
    }
    const session = await db
      .selectFrom('share_sessions')
      .selectAll()
      .where('share_id', '=', share.share_id)
      .where('session_token', '=', sessionToken)
      .executeTakeFirst();

    if (!session) {
      throw createForbiddenError('分享会话无效');
    }
    if (dayjs(session.expires_at).isBefore(dayjs())) {
      throw createForbiddenError('分享会话已过期');
    }
  }

  // 模拟下载地址，实际可对接对象存储
  return {
    url: `/download/${share.file_id}`
  };
};
