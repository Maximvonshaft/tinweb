import { readFileFromStorage, createFileReadStream } from './storage.js';
import type { FileMetadata } from './files.service.js';
import { createBadRequestError, createNotFoundError } from '../../core/errors.js';

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'json',
  'log',
  'csv',
  'ts',
  'tsx',
  'js',
  'jsx',
  'py',
  'java',
  'c',
  'cpp',
  'yml',
  'yaml',
  'xml',
  'html',
  'css',
  'scss'
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  csv: 'text/csv',
  yaml: 'application/x-yaml',
  yml: 'application/x-yaml',
  xml: 'application/xml',
  html: 'text/html',
  css: 'text/css',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf'
};

export interface FilePreviewResult {
  id: number;
  name: string;
  size: number;
  mime: string;
  hash: string | null;
  updated_at: string;
  kind: 'text' | 'image' | 'binary';
  content?: string;
  dataUrl?: string;
  downloadPath: string;
}

export const resolveMimeType = (metadata: FileMetadata): string => {
  if (metadata.mime) {
    return metadata.mime;
  }
  const ext = metadata.ext ? metadata.ext.toLowerCase() : '';
  return MIME_BY_EXTENSION[ext] ?? 'application/octet-stream';
};

export const buildFilePreview = async (
  metadata: FileMetadata,
  downloadPath: string
): Promise<FilePreviewResult> => {
  if (metadata.is_dir === 1) {
    throw createBadRequestError('目录暂不支持预览');
  }
  if (metadata.deleted_at) {
    throw createNotFoundError('文件已删除');
  }

  try {
    const buffer = await readFileFromStorage(metadata.tenant_id, metadata.disk_code, metadata.path);
    const mime = resolveMimeType(metadata);
    const isText =
      buffer.length <= 2 * 1024 * 1024 &&
      (mime.startsWith('text/') || (metadata.ext ? TEXT_EXTENSIONS.has(metadata.ext.toLowerCase()) : false));
    if (isText) {
      return {
        id: metadata.id,
        name: metadata.name,
        size: metadata.size,
        mime,
        hash: metadata.hash,
        updated_at: metadata.updated_at,
        kind: 'text',
        content: buffer.toString('utf8'),
        downloadPath
      };
    }
    const isImage = mime.startsWith('image/') && buffer.length <= 8 * 1024 * 1024;
    if (isImage) {
      const base64 = buffer.toString('base64');
      return {
        id: metadata.id,
        name: metadata.name,
        size: metadata.size,
        mime,
        hash: metadata.hash,
        updated_at: metadata.updated_at,
        kind: 'image',
        dataUrl: `data:${mime};base64,${base64}`,
        downloadPath
      };
    }
    return {
      id: metadata.id,
      name: metadata.name,
      size: metadata.size,
      mime,
      hash: metadata.hash,
      updated_at: metadata.updated_at,
      kind: 'binary',
      downloadPath
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw createNotFoundError('文件内容不存在');
    }
    throw error;
  }
};

export const createPreviewStream = (metadata: FileMetadata) => {
  if (metadata.is_dir === 1) {
    throw createBadRequestError('目录不支持下载');
  }
  return createFileReadStream(metadata.tenant_id, metadata.disk_code, metadata.path);
};
