import { Kysely, sql } from 'kysely';
import type { Database, FilesTable } from '../../database/schema.js';
import { createBadRequestError, createConflictError, createNotFoundError } from '../../core/errors.js';
import { nowIso } from '../../core/utils/time.js';

export interface ListFilesOptions {
  tenantId: string;
  diskCode?: string;
  parentId?: number | null;
  deleted?: boolean;
  search?: string;
  cursor?: number;
  pageSize?: number;
}

export interface ListFilesResultItem {
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
}

export interface ListFilesResult {
  items: ListFilesResultItem[];
  nextCursor: string | null;
}

export const listFiles = async (db: Kysely<Database>, options: ListFilesOptions): Promise<ListFilesResult> => {
  const disk = await resolveDisk(db, options.tenantId, options.diskCode);
  const pageSize = Math.min(Math.max(options.pageSize ?? 20, 1), 100);
  const offset = Math.max(options.cursor ?? 0, 0);

  let query = db
    .selectFrom('files')
    .select(['id', 'name', 'is_dir', 'ext', 'mime', 'size', 'path', 'hash', 'updated_at', 'parent_id'])
    .where('tenant_id', '=', options.tenantId)
    .where('disk_id', '=', disk.id);

  if (options.parentId === undefined) {
    query = query.where('parent_id', 'is', null);
  } else {
    query = options.parentId === null ? query.where('parent_id', 'is', null) : query.where('parent_id', '=', options.parentId);
  }

  if (options.deleted === true) {
    query = query.where('deleted_at', 'is not', null);
  } else if (options.deleted === false || options.deleted === undefined) {
    query = query.where('deleted_at', 'is', null);
  }

  if (options.search) {
    const like = `%${options.search}%`;
    query = query.where((eb) =>
      eb.or([
        eb('name', 'like', like),
        eb('mime', 'like', like)
      ])
    );
  }

  const rows = await query
    .orderBy('is_dir', 'desc')
    .orderBy('updated_at', 'desc')
    .orderBy('name', 'asc')
    .limit(pageSize + 1)
    .offset(offset)
    .execute();

  const hasMore = rows.length > pageSize;
  const items = rows.slice(0, pageSize).map((row) => mapFileRow(row, disk.code));
  const nextCursor = hasMore ? String(offset + pageSize) : null;

  return { items, nextCursor };
};

export const createFolder = async (
  db: Kysely<Database>,
  tenantId: string,
  diskCode: string | undefined,
  parentId: number | null,
  name: string,
  ownerId: number
) => {
  const disk = await resolveDisk(db, tenantId, diskCode);
  const parent = parentId ? await fetchFile(db, tenantId, parentId) : null;

  if (parentId && !parent) {
    throw createNotFoundError('父目录不存在');
  }
  if (parent && parent.is_dir !== 1) {
    throw createBadRequestError('父节点不是目录');
  }

  await ensureUniqueName(db, tenantId, disk.id, parentId, name);

  const parentPath = parent ? parent.path : '/';
  const path = buildPath(parentPath, name);
  await db
    .insertInto('files')
    .values({
      tenant_id: tenantId,
      disk_id: disk.id,
      parent_id: parentId,
      name,
      ext: null,
      mime: null,
      hash: null,
      size: 0,
      path,
      is_dir: 1,
      deleted_at: null,
      created_at: nowIso(),
      updated_at: nowIso(),
      owner_id: ownerId
    })
    .execute();
};

export const renameFile = async (
  db: Kysely<Database>,
  tenantId: string,
  fileId: number,
  newName: string
) => {
  const file = await fetchFile(db, tenantId, fileId);
  if (!file) {
    throw createNotFoundError('文件不存在');
  }
  const parentId = file.parent_id ?? null;
  await ensureUniqueName(db, tenantId, file.disk_id, parentId, newName, fileId);

  const parentPath = parentId ? (await fetchFile(db, tenantId, parentId))?.path ?? '/' : '/';
  const newPath = buildPath(parentPath, newName);

  await db
    .updateTable('files')
    .set({ name: newName, path: newPath, updated_at: nowIso() })
    .where('id', '=', fileId)
    .execute();

  if (file.is_dir === 1) {
    const oldPrefix = file.path === '/' ? '/' : `${file.path}/`;
    const newPrefix = newPath === '/' ? '/' : `${newPath}/`;
    await db
      .updateTable('files')
      .set({
        path: sql`REPLACE(path, ${oldPrefix}, ${newPrefix})`
      })
      .where('tenant_id', '=', tenantId)
      .where('path', 'like', `${oldPrefix}%`)
      .execute();
  }
};

