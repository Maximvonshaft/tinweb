import bcrypt from 'bcryptjs';
import type { Kysely } from 'kysely';
import { randomUUID } from 'node:crypto';
import dayjs from 'dayjs';
import { nanoid } from 'nanoid';
import type { Database } from '../../database/schema.js';
import {
  createBadRequestError,
  createForbiddenError,
  createNotFoundError
} from '../../core/errors.js';
import { nowIso } from '../../core/utils/time.js';
import { getFileMetadata } from '../files/files.service.js';
import { buildFilePreview, createPreviewStream } from '../files/preview.service.js';
import type { FilePreviewResult } from '../files/preview.service.js';

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

export interface ShareCreationResult {
  token: string;
  requires_password: boolean;
  expires_at: string | null;
}

interface CreateShareOptions {
  password?: string | null;
  expiresInHours?: number | null;
}

export const createShare = async (
  db: Kysely<Database>,
  tenantId: string,
  fileId: number,
  userId: number,
  options: CreateShareOptions
): Promise<ShareCreationResult> => {
  const file = await getFileMetadata(db, tenantId, fileId);
  if (!file) {
    throw createNotFoundError('文件不存在');
  }
  if (file.deleted_at) {
    throw createBadRequestError('文件已删除，无法分享');
  }

  let token: string | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = nanoid(12);
    const existing = await db
      .selectFrom('shares')
      .select(['id'])
      .where('token', '=', candidate)
      .executeTakeFirst();
    if (!existing) {
      token = candidate;
      break;
    }
  }

  if (!token) {
    throw new Error('生成分享令牌失败');
  }

  const expiresAt = options.expiresInHours && options.expiresInHours > 0
    ? dayjs().add(options.expiresInHours, 'hour').toISOString()
    : null;
  const requiresPassword = Boolean(options.password);
  const passwordHash = options.password ? await bcrypt.hash(options.password, 10) : null;

  await db
    .insertInto('shares')
    .values({
      tenant_id: tenantId,
      token,
      file_id: fileId,
      requires_password: requiresPassword ? 1 : 0,
      password_hash: passwordHash,
      expires_at: expiresAt,
      created_by_id: userId,
      created_at: nowIso()
    })
    .execute();

  return { token, requires_password: requiresPassword, expires_at: expiresAt };
};

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

type ShareAccessRow = {
  id: number;
  tenant_id: string;
  file_id: number;
  requires_password: number;
  expires_at: string | null;
  deleted_at: string | null;
};

const ensureShareAccessible = async (
  db: Kysely<Database>,
  token: string,
  sessionToken: string | undefined
): Promise<ShareAccessRow> => {
  const share = await db
    .selectFrom('shares')
    .innerJoin('files', 'files.id', 'shares.file_id')
    .select([
      'shares.id',
      'shares.tenant_id',
      'shares.file_id',
      'shares.requires_password',
      'shares.expires_at',
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
      .select(['expires_at'])
      .where('share_id', '=', share.id)
      .where('session_token', '=', sessionToken)
      .executeTakeFirst();
    if (!session) {
      throw createForbiddenError('分享会话无效');
    }
    if (dayjs(session.expires_at).isBefore(dayjs())) {
      throw createForbiddenError('分享会话已过期');
    }
  }

  return share;
};

export const getShareDownloadInfo = async (
  db: Kysely<Database>,
  token: string,
  sessionToken: string | undefined
): Promise<ShareDownloadInfo> => {
  const share = await ensureShareAccessible(db, token, sessionToken);
  const query = share.requires_password ? `?session=${sessionToken}` : '';
  return {
    url: `/s/${token}/content${query}`
  };
};

export const getSharePreview = async (
  db: Kysely<Database>,
  token: string,
  sessionToken: string | undefined
): Promise<FilePreviewResult> => {
  const share = await ensureShareAccessible(db, token, sessionToken);
  const metadata = await getFileMetadata(db, share.tenant_id, share.file_id);
  if (!metadata) {
    throw createNotFoundError('分享文件不存在');
  }
  const query = share.requires_password ? `?session=${sessionToken}` : '';
  return buildFilePreview(metadata, `/s/${token}/content${query}`);
};

export const getShareContent = async (
  db: Kysely<Database>,
  token: string,
  sessionToken: string | undefined
) => {
  const share = await ensureShareAccessible(db, token, sessionToken);
  const metadata = await getFileMetadata(db, share.tenant_id, share.file_id);
  if (!metadata) {
    throw createNotFoundError('分享文件不存在');
  }
  if (metadata.deleted_at) {
    throw createNotFoundError('分享文件已删除');
  }
  return {
    metadata,
    stream: createPreviewStream(metadata)
  };
};
