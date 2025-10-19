import type {
  DeleteResult,
  DriveSummary,
  FileItem,
  FileListResponse,
  FileRecord,
  TrashItem,
} from './types';

interface ListOptions {
  driveId: string;
  parentId: string | null;
  deleted: boolean;
  cursor?: string | null;
  pageSize?: number;
}

interface CopyOptions {
  id: string;
  targetDriveId: string;
  targetParentId: string | null;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

const DRIVE_CAPACITY: Record<string, number> = {
  local: 500 * 1024 * 1024 * 1024,
  gdrive: 200 * 1024 * 1024 * 1024,
  ty189: 1 * 1024 * 1024 * 1024 * 1024,
};

export class FileStore {
  private records = new Map<string, FileRecord>();
  private children = new Map<string, Set<string>>();
  private sequence = 2000;

  constructor(initialRecords: FileRecord[]) {
    initialRecords.forEach((record) => this.insertRecord(record));
  }

  list(options: ListOptions): FileListResponse {
    const rawPageSize = options.pageSize && options.pageSize > 0 ? options.pageSize : DEFAULT_PAGE_SIZE;
    const pageSize = Math.min(rawPageSize, MAX_PAGE_SIZE);
    const offset = options.cursor ? Number.parseInt(options.cursor, 10) || 0 : 0;
    const all = Array.from(this.records.values()).filter((record) => {
      if (record.driveId !== options.driveId) return false;
      if (record.deleted !== options.deleted) return false;
      if (!options.deleted && (record.parentId ?? null) !== (options.parentId ?? null)) return false;
      return true;
    });
    all.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name, 'zh-Hans');
    });

    const slice = all.slice(offset, offset + pageSize);
    const items = slice.map((record) => this.toFileItem(record));
    const nextCursor = offset + pageSize < all.length ? String(offset + pageSize) : null;
    return { items, next_cursor: nextCursor, has_more: nextCursor !== null };
  }

  listTrash(driveId: string): TrashItem[] {
    const items = Array.from(this.records.values())
      .filter((record) => record.driveId === driveId && record.deleted)
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
    return items.map((record) => ({
      ...this.toFileItem(record),
      deleted_at: new Date(record.deletedAt ?? record.updatedAt).toISOString(),
    }));
  }

  get(id: string): FileRecord | undefined {
    return this.records.get(id);
  }

  getDriveIds(): string[] {
    return Array.from(new Set(Array.from(this.records.values()).map((record) => record.driveId))).sort();
  }

  getDriveSummaries(): DriveSummary[] {
    return this.getDriveIds().map((id) => {
      const { usedBytes, deletedItems } = this.computeDriveStats(id);
      const capacity = DRIVE_CAPACITY[id] ?? usedBytes * 1.2 + 10 * 1024 * 1024 * 1024;
      const available = Math.max(capacity - usedBytes, 0);
      const ratio = capacity === 0 ? 0 : usedBytes / capacity;
      const status = ratio > 0.85 ? 'degraded' : 'ok';
      return {
        id,
        name: id.toUpperCase(),
        status,
        total_bytes: capacity,
        used_bytes: usedBytes,
        available_bytes: available,
        deleted_items: deletedItems,
        description: `总计 ${this.formatBytes(capacity)}，已用 ${this.formatBytes(usedBytes)}`,
      } satisfies DriveSummary;
    });
  }

  createFolder(payload: { name: string; driveId: string; parentId: string | null }): FileItem {
    const name = payload.name?.trim();
    if (!name) {
      throw new Error('文件夹名称不能为空');
    }
    if (payload.parentId) {
      const parent = this.records.get(payload.parentId);
      if (!parent || !parent.isDir || parent.driveId !== payload.driveId) {
        throw new Error('父目录不存在');
      }
      if (parent.deleted) {
        throw new Error('父目录已删除，无法创建');
      }
    }

    const id = this.generateId();
    const now = Date.now();
    const record: FileRecord = {
      id,
      driveId: payload.driveId,
      name,
      isDir: true,
      size: 0,
      parentId: payload.parentId ?? null,
      hash: null,
      updatedAt: now,
      deleted: false,
      deletedAt: null,
    };
    this.insertRecord(record);
    return this.toFileItem(record);
  }

  rename(id: string, name: string): FileItem {
    const record = this.records.get(id);
    if (!record) {
      throw new Error('文件不存在');
    }
    const trimmed = name?.trim();
    if (!trimmed) {
      throw new Error('名称不能为空');
    }
    record.name = trimmed;
    record.updatedAt = Date.now();
    return this.toFileItem(record);
  }

  deleteMany(ids: string[], force: boolean): DeleteResult[] {
    return ids.map((id) => {
      const record = this.records.get(id);
      if (!record) {
        return { id, success: false, hard_deleted: false, message: '文件不存在' };
      }
      try {
        if (force) {
          this.removeRecursive(record);
          return { id, success: true, hard_deleted: true };
        }
        this.markDeletedRecursive(record, true);
        return { id, success: true, hard_deleted: false };
      } catch (error) {
        return { id, success: false, hard_deleted: false, message: (error as Error).message };
      }
    });
  }

  restoreMany(ids: string[]): Array<{ id: string; success: boolean; message?: string }> {
    return ids.map((id) => {
      const record = this.records.get(id);
      if (!record) {
        return { id, success: false, message: '文件不存在' };
      }
      try {
        if (!record.deleted) {
          return { id, success: true };
        }
        if (record.parentId) {
          const parent = this.records.get(record.parentId);
          if (!parent || parent.deleted) {
            throw new Error('父目录不存在或已删除');
          }
        }
        this.markDeletedRecursive(record, false);
        record.updatedAt = Date.now();
        return { id, success: true };
      } catch (error) {
        return { id, success: false, message: (error as Error).message };
      }
    });
  }

  clearTrash(driveId: string): number {
    const deleted = Array.from(this.records.values()).filter((record) => record.driveId === driveId && record.deleted);
    deleted.forEach((record) => this.removeRecursive(record));
    return deleted.length;
  }

  copy(options: CopyOptions): string {
    const source = this.records.get(options.id);
    if (!source) {
      throw new Error('源文件不存在');
    }
    if (options.targetParentId) {
      const parent = this.records.get(options.targetParentId);
      if (!parent || !parent.isDir || parent.driveId !== options.targetDriveId) {
        throw new Error('目标目录不存在');
      }
      if (parent.deleted) {
        throw new Error('目标目录已删除');
      }
    }
    return this.cloneRecordRecursive(source, options.targetDriveId, options.targetParentId);
  }

  toFileItem(record: FileRecord): FileItem {
    return {
      id: record.id,
      is_dir: record.isDir,
      name: record.name,
      ext: record.isDir ? null : this.extractExtension(record.name),
      mime: record.isDir ? null : this.guessMime(record.name),
      size: record.isDir ? 0 : record.size,
      drive_id: record.driveId,
      path: this.buildPath(record),
      hash: record.hash ?? null,
      updated_at: new Date(record.updatedAt).toISOString(),
      parent_id: record.parentId,
    };
  }

  private insertRecord(record: FileRecord) {
    if (!record.id) {
      record.id = this.generateId();
    }
    if (!this.children.has(record.id)) {
      this.children.set(record.id, new Set<string>());
    }
    if (record.parentId) {
      const parentSet = this.children.get(record.parentId) ?? new Set<string>();
      parentSet.add(record.id);
      this.children.set(record.parentId, parentSet);
    }
    this.records.set(record.id, { ...record });
  }

  private generateId(): string {
    this.sequence += 1;
    return String(this.sequence);
  }

  private markDeletedRecursive(record: FileRecord, deleted: boolean) {
    const current = this.records.get(record.id);
    if (!current) return;
    current.deleted = deleted;
    current.updatedAt = Date.now();
    current.deletedAt = deleted ? Date.now() : null;
    const childSet = this.children.get(record.id);
    if (!childSet) return;
    childSet.forEach((childId) => {
      const child = this.records.get(childId);
      if (child) {
        this.markDeletedRecursive(child, deleted);
      }
    });
  }

  private removeRecursive(record: FileRecord) {
    const children = this.children.get(record.id);
    if (children) {
      children.forEach((childId) => {
        const child = this.records.get(childId);
        if (child) {
          this.removeRecursive(child);
        }
      });
      this.children.delete(record.id);
    }
    if (record.parentId) {
      const siblings = this.children.get(record.parentId);
      siblings?.delete(record.id);
    }
    this.records.delete(record.id);
  }

  private cloneRecordRecursive(record: FileRecord, targetDriveId: string, targetParentId: string | null): string {
    const newId = this.generateId();
    const now = Date.now();
    const clone: FileRecord = {
      id: newId,
      driveId: targetDriveId,
      name: record.name,
      isDir: record.isDir,
      size: record.size,
      parentId: targetParentId,
      hash: record.hash,
      updatedAt: now,
      deleted: false,
      deletedAt: null,
    };
    this.insertRecord(clone);
    const children = this.children.get(record.id);
    children?.forEach((childId) => {
      const child = this.records.get(childId);
      if (child) {
        this.cloneRecordRecursive(child, targetDriveId, newId);
      }
    });
    return newId;
  }

  private computeDriveStats(driveId: string): { usedBytes: number; deletedItems: number } {
    let usedBytes = 0;
    let deletedItems = 0;
    this.records.forEach((record) => {
      if (record.driveId !== driveId) return;
      if (record.deleted) {
        deletedItems += 1;
      } else {
        usedBytes += record.size;
      }
    });
    return { usedBytes, deletedItems };
  }

  private buildPath(record: FileRecord): string {
    if (!record.parentId) {
      return `/${record.name}`;
    }
    const parent = this.records.get(record.parentId);
    if (!parent) {
      return `/${record.name}`;
    }
    const prefix = this.buildPath(parent).replace(/\/$/, '');
    return `${prefix}/${record.name}`;
  }

  private extractExtension(name: string): string | null {
    const index = name.lastIndexOf('.');
    if (index <= 0) return null;
    return name.slice(index + 1).toLowerCase();
  }

  private guessMime(name: string): string | null {
    const ext = this.extractExtension(name);
    if (!ext) return null;
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'pdf':
        return 'application/pdf';
      case 'doc':
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'txt':
        return 'text/plain';
      case 'zip':
      case 'gz':
      case 'tar':
      case 'tgz':
        return 'application/gzip';
      default:
        return 'application/octet-stream';
    }
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index += 1;
    }
    return `${value.toFixed(1)}${units[index]}`;
  }
}

