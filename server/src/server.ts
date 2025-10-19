import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createInitialStore } from './store';
import { TaskManager } from './tasks';
import { ShareManager } from './share';
import { SessionManager } from './session';
import { AuditTrail } from './audit';
import { failure, success } from './envelope';
import type { DeleteResult, TaskState, UserRecord } from './types';

const SESSION_COOKIE = 'fd_session';
const REMEMBER_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

type LoginBody = { username?: string; password?: string; rememberMe?: boolean };

type FilesQuery = { driveId?: string; parent_id?: string | null; cursor?: string | null; page_size?: string | null };

type TrashQuery = { driveId?: string };

type DeleteBody = { ids?: string[]; force?: boolean };

type RestoreBody = { ids?: string[] };

type CopyBody = { id?: string; target_drive_id?: string; target_parent_id?: string | null };

type FolderBody = { name?: string; driveId?: string; parent_id?: string | null };

type RenameBody = { id?: string; name?: string };

type ClearTrashBody = { driveId?: string };

type ShareVerifyBody = { password?: string };

const USERS: Record<string, { password: string; user: UserRecord }> = {
  demo: { password: 'demo123', user: { id: 'u-1', username: 'demo', role: 'admin' } },
  member: { password: 'member123', user: { id: 'u-2', username: 'member', role: 'user' } },
};

declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: UserRecord;
    sessionId?: string;
  }
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return header.split(';').reduce<Record<string, string>>((acc, pair) => {
    const [rawKey, rawValue] = pair.split('=');
    if (!rawKey) return acc;
    const key = rawKey.trim();
    const value = (rawValue ?? '').trim();
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function setSessionCookie(reply: FastifyReply, sessionId: string, remember: boolean) {
  const parts = [`${SESSION_COOKIE}=${sessionId}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (remember) {
    parts.push(`Max-Age=${REMEMBER_MAX_AGE}`);
  }
  reply.header('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(reply: FastifyReply) {
  reply.header('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function buildServer() {
  const app = Fastify({ logger: true });
  app.register(cors, { origin: true, credentials: true });

  const store = createInitialStore();
  const tasks = new TaskManager(store);
  const shares = new ShareManager(store);
  const sessions = new SessionManager();
  const audit = new AuditTrail();

  app.addHook('onRequest', async (request, reply) => {
    const rawUrl = request.raw.url ?? '';
    if (!rawUrl.startsWith('/api')) return;
    if (rawUrl.startsWith('/api/auth/login')) return;

    const cookies = parseCookies(request.headers.cookie);
    const sessionId = cookies[SESSION_COOKIE];
    const session = sessions.getSession(sessionId);
    if (!session) {
      failure(request, reply, 401, 1001, '未登录或会话已失效');
      return reply;
    }
    request.currentUser = session.user;
    request.sessionId = session.id;
    sessions.touchSession(session.id);
  });

  app.post('/api/auth/login', async (request, reply) => {
    const body = request.body as LoginBody | undefined;
    const username = body?.username ?? '';
    const password = body?.password ?? '';
    const remember = Boolean(body?.rememberMe);

    const record = USERS[username];
    if (!record || record.password !== password) {
      failure(request, reply, 401, 1002, '用户名或密码错误');
      return;
    }

    const session = sessions.createSession(record.user, remember);
    setSessionCookie(reply, session.id, remember);
    success(request, reply, {
      expires_in: remember ? REMEMBER_MAX_AGE : 2 * 60 * 60,
      user: record.user,
    });
  });

  app.get('/api/auth/me', async (request, reply) => {
    if (!request.currentUser) {
      failure(request, reply, 401, 1001, '未登录');
      return;
    }
    success(request, reply, { user: request.currentUser });
  });

  app.post('/api/auth/logout', async (request, reply) => {
    if (request.sessionId) {
      sessions.destroySession(request.sessionId);
    }
    clearSessionCookie(reply);
    success(request, reply, { ok: true });
  });

  app.get('/api/drives', async (request, reply) => {
    const drives = store.getDriveSummaries();
    success(request, reply, { drives });
  });

  app.get('/api/files', async (request, reply) => {
    const query = request.query as FilesQuery;
    if (!query.driveId) {
      failure(request, reply, 400, 2001, '缺少 driveId 参数');
      return;
    }
    try {
      const result = store.list({
        driveId: query.driveId,
        parentId: query.parent_id ?? null,
        deleted: false,
        cursor: query.cursor ?? null,
        pageSize: query.page_size ? Number.parseInt(query.page_size, 10) : undefined,
      });
      success(request, reply, result);
    } catch (error) {
      failure(request, reply, 500, 5001, (error as Error).message);
    }
  });

  app.post('/api/folders', async (request, reply) => {
    const body = request.body as FolderBody | undefined;
    if (!body?.driveId) {
      failure(request, reply, 400, 2001, '缺少 driveId 参数');
      return;
    }
    try {
      const folder = store.createFolder({
        driveId: body.driveId,
        name: body.name ?? '',
        parentId: body.parent_id ?? null,
      });
      if (request.currentUser) {
        audit.record(request.currentUser, 'create_folder', folder.id, { name: folder.name });
      }
      success(request, reply, folder, '创建成功');
    } catch (error) {
      failure(request, reply, 400, 2002, (error as Error).message);
    }
  });

  app.patch('/api/files/rename', async (request, reply) => {
    const body = request.body as RenameBody | undefined;
    if (!body?.id) {
      failure(request, reply, 400, 2001, '缺少文件 id');
      return;
    }
    try {
      const item = store.rename(body.id, body.name ?? '');
      if (request.currentUser) {
        audit.record(request.currentUser, 'rename', body.id, { name: item.name });
      }
      success(request, reply, item, '重命名成功');
    } catch (error) {
      failure(request, reply, 404, 2002, (error as Error).message);
    }
  });

  app.delete('/api/files', async (request, reply) => {
    const body = request.body as DeleteBody | undefined;
    const ids = body?.ids ?? [];
    if (ids.length === 0) {
      failure(request, reply, 400, 2001, '缺少待删除文件列表');
      return;
    }
    const results = store.deleteMany(ids, Boolean(body?.force));
    logBatchAudit(request, audit, results, body?.force ? 'force_delete' : 'soft_delete');
    success(request, reply, { results });
  });

  app.get('/api/trash', async (request, reply) => {
    const query = request.query as TrashQuery;
    if (!query.driveId) {
      failure(request, reply, 400, 2001, '缺少 driveId 参数');
      return;
    }
    try {
      const items = store.listTrash(query.driveId);
      success(request, reply, { items });
    } catch (error) {
      failure(request, reply, 500, 5001, (error as Error).message);
    }
  });

  app.post('/api/trash/restore', async (request, reply) => {
    const body = request.body as RestoreBody | undefined;
    const ids = body?.ids ?? [];
    if (ids.length === 0) {
      failure(request, reply, 400, 2001, '缺少待恢复文件列表');
      return;
    }
    const results = store.restoreMany(ids);
    logBatchAudit(request, audit, results.map((item) => ({
      id: item.id,
      success: item.success,
      hard_deleted: false,
      message: item.message,
    })), 'restore');
    success(request, reply, { results });
  });

  app.delete('/api/trash/clear', async (request, reply) => {
    const body = request.body as ClearTrashBody | undefined;
    if (!body?.driveId) {
      failure(request, reply, 400, 2001, '缺少 driveId 参数');
      return;
    }
    const count = store.clearTrash(body.driveId);
    if (request.currentUser) {
      audit.record(request.currentUser, 'clear_trash', body.driveId, { cleared: count });
    }
    success(request, reply, { cleared: count });
  });

  app.post('/api/files/copy', async (request, reply) => {
    const body = request.body as CopyBody | undefined;
    if (!body?.id || !body.target_drive_id) {
      failure(request, reply, 400, 2001, '缺少必要参数');
      return;
    }
    try {
      const taskId = tasks.queueCopyTask(body.id, body.target_drive_id, body.target_parent_id ?? null);
      if (request.currentUser) {
        audit.record(request.currentUser, 'copy', body.id, {
          target_drive: body.target_drive_id,
          target_parent: body.target_parent_id ?? null,
          task: taskId,
        });
      }
      success(request, reply, { task_id: taskId });
    } catch (error) {
      failure(request, reply, 400, 2002, (error as Error).message);
    }
  });

  app.get('/api/tasks/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const task = tasks.getTask(params.id);
    if (!task) {
      failure(request, reply, 404, 2002, '任务不存在');
      return;
    }
    success(request, reply, serializeTask(task));
  });

  app.post('/api/indexer/run', async (request, reply) => {
    const taskId = tasks.queueIndexerTask();
    if (request.currentUser) {
      audit.record(request.currentUser, 'indexer_trigger', taskId, {});
    }
    success(request, reply, { task_id: taskId, accepted: true });
  });

  app.get('/api/health', async (request, reply) => {
    const drives = store.getDriveSummaries().map((drive) => ({
      id: drive.id,
      status: drive.status,
      total_bytes: drive.total_bytes,
      used_bytes: drive.used_bytes,
      available_bytes: drive.available_bytes,
    }));
    const queue = tasks.getQueueSnapshot();
    success(request, reply, {
      uptime: Math.round(process.uptime()),
      version: '1.0.0',
      drives,
      queue,
    });
  });

  app.get('/share/:token', async (request, reply) => {
    const params = request.params as { token: string };
    const share = shares.getShare(params.token);
    if (!share) {
      failure(request, reply, 404, 2002, '分享不存在或已失效');
      return;
    }
    if (shares.isExpired(share)) {
      failure(request, reply, 410, 3001, '分享已过期');
      return;
    }
    const file = store.get(share.fileId);
    if (!file || file.deleted) {
      failure(request, reply, 404, 2002, '分享文件不可用');
      return;
    }
    success(request, reply, {
      file: store.toFileItem(file),
      requires_password: share.requiresPassword,
      expires_at: share.expiresAt ? new Date(share.expiresAt).toISOString() : null,
    });
  });

  app.post('/share/:token/verify', async (request, reply) => {
    const params = request.params as { token: string };
    const body = request.body as ShareVerifyBody | undefined;
    const share = shares.getShare(params.token);
    if (!share) {
      failure(request, reply, 404, 2002, '分享不存在或已失效');
      return;
    }
    if (shares.isExpired(share)) {
      failure(request, reply, 410, 3001, '分享已过期');
      return;
    }
    try {
      const sessionToken = shares.unlockShare(params.token, body?.password ?? '');
      success(request, reply, { unlocked: true, session_token: sessionToken });
    } catch (error) {
      failure(request, reply, 403, 3002, (error as Error).message);
    }
  });

  app.get('/share/:token/download', async (request, reply) => {
    const params = request.params as { token: string };
    const sessionToken = request.headers['x-share-session'] as string | undefined;
    const share = shares.getShare(params.token);
    if (!share) {
      failure(request, reply, 404, 2002, '分享不存在或已失效');
      return;
    }
    if (shares.isExpired(share)) {
      failure(request, reply, 410, 3001, '分享已过期');
      return;
    }
    if (!shares.ensureSession(params.token, sessionToken)) {
      failure(request, reply, 403, 3002, '请先验证分享口令');
      return;
    }
    const file = store.get(share.fileId);
    if (!file || file.deleted) {
      failure(request, reply, 404, 2002, '分享文件不可用');
      return;
    }
    success(request, reply, {
      url: `https://download.example.com/${file.driveId}/${encodeURIComponent(file.name)}`,
      headers: share.requiresPassword
        ? { 'X-Share-Session': sessionToken ?? '' }
        : undefined,
    });
  });

  registerUploadStubs(app);
  registerShareCreationStub(app);

  return app;
}

function logBatchAudit(request: FastifyRequest, audit: AuditTrail, results: DeleteResult[], action: string) {
  if (!request.currentUser) return;
  results.forEach((result) => {
    if (result.success) {
      audit.record(request.currentUser!, action, result.id, { hard: result.hard_deleted });
    }
  });
}

function serializeTask(task: TaskState) {
  return {
    status: task.status,
    progress: task.progress,
    speed_bps: task.speedBps ?? null,
    eta_seconds: task.etaSeconds ?? null,
    error: task.error ?? null,
  };
}

function registerUploadStubs(app: FastifyInstance) {
  const notImplemented = (request: FastifyRequest, reply: FastifyReply) => {
    failure(request, reply, 501, 5001, '该功能将在后续版本提供');
  };
  app.post('/api/upload/init', notImplemented);
  app.put('/api/upload/:id/:chunk', notImplemented);
  app.post('/api/upload/:id/complete', notImplemented);
  app.post('/api/upload/:id/abort', notImplemented);
  app.post('/api/upload/simple', notImplemented);
}

function registerShareCreationStub(app: FastifyInstance) {
  app.post('/api/shares', (request, reply) => {
    failure(request, reply, 501, 5001, '分享创建暂未开放');
  });
}