export const softDeleteFile = async (
  db: Kysely<Database>,
  tenantId: string,
  fileId: number,
  force: boolean
) => {
  const file = await fetchFile(db, tenantId, fileId);
  if (!file) {
    throw createNotFoundError('文件不存在');
  }

  const ids = await collectDescendantIds(db, tenantId, fileId, true);
  if (force) {
    await db.deleteFrom('files').where('tenant_id', '=', tenantId).where('id', 'in', ids).execute();
  } else {
    const deletedAt = nowIso();
    await db
      .updateTable('files')
      .set({ deleted_at: deletedAt, updated_at: deletedAt })
      .where('tenant_id', '=', tenantId)
      .where('id', 'in', ids)
      .execute();
  }
};

export const restoreFile = async (db: Kysely<Database>, tenantId: string, fileId: number) => {
  const file = await fetchFile(db, tenantId, fileId);
  if (!file) {
    throw createNotFoundError('文件不存在');
  }
  if (!file.deleted_at) {
    return;
  }

  if (file.parent_id) {
    const parent = await fetchFile(db, tenantId, file.parent_id);
    if (parent && parent.deleted_at) {
      throw createBadRequestError('父目录仍在回收站');
    }
  }

  const ids = await collectDescendantIds(db, tenantId, fileId, true);
  await db
    .updateTable('files')
    .set({ deleted_at: null, updated_at: nowIso() })
    .where('tenant_id', '=', tenantId)
    .where('id', 'in', ids)
    .execute();
};

export const emptyRecycleBin = async (db: Kysely<Database>, tenantId: string) => {
  await db
    .deleteFrom('files')
    .where('tenant_id', '=', tenantId)
    .where('deleted_at', 'is not', null)
    .execute();
};

export const resolveDisk = async (db: Kysely<Database>, tenantId: string, diskCode?: string) => {
  const code = diskCode ?? 'local';
  const disk = await db
    .selectFrom('disks')
    .select(['id', 'code'])
    .where('tenant_id', '=', tenantId)
    .where('code', '=', code)
    .executeTakeFirst();

  if (!disk) {
    throw createNotFoundError('磁盘不存在');
  }
  return disk;
};

const fetchFile = async (db: Kysely<Database>, tenantId: string, fileId: number) => {
  return db
    .selectFrom('files')
    .selectAll()
    .where('tenant_id', '=', tenantId)
    .where('id', '=', fileId)
    .executeTakeFirst();
};

const ensureUniqueName = async (
  db: Kysely<Database>,
  tenantId: string,
  diskId: number,
  parentId: number | null,
  name: string,
  excludeId?: number
) => {
  let query = db
    .selectFrom('files')
    .select(['id'])
    .where('tenant_id', '=', tenantId)
    .where('disk_id', '=', diskId)
    .where('deleted_at', 'is', null)
    .where('name', '=', name);

  query = parentId === null ? query.where('parent_id', 'is', null) : query.where('parent_id', '=', parentId);
  if (excludeId) {
    query = query.where('id', '!=', excludeId);
  }
  const conflict = await query.executeTakeFirst();
  if (conflict) {
    throw createConflictError('同级已存在同名文件');
  }
};

const buildPath = (parentPath: string, name: string) => {
  if (parentPath === '/' || parentPath === '') {
    return `/${name}`;
  }
  return `${parentPath}/${name}`;
};

const mapFileRow = (row: Pick<FilesTable, 'id' | 'name' | 'is_dir' | 'ext' | 'mime' | 'size' | 'path' | 'hash' | 'updated_at' | 'parent_id'>, diskCode: string): ListFilesResultItem => ({
  id: row.id,
  name: row.name,
  is_dir: row.is_dir === 1,
  ext: row.ext,
  mime: row.mime,
  size: row.size,
  disk: diskCode,
  path: row.path,
  hash: row.hash,
  updated_at: row.updated_at,
  parent_id: row.parent_id ?? null
});

const collectDescendantIds = async (
  db: Kysely<Database>,
  tenantId: string,
  fileId: number,
  includeSelf: boolean
): Promise<number[]> => {
  const ids = new Set<number>();
  const queue: number[] = [fileId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (ids.has(current)) {
      continue;
    }
    if (current !== fileId || includeSelf) {
      ids.add(current);
    }
    const children = await db
      .selectFrom('files')
      .select(['id'])
      .where('tenant_id', '=', tenantId)
      .where('parent_id', '=', current)
      .execute();
    for (const child of children) {
      queue.push(child.id);
    }
  }

  return Array.from(ids);
};
