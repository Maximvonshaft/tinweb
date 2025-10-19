export interface FileRecord {
  id: string;
  disk: string;
  name: string;
  isDir: boolean;
  size: number;
  parentId: string | null;
  hash?: string | null;
  updatedAt: number;
  deleted: boolean;
}

export interface FileItem {
  id: string;
  is_dir: boolean;
  name: string;
  ext?: string | null;
  mime?: string | null;
  size: number;
  disk: string;
  path: string;
  hash?: string | null;
  updated_at: string;
  parent_id: string | null;
}

export interface FileListResponse {
  items: FileItem[];
  next_cursor: string | null;
}

export interface TaskState {
  id: string;
  status: 'queued' | 'running' | 'succeed' | 'failed';
  progress: number;
  speedBps?: number | null;
  etaSeconds?: number | null;
  error?: string | null;
}

export interface ShareRecord {
  token: string;
  fileId: string;
  requiresPassword: boolean;
  password?: string;
  expiresAt: number | null;
  sessionTokens: Set<string>;
}

export interface Envelope<T> {
  code: number;
  message: string;
  data: T;
}
