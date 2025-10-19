import type { FileItem, FileListResponse, FileRecord } from './types';

interface ListOptions {
  disk: string;
  parentId: string | null;
  deleted: boolean;
  search?: string;
  cursor?: string;
  pageSize?: number;
}

interface CopyOptions {
  id: string;
  targetDisk: string;
  targetParentId: string | null;
}

const DEFAULT_PAGE_SIZE = 50;

export class FileStore {
  private records = new Map<string, FileRecord>();
  private children = new Map<string, Set<string>>();
  private sequence = 1000;

  constructor(initialRecords: FileRecord[]) {
    initialRecords.forEach((record) => this.insertRecord(record));
  }

  list(options: ListOptions): FileListResponse {
    const pageSize = options.pageSize && options.pageSize > 0 ? options.pageSize : DEFAULT_PAGE_SIZE;
    const offset = options.cursor ? Number.parseInt(options.cursor, 10) || 0 : 0;
    const all = Array.from(this.records.values()).filter((record) => {
      if (record.disk !== options.disk) return false;
      if (record.deleted !== options.deleted) return false;
      if (!options.deleted && (record.parentId ?? null) !== (options.parentId ?? null)) return false;
      if (options.search) {
        const keyword = options.search.toLowerCase();
        return record.name.toLowerCase().includes(keyword);
      }
      return true;
    });

    all.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    const items = all.slice(offset, offset + pageSize).map((record) => this.toFileItem(record));
    const next_cursor = offset + pageSize < all.length ? String(offset + pageSize) : null;
    return { items, next_cursor };
  }

  get(id: string): FileRecord | undefined {
    return this.records.get(id);
  }