export function createInitialStore(): FileStore {
  const now = Date.now();
  const seeds: FileRecord[] = [
    {
      id: '1',
      driveId: 'local',
      name: 'Documents',
      isDir: true,
      size: 0,
      parentId: null,
      hash: null,
      updatedAt: now,
      deleted: false,
      deletedAt: null,
    },
    {
      id: '2',
      driveId: 'local',
      name: 'design-spec.pdf',
      isDir: false,
      size: 2_560_000,
      parentId: '1',
      hash: 'f19c4f0a',
      updatedAt: now,
      deleted: false,
      deletedAt: null,
    },
    {
      id: '3',
      driveId: 'local',
      name: 'Photos',
      isDir: true,
      size: 0,
      parentId: null,
      hash: null,
      updatedAt: now,
      deleted: false,
      deletedAt: null,
    },
    {
      id: '4',
      driveId: 'local',
      name: 'sunset.jpg',
      isDir: false,
      size: 1_024_000,
      parentId: '3',
      hash: 'bb21cc90',
      updatedAt: now,
      deleted: false,
      deletedAt: null,
    },
    {
      id: '5',
      driveId: 'gdrive',
      name: 'Projects',
      isDir: true,
      size: 0,
      parentId: null,
      hash: null,
      updatedAt: now,
      deleted: false,
      deletedAt: null,
    },
    {
      id: '6',
      driveId: 'gdrive',
      name: 'proposal.docx',
      isDir: false,
      size: 512_000,
      parentId: '5',
      hash: 'aa1177ee',
      updatedAt: now,
      deleted: false,
      deletedAt: null,
    },
    {
      id: '7',
      driveId: 'ty189',
      name: 'Backups',
      isDir: true,
      size: 0,
      parentId: null,
      hash: null,
      updatedAt: now,
      deleted: false,
      deletedAt: null,
    },
    {
      id: '8',
      driveId: 'ty189',
      name: '2024-09-01.tar.gz',
      isDir: false,
      size: 734_003_200,
      parentId: '7',
      hash: 'ff00aa11',
      updatedAt: now,
      deleted: false,
      deletedAt: null,
    },
  ];
  return new FileStore(seeds);
}
