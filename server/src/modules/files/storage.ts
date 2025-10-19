import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createReadStream } from 'node:fs';

const STORAGE_ROOT = process.env.STORAGE_ROOT ?? path.join(process.cwd(), 'storage');

const normalizeRelativePath = (relativePath: string): string => {
  if (!relativePath || relativePath === '/') {
    return '';
  }
  return relativePath.replace(/^\/+/, '');
};

const baseDirFor = (tenantId: string, diskCode: string) => path.join(STORAGE_ROOT, tenantId, diskCode);

export const ensureBaseDirectory = async (tenantId: string, diskCode: string) => {
  const base = baseDirFor(tenantId, diskCode);
  await fs.mkdir(base, { recursive: true });
  return base;
};

export const ensureDirectory = async (tenantId: string, diskCode: string, relativePath: string) => {
  const base = await ensureBaseDirectory(tenantId, diskCode);
  const normalized = normalizeRelativePath(relativePath);
  const target = normalized ? path.join(base, normalized) : base;
  await fs.mkdir(target, { recursive: true });
  return target;
};

export const writeFileToStorage = async (
  tenantId: string,
  diskCode: string,
  relativePath: string,
  buffer: Buffer
) => {
  const base = await ensureBaseDirectory(tenantId, diskCode);
  const normalized = normalizeRelativePath(relativePath);
  const target = normalized ? path.join(base, normalized) : base;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  return target;
};

export const readFileFromStorage = async (tenantId: string, diskCode: string, relativePath: string) => {
  const base = await ensureBaseDirectory(tenantId, diskCode);
  const normalized = normalizeRelativePath(relativePath);
  const target = normalized ? path.join(base, normalized) : base;
  return fs.readFile(target);
};

export const createFileReadStream = (tenantId: string, diskCode: string, relativePath: string) => {
  const base = path.join(STORAGE_ROOT, tenantId, diskCode);
  const normalized = normalizeRelativePath(relativePath);
  const target = normalized ? path.join(base, normalized) : base;
  return createReadStream(target);
};

export const getAbsoluteStoragePath = (tenantId: string, diskCode: string, relativePath: string) => {
  const base = path.join(STORAGE_ROOT, tenantId, diskCode);
  const normalized = normalizeRelativePath(relativePath);
  return normalized ? path.join(base, normalized) : base;
};