  createFolder(payload: { name: string; disk: string; parentId: string | null }): FileItem {
    if (!payload.name.trim()) {
      throw new Error('文件夹名称不能为空');
    }
    if (payload.parentId) {
      const parent = this.records.get(payload.parentId);
      if (!parent || !parent.isDir) {
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
      disk: payload.disk,
      name: payload.name,
      isDir: true,
      size: 0,
      parentId: payload.parentId ?? null,
      hash: null,
      updatedAt: now,
      deleted: false,
    };
    this.insertRecord(record);
    return this.toFileItem(record);
  }

  rename(id: string, name: string): FileItem {
    const record = this.records.get(id);
    if (!record) {
      throw new Error('文件不存在');
    }
    if (!name.trim()) {
      throw new Error('名称不能为空');
    }
    record.name = name;
    record.updatedAt = Date.now();
    this.updateDescendantPaths(record);
    return this.toFileItem(record);
  }

  softDelete(id: string): void {
    const target = this.records.get(id);
    if (!target) {
      throw new Error('目标不存在');
    }
    this.markDeletedRecursive(target, true);
  }

  restore(id: string): FileItem {
    const target = this.records.get(id);
    if (!target) {
      throw new Error('文件不存在');
    }
    if (!target.deleted) {
      return this.toFileItem(target);
    }
    if (target.parentId) {
      const parent = this.records.get(target.parentId);
      if (!parent || parent.deleted) {
        throw new Error('父目录不存在或已删除');
      }
    }
    this.markDeletedRecursive(target, false);
    target.updatedAt = Date.now();
    return this.toFileItem(target);
  }

  forceDelete(id: string): void {
    const target = this.records.get(id);
    if (!target) {
      throw new Error('文件不存在');
    }
    this.removeRecursive(target);
  }

  copy(options: CopyOptions): string {
    const source = this.records.get(options.id);
    if (!source) {
      throw new Error('源文件不存在');
    }
    if (options.targetParentId) {
      const parent = this.records.get(options.targetParentId);
      if (!parent || !parent.isDir) {
        throw new Error('目标目录不存在');
      }
      if (parent.disk !== options.targetDisk) {
        throw new Error('目标目录与目标盘不匹配');
      }
    }
    return this.cloneRecordRecursive(source, options.targetDisk, options.targetParentId);
  }

  purgeRecycleBin(): void {
    const deleted = Array.from(this.records.values()).filter((record) => record.deleted);
    deleted.forEach((record) => {
      this.removeRecursive(record);
    });
  }

  getDisks(): string[] {
    return Array.from(new Set(Array.from(this.records.values()).map((record) => record.disk))).sort();
  }

  getDiskStats(disk: string): { total: number; deleted: number } {
    let total = 0;
    let deleted = 0;
    this.records.forEach((record) => {
      if (record.disk !== disk) return;
      total += 1;
      if (record.deleted) deleted += 1;
    });
    return { total, deleted };
  }

  private insertRecord(record: FileRecord) {
    if (!record.id) {
      record.id = this.generateId();
    }
    record.updatedAt = record.updatedAt || Date.now();
    if (record.parentId) {
      const parent = this.records.get(record.parentId);
      if (parent && !parent.isDir) {
        throw new Error('父节点不是目录');
      }
      if (parent) {
        const currentChildren = this.children.get(parent.id) ?? new Set<string>();
        currentChildren.add(record.id);
        this.children.set(parent.id, currentChildren);
      }
    }
    this.records.set(record.id, { ...record });
  }

  private generateId(): string {
    this.sequence += 1;
    return String(this.sequence);
  }

  private markDeletedRecursive(record: FileRecord, deleted: boolean) {
    const target = this.records.get(record.id);
    if (!target) return;
    target.deleted = deleted;
    target.updatedAt = Date.now();
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
    const childSet = this.children.get(record.id);
    if (childSet) {
      childSet.forEach((childId) => {
        const child = this.records.get(childId);
        if (child) {
          this.removeRecursive(child);
        }
      });
      this.children.delete(record.id);
    }
    if (record.parentId) {
      const siblings = this.children.get(record.parentId);
      if (siblings) {
        siblings.delete(record.id);
      }
    }
    this.records.delete(record.id);
  }

  private cloneRecordRecursive(record: FileRecord, targetDisk: string, targetParentId: string | null): string {
    const newId = this.generateId();
    const now = Date.now();
    const clone: FileRecord = {
      id: newId,
      disk: targetDisk,
      name: record.name,
      isDir: record.isDir,
      size: record.size,
      parentId: targetParentId,
      hash: record.hash,
      updatedAt: now,
      deleted: false,
    };
    this.insertRecord(clone);
    const children = this.children.get(record.id);
    if (children && children.size > 0) {
      children.forEach((childId) => {
        const child = this.records.get(childId);
        if (child) {
          this.cloneRecordRecursive(child, targetDisk, newId);
        }
      });
    }
    return newId;
  }

  private updateDescendantPaths(record: FileRecord) {
    const childSet = this.children.get(record.id);
    if (!childSet) return;
    childSet.forEach((childId) => {
      const child = this.records.get(childId);
      if (child) {
        this.updateDescendantPaths(child);
      }
    });
  }

  toFileItem(record: FileRecord): FileItem {
    return {
      id: record.id,
      is_dir: record.isDir,
      name: record.name,
      ext: record.isDir ? null : this.extractExtension(record.name),
      mime: record.isDir ? null : this.guessMime(record.name),
      size: record.isDir ? 0 : record.size,
      disk: record.disk,
      path: this.buildPath(record),
      hash: record.hash ?? null,
      updated_at: new Date(record.updatedAt).toISOString(),
      parent_id: record.parentId,
    };
  }

  private buildPath(record: FileRecord): string {
    if (!record.parentId) {
      return `/${record.name}`;
    }
    const parent = this.records.get(record.parentId);
    if (!parent) {
      return `/${record.name}`;
    }
    return `${this.buildPath(parent).replace(/\/$/, '')}/${record.name}`;
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
}

export function createInitialStore(): FileStore {
  const now = Date.now();
  const seeds: FileRecord[] = [
    { id: '1', disk: 'local', name: 'Documents', isDir: true, size: 0, parentId: null, hash: null, updatedAt: now, deleted: false },
    { id: '2', disk: 'local', name: 'design-spec.pdf', isDir: false, size: 2_560_000, parentId: '1', hash: 'f19c4f0a', updatedAt: now, deleted: false },
    { id: '3', disk: 'local', name: 'Photos', isDir: true, size: 0, parentId: null, hash: null, updatedAt: now, deleted: false },
    { id: '4', disk: 'local', name: 'sunset.jpg', isDir: false, size: 1_024_000, parentId: '3', hash: 'bb21cc90', updatedAt: now, deleted: false },
    { id: '5', disk: 'gdrive', name: 'Projects', isDir: true, size: 0, parentId: null, hash: null, updatedAt: now, deleted: false },
    { id: '6', disk: 'gdrive', name: 'proposal.docx', isDir: false, size: 512_000, parentId: '5', hash: 'aa1177ee', updatedAt: now, deleted: false },
    { id: '7', disk: 'ty189', name: 'Backups', isDir: true, size: 0, parentId: null, hash: null, updatedAt: now, deleted: false },
    { id: '8', disk: 'ty189', name: '2024-09-01.tar.gz', isDir: false, size: 734_003_200, parentId: '7', hash: 'ff00aa11', updatedAt: now, deleted: false },
  ];
  return new FileStore(seeds);
}
