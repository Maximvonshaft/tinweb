import type { ColumnType } from 'kysely';

type Generated<T> = ColumnType<T, T | undefined, T>;
type Timestamp = ColumnType<string, string | undefined, string>;

export interface UsersTable {
  id: Generated<number>;
  tenant_id: string;
  username: string;
  password_hash: string;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'DISABLED';
  last_login_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface DisksTable {
  id: Generated<number>;
  tenant_id: string;
  code: string;
  name: string;
  type: string;
  config: string;
  owner_id: number;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface FilesTable {
  id: Generated<number>;
  tenant_id: string;
  disk_id: number;
  parent_id: number | null;
  name: string;
  ext: string | null;
  mime: string | null;
  hash: string | null;
  size: number;
  path: string;
  is_dir: number;
  deleted_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  owner_id: number;
}

export interface TasksTable {
  id: Generated<number>;
  tenant_id: string;
  type: 'COPY';
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  progress: number;
  payload: string;
  result: string | null;
  error: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  owner_id: number;
}

export interface SharesTable {
  id: Generated<number>;
  tenant_id: string;
  token: string;
  file_id: number;
  requires_password: number;
  password_hash: string | null;
  expires_at: Timestamp | null;
  created_by_id: number;
  created_at: Timestamp;
}

export interface ShareSessionsTable {
  id: Generated<number>;
  tenant_id: string;
  share_id: number;
  session_token: string;
  expires_at: Timestamp;
  created_at: Timestamp;
}

export interface AuditLogsTable {
  id: Generated<number>;
  tenant_id: string;
  user_id: number | null;
  action: string;
  metadata: string | null;
  created_at: Timestamp;
}

export interface MigrationsTable {
  id: Generated<number>;
  name: string;
  created_at: Timestamp;
}

export interface Database {
  users: UsersTable;
  disks: DisksTable;
  files: FilesTable;
  tasks: TasksTable;
  shares: SharesTable;
  share_sessions: ShareSessionsTable;
  audit_logs: AuditLogsTable;
  migrations: MigrationsTable;
}
