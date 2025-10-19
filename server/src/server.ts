import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createInitialStore } from './store';
import { TaskManager } from './tasks';
import { ShareManager } from './share';
import { failure, success } from './envelope';

const AUTH_TOKEN = 'demo-access-token';
const AUTH_USER = { id: 1, username: 'demo', role: 'admin' as const };

export function buildServer() {
  const app = Fastify({ logger: true });
  app.register(cors, { origin: true });

  const store = createInitialStore();
  const tasks = new TaskManager(store);
  const shares = new ShareManager(store);

  app.addHook('onRequest', async (request, reply) => {
    const rawUrl = request.raw.url ?? '';
    if (!rawUrl.startsWith('/api/')) return;
    if (rawUrl.startsWith('/api/auth/login')) return;
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      failure(reply, 401, 40101, '未提供访问令牌');
      return;
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (token !== AUTH_TOKEN) {
      failure(reply, 401, 40102, '访问令牌无效');
      return;
    }
  });

  app.post('/api/auth/login', async (request, reply) => {
    const body = request.body as { username?: string; password?: string } | undefined;
    if (body?.username === 'demo' && body?.password === 'demo123') {
      success(reply, { access_token: AUTH_TOKEN, expires_in: 3600, user: AUTH_USER });
      return;
    }
    failure(reply, 401, 40101, '用户名或密码错误');
  });

  app.get('/api/files', async (request, reply) => {
    const query = request.query as {
      disk?: string;
      parent_id?: string;
      deleted?: string;
      cursor?: string;
      q?: string;
      page_size?: string;
    };
    if (!query.disk) {
      failure(reply, 400, 40001, '缺少 disk 参数');
      return;
    }
    try {
      const parentId = query.parent_id ?? null;
      const deleted = query.deleted === 'true';
      const pageSize = query.page_size ? Number.parseInt(query.page_size, 10) : undefined;
      const result = store.list({
        disk: query.disk,
        parentId,
        deleted,
        search: query.q,
        cursor: query.cursor,
        pageSize,
      });
      success(reply, result);
    } catch (error) {
      failure(reply, 500, 50001, (error as Error).message);
    }
  });

  app.post('/api/folders', async (request, reply) => {
    const body = request.body as { name?: string; disk?: string; parent_id?: string | null };
    if (!body?.disk) {
      failure(reply, 400, 40001, '缺少 disk 参数');
      return;
    }
    if (!body.name) {
      failure(reply, 400, 40002, '缺少 name 参数');
      return;
    }
    try {
      const item = store.createFolder({ name: body.name, disk: body.disk, parentId: body.parent_id ?? null });
      success(reply, item);
    } catch (error) {
      failure(reply, 400, 40010, (error as Error).message);
    }
  });

  app.patch('/api/files/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const body = request.body as { name?: string };
    if (!body?.name) {
      failure(reply, 400, 40002, '缺少 name 参数');
      return;
    }
    try {
      const item = store.rename(params.id, body.name);
      success(reply, item);
    } catch (error) {
      failure(reply, 404, 40401, (error as Error).message);
    }
  });

  app.delete('/api/files/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const query = request.query as { force?: string };
    try {
      if (query.force === 'true') {
        store.forceDelete(params.id);
      } else {
        store.softDelete(params.id);
      }
      success(reply, null);
    } catch (error) {
      failure(reply, 404, 40402, (error as Error).message);
    }
  });

  app.post('/api/files/restore/:id', async (request, reply) => {
    const params = request.params as { id: string };
    try {
      const item = store.restore(params.id);
      success(reply, item);
    } catch (error) {
      failure(reply, 404, 40403, (error as Error).message);
    }
  });

  app.post('/api/files/copy', async (request, reply) => {
    const body = request.body as { id?: string; target_disk?: string; target_parent_id?: string | null };
    if (!body?.id || !body.target_disk) {
      failure(reply, 400, 40005, '缺少必要参数');
      return;
    }
    try {
      const taskId = tasks.queueCopyTask(body.id, body.target_disk, body.target_parent_id ?? null);
      success(reply, { task_id: taskId });
    } catch (error) {
      failure(reply, 400, 40011, (error as Error).message);
    }
  });

  app.post('/api/recycle/empty', async (_request, reply) => {
    store.purgeRecycleBin();
    success(reply, { cleared: true });
  });

  app.post('/api/indexer/run', async (_request, reply) => {
    const taskId = tasks.queueIndexerTask();
    success(reply, { task_id: taskId, accepted: true });
  });

  app.get('/api/tasks/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const task = tasks.getTask(params.id);
    if (!task) {
      failure(reply, 404, 40404, '任务不存在');
      return;
    }
    success(reply, {
      status: task.status,
      progress: task.progress,
      speed_bps: task.speedBps ?? null,
      eta_seconds: task.etaSeconds ?? null,
      error: task.error ?? null,
    });
  });

  app.get('/api/health', async (_request, reply) => {
    const disks = store.getDisks().map((disk) => {
      const stats = store.getDiskStats(disk);
      const ratio = stats.total === 0 ? 0 : stats.deleted / stats.total;
      const status = stats.deleted > 0 && ratio > 0.4 ? 'degraded' : 'ok';
      return {
        name: disk,
        status,
        latency_ms: 25 + stats.total * 5,
        note: `共 ${stats.total} 项，其中 ${stats.deleted} 项在回收站`,
      } as const;
    });
    const queue = tasks.getQueueSnapshot();
    success(reply, { disks, queue });
  });

  app.get('/s/:token', async (request, reply) => {
    const params = request.params as { token: string };
    const share = shares.getShare(params.token);
    if (!share) {
      failure(reply, 404, 40410, '分享不存在或已失效');
      return;
    }
    if (share.expiresAt && share.expiresAt < Date.now()) {
      failure(reply, 410, 41001, '分享已过期');
      return;
    }
    const file = store.get(share.fileId);
    if (!file) {
      failure(reply, 404, 40411, '分享文件已被移除');
      return;
    }
    success(reply, {
      file: store.toFileItem(file),
      requires_password: share.requiresPassword,
      expires_at: share.expiresAt ? new Date(share.expiresAt).toISOString() : null,
    });
  });

  app.post('/s/:token/unlock', async (request, reply) => {
    const params = request.params as { token: string };
    const body = request.body as { password?: string };
    const share = shares.getShare(params.token);
    if (!share) {
      failure(reply, 404, 40410, '分享不存在或已失效');
      return;
    }
    try {
      const sessionToken = shares.unlockShare(params.token, body?.password ?? '');
      success(reply, { unlocked: true, session_token: sessionToken });
    } catch (error) {
      failure(reply, 403, 40301, (error as Error).message);
    }
  });

  app.get('/s/:token/download', async (request, reply) => {
    const params = request.params as { token: string };
    const sessionToken = request.headers['x-share-session'] as string | undefined;
    const share = shares.getShare(params.token);
    if (!share) {
      failure(reply, 404, 40410, '分享不存在或已失效');
      return;
    }
    if (!shares.ensureSession(params.token, sessionToken)) {
      failure(reply, 403, 40302, '请先解锁分享');
      return;
    }
    const file = store.get(share.fileId);
    if (!file) {
      failure(reply, 404, 40411, '分享文件已被移除');
      return;
    }
    success(reply, {
      url: `https://download.example.com/${file.disk}/${encodeURIComponent(file.name)}`,
      headers: share.requiresPassword ? { 'X-Share-Session': sessionToken ?? '' } : undefined,
    });
  });

  return app;
}
