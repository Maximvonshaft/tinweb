export interface FileShareInfo {
  id: number;
  token: string;
  expires_at: string | null;
  requires_password: boolean;
  created_at: string;
}

export interface FileItem {
  id: number | string;
  is_dir: boolean;
  name: string;
  ext?: string | null;
  mime?: string | null;
  size: number;
  disk: string;
  path: string;
  hash?: string | null;
  updated_at: string;
  parent_id: number | string | null;
  shares?: FileShareInfo[];
}

export interface FileListResponse {
  items: FileItem[];
  next_cursor: string | null;
}

export interface TaskStatus {
  status: 'queued' | 'running' | 'succeed' | 'failed';
  progress?: number | null;
  speed_bps?: number | null;
  eta_seconds?: number | null;
  error?: string | null;
}

export interface HealthDisk {
  code: string;
  name: string;
  status: 'ok' | 'degraded' | 'down';
  latency_ms: number;
  note: string | null;
}

export interface HealthSummary {
  disks: HealthDisk[];
  queue: { waiting: number; running: number; failed: number };
}

export interface ShareUnlockResponse {
  unlocked: boolean;
  session_token: string;
}

export interface ShareDetail {
  file: FileItem;
  requires_password: boolean;
  expires_at: string | null;
}

export interface ShareDownloadInfo {
  url: string;
  headers?: Record<string, string>;
}

export interface ShareCreationResponse {
  token: string;
  requires_password: boolean;
  expires_at: string | null;
}

export interface ShareDirectoryResponse {
  current: FileItem;
  breadcrumbs: Array<{ id: number | string; name: string }>;
  items: FileItem[];
}

export interface FileShareListResponse {
  items: FileShareInfo[];
}

export interface FilePreviewData {
  id: number | string;
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

export interface UploadInitResponse {
  done: boolean;
  upload_id: string;
  chunk_size: number;
  total_parts: number;
}

export interface UploadChunkResponse {
  received: number;
}

export interface UploadCompleteResponse {
  file_id: number | string;
  hash: string;
  size: number;
}

export interface LoginResponse {
  access_token: string;
  expires_in: number;
  user?: {
    id: number | string;
    username: string;
    role: 'user' | 'admin';
  };
}

export interface Envelope<T> {
  code: number;
  message: string;
  data: T;
}

export interface IndexerSummary {
  files: number;
  directories: number;
  duration_ms: number;
  indexed_at: string;
}
