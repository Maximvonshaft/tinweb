export type UserRole = 'user' | 'admin';

export interface UserRecord {
  id: string;
  username: string;
  role: UserRole;
}

export interface SessionRecord {
  id: string;
  user: UserRecord;
  createdAt: number;
  expiresAt?: number;
  remember: boolean;
}

export interface FileRecord {
  id: string;
  driveId: string;
  name: string;
  isDir: boolean;
  size: number;
  parentId: string | null;
  hash?: string | null;
  updatedAt: number;
  deleted: boolean;
  deletedAt?: number | null;
}

export interface FileItem {
  id: string;
  is_dir: boolean;
  name: string;
  ext?: string | null;
  mime?: string | null;
  size: number;
  drive_id: string;
  path: string;
  hash?: string | null;
  updated_at: string;
  parent_id: string | null;
}

export interface FileListResponse {
  items: FileItem[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface TrashItem extends FileItem {
  deleted_at: string;
}

export interface DeleteResult {
  id: string;
  success: boolean;
  hard_deleted: boolean;
  message?: string;
}

export type TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'canceled';

export interface TaskState {
  id: string;
  type: 'copy' | 'index';
  status: TaskStatus;
  progress: number;
  speedBps?: number | null;
  etaSeconds?: number | null;
  error?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface QueueSnapshot {
  pending: number;
  running: number;
  failed: number;
}

export interface ShareRecord {
  token: string;
  fileId: string;
  requiresPassword: boolean;
  password?: string;
  expiresAt: number | null;
  sessionTokens: Set<string>;
  createdAt: number;
}

export interface Envelope<T> {
  code: number;
  message: string;
  data: T;
  requestId: string;
}

export interface DriveSummary {
  id: string;
  name: string;
  status: 'ok' | 'degraded' | 'offline';
  total_bytes: number;
  used_bytes: number;
  deleted_items: number;
  available_bytes: number;
  description?: string;
}

export interface HealthSnapshot {
  uptime_seconds: number;
  version: string;
  drives: Array<{
    id: string;
    status: 'ok' | 'degraded' | 'offline';
    total_bytes: number;
    used_bytes: number;
    available_bytes: number;
  }>;
  queue: QueueSnapshot;
}

export interface AuditEntry {
  id: string;
  actor: string;
  ts: number;
  action: string;
  target: string;
  detail?: Record<string, unknown>;
}
