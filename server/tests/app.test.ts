import request from 'supertest';
import { unlinkSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import type { Kysely } from 'kysely';
import type { Database } from '../src/database/schema.js';
import type { TaskScheduler } from '../src/modules/tasks/task-scheduler.js';

let app: Express;
let db: Kysely<Database>;
let scheduler: TaskScheduler | undefined;
let token: string;
let rootId: number;

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = resolvePath(__dirname, 'test.db');

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

interface LoginResponse {
  access_token: string;
}

interface FileItem {
  id: number;
  name: string;
  is_dir: boolean;
  disk: string;
  parent_id: number | null;
}

interface FileListResponse {
  items: FileItem[];
  next_cursor: string | null;
}

beforeAll(async () => {
  process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;
  process.env.JWT_SECRET = 'test-secret-1234567890';
  process.env.JWT_EXPIRES_IN = '3600';
  process.env.DEFAULT_TENANT = 'default';
  process.env.PORT = '0';

  const { createDb } = await import('../src/database/client.js');
  const { migrateToLatest } = await import('../src/database/migrations.js');
  const { seedDatabase } = await import('../src/database/seed.js');
  const { createTaskScheduler } = await import('../src/modules/tasks/task-scheduler.js');
  const { createApp } = await import('../src/app/app.js');

  db = createDb();
  await migrateToLatest(db);
  await seedDatabase(db);

  scheduler = createTaskScheduler(db, 100);
  app = createApp({ db, taskScheduler: scheduler });
  scheduler.start();
});

afterAll(async () => {
  scheduler?.stop();
  await db.destroy();
  if (existsSync(TEST_DB_PATH)) {
    unlinkSync(TEST_DB_PATH);
  }
});

describe('后端 API 集成测试', () => {
  it('登录成功返回访问令牌', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);

    const body = response.body as ApiResponse<LoginResponse>;
    expect(body.data.access_token).toBeDefined();
    token = body.data.access_token;
  });

  it('列出根目录并创建子目录', async () => {
    const listRoot = await request(app)
      .get('/api/files')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const rootBody = listRoot.body as ApiResponse<FileListResponse>;
    const rootItem = rootBody.data.items.find((item) => item.name === 'root');
    expect(rootItem).toBeDefined();
    rootId = Number(rootItem!.id);

    const createResp = await request(app)
      .post('/api/files/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Docs', parent_id: rootId })
      .expect(200);

    const createBody = createResp.body as ApiResponse<{ created: boolean }>;
    expect(createBody.data.created).toBe(true);

    const listChildren = await request(app)
      .get(`/api/files?parent_id=${rootId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const listChildrenBody = listChildren.body as ApiResponse<FileListResponse>;
    const folder = listChildrenBody.data.items.find((item) => item.name === 'Docs');
    expect(folder).toBeDefined();
  });

  it('删除并恢复目录', async () => {
    const listChildren = await request(app)
      .get(`/api/files?parent_id=${rootId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const listChildrenBody = listChildren.body as ApiResponse<FileListResponse>;
    const folder = listChildrenBody.data.items.find((item) => item.name === 'Docs');
    expect(folder).toBeDefined();
    const folderId = Number(folder!.id);

    await request(app)
      .delete(`/api/files/${folderId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app)
      .post(`/api/files/restore/${folderId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('复制目录会创建任务并最终成功', async () => {
    const diskRow = await db
      .selectFrom('disks')
      .select(['id'])
      .where('code', '=', 'local')
      .executeTakeFirstOrThrow();

    const folderRow = await db
      .selectFrom('files')
      .select(['id'])
      .where('name', '=', 'Docs')
      .where('parent_id', '=', rootId)
      .executeTakeFirstOrThrow();

    const copyResp = await request(app)
      .post('/api/files/copy')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: folderRow.id, target_disk: diskRow.id, target_parent_id: rootId })
      .expect(200);

    const copyBody = copyResp.body as ApiResponse<{ task_id: number }>;
    const taskId = copyBody.data.task_id;
    expect(taskId).toBeGreaterThan(0);

    // 等待任务执行
    await new Promise((resolve) => setTimeout(resolve, 500));

    const statusResp = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const statusBody = statusResp.body as ApiResponse<{ status: string }>;
    expect(statusBody.data.status).toBe('succeed');
  });
});
