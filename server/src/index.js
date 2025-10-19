import express from 'express';
import cors from 'cors';
import { nanoid } from 'nanoid';

const app = express();
app.use(cors());
app.use(express.json());

const API_VERSION = '1.0.0';

function envelope(data, message = 'OK') {
  return { code: 0, message, data };
}

function errorEnvelope(code, message) {
  return { code, message, data: null };
}

const USERS = [
  { id: '1', username: 'demo', password: 'demo123', role: 'admin' },
  { id: '2', username: 'guest', password: 'guest', role: 'user' },
];

const tokens = new Map();
const taskStore = new Map();

const diskRoots = {
  local: 'u/1',
  gdrive: 'Team',
  ty189: 'Carrier',
};

const files = new Map();
let nextFileId = 1000;

function addFile(initial) {
  const id = String(initial.id ?? nextFileId++);
  const record = {
    id,
    is_dir: Boolean(initial.is_dir),
    name: initial.name,
    ext: initial.ext ?? null,
    mime: initial.mime ?? null,
    size: initial.size ?? 0,
    disk: initial.disk,
    path: initial.path,
    hash: initial.hash ?? null,
    updated_at: initial.updated_at ?? new Date().toISOString(),
    parent_id: initial.parent_id !== undefined && initial.parent_id !== null ? String(initial.parent_id) : null,
    deleted: initial.deleted ?? false,
  };
  files.set(id, record);
  return record;
}

addFile({ id: '1', is_dir: true, name: 'Docs', size: 0, disk: 'local', path: 'u/1/docs', parent_id: null, updated_at: '2025-10-18T10:20:30Z' });
addFile({ id: '2', is_dir: false, name: 'photo.jpg', ext: 'jpg', mime: 'image/jpeg', size: 204800, disk: 'local', path: 'u/1/photo.jpg', hash: 'sha256-111', parent_id: null, updated_at: '2025-10-18T10:21:30Z' });
addFile({ id: '3', is_dir: true, name: 'Videos', size: 0, disk: 'gdrive', path: 'Team/Videos', parent_id: null, updated_at: '2025-10-17T08:00:00Z' });
addFile({ id: '4', is_dir: false, name: 'presentation.pptx', ext: 'pptx', mime: 'application/vnd.ms-powerpoint', size: 5120000, disk: 'gdrive', path: 'Team/Videos/presentation.pptx', parent_id: '3', updated_at: '2025-10-19T09:00:00Z' });
addFile({ id: '5', is_dir: true, name: 'Archive', size: 0, disk: 'ty189', path: 'Carrier/Archive', parent_id: null, updated_at: '2025-10-11T09:12:00Z' });
addFile({ id: '6', is_dir: false, name: 'backup.zip', ext: 'zip', mime: 'application/zip', size: 1099511627, disk: 'ty189', path: 'Carrier/Archive/backup.zip', parent_id: '5', updated_at: '2025-10-12T11:00:00Z' });
addFile({ id: '21', is_dir: false, name: 'old-report.pdf', ext: 'pdf', mime: 'application/pdf', size: 102400, disk: 'local', path: 'u/1/archive/2023/old-report.pdf', parent_id: '1', deleted: true, updated_at: '2025-09-18T08:00:00Z' });
addFile({ id: '22', is_dir: false, name: 'obsolete.sql', ext: 'sql', mime: 'application/sql', size: 51200, disk: 'gdrive', path: 'Team/DB/obsolete.sql', parent_id: '3', deleted: true, updated_at: '2025-09-15T16:20:00Z' });

function cloneFile(original, overrides = {}) {
  const copy = { ...original, ...overrides };
  delete copy.deleted;
  return copy;
}

function normalizeParentId(value) {
  if (value === undefined || value === null || value === '' || value === 'null') return null;
  return String(value);
}

function buildPath(disk, parentId, name) {
  const parent = parentId ? files.get(parentId) : null;
  if (parent) {
    return `${parent.path}/${name}`;
  }
  const root = diskRoots[disk] ?? disk;
  return `${root}/${name}`;
}

function findSiblings(disk, parentId) {
  return Array.from(files.values()).filter((item) => item.disk === disk && (item.parent_id ?? null) === (parentId ?? null));
}

function applyRecursiveFlag(id, flag) {
  const stack = [id];
  while (stack.length) {
    const current = stack.pop();
    const file = files.get(current);
    if (!file) continue;
    file.deleted = flag;
    file.updated_at = new Date().toISOString();
    Array.from(files.values())
      .filter((item) => item.parent_id === current)
      .forEach((child) => stack.push(child.id));
  }
}

function removeRecursively(id) {
  const stack = [id];
  while (stack.length) {
    const current = stack.pop();
    files.delete(current);
    Array.from(files.values())
      .filter((item) => item.parent_id === current)
      .forEach((child) => stack.push(child.id));
  }
}

function requireAuth(req, res, next) {
  if (req.path === '/api/auth/login') {
    next();
    return;
  }
  if (!req.path.startsWith('/api')) {
    next();
    return;
  }
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json(errorEnvelope(40101, 'Unauthorized'));
    return;
  }
  const token = header.slice(7);
  const session = tokens.get(token);
  if (!session) {
    res.status(401).json(errorEnvelope(40102, 'Invalid token'));
    return;
  }
  req.user = session;
  next();
}

app.use(requireAuth);

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    res.setHeader('X-API-Version', API_VERSION);
  }
  next();
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    res.status(400).json(errorEnvelope(40001, '用户名或密码缺失'));
    return;
  }
  const user = USERS.find((item) => item.username === username && item.password === password);
  if (!user) {
    res.status(401).json(errorEnvelope(40101, 'Invalid credentials'));
    return;
  }
  const token = `fd-${nanoid(18)}`;
  tokens.set(token, { id: user.id, username: user.username, role: user.role });
  res.json(
    envelope({
      access_token: token,
      expires_in: 3600,
      user: { id: user.id, username: user.username, role: user.role },
    }),
  );
});

app.get('/api/health', (req, res) => {
  const tasks = Array.from(taskStore.values());
  const queue = {
    waiting: tasks.filter((task) => task.status === 'queued').length,
    running: tasks.filter((task) => task.status === 'running').length,
    failed: tasks.filter((task) => task.status === 'failed').length,
  };
  res.json(
    envelope({
      disks: [
        { name: 'local', status: 'ok', latency_ms: 8, note: null },
        { name: 'gdrive', status: 'ok', latency_ms: 120, note: null },
        { name: 'ty189', status: 'degraded', latency_ms: 420, note: 'read-only' },
      ],
      queue,
    }),
  );
});

app.get('/api/files', (req, res) => {
  const disk = req.query.disk ? String(req.query.disk) : 'local';
  const parentId = normalizeParentId(req.query.parent_id);
  const parentParamSupplied = Object.prototype.hasOwnProperty.call(req.query, 'parent_id');
  const deleted = req.query.deleted === 'true';
  const q = req.query.q ? String(req.query.q).toLowerCase() : null;
  const pageSizeRaw = Number.parseInt(String(req.query.page_size ?? '50'), 10);
  const pageSize = Number.isNaN(pageSizeRaw) ? 50 : Math.max(1, Math.min(pageSizeRaw, 200));
  const cursorValue = req.query.cursor ? Number.parseInt(String(req.query.cursor), 10) : 0;
  const offset = Number.isNaN(cursorValue) || cursorValue < 0 ? 0 : cursorValue;

  let list = Array.from(files.values()).filter((item) => item.disk === disk);
  list = list.filter((item) => Boolean(item.deleted) === deleted);
  if (deleted) {
    if (parentParamSupplied) {
      list = list.filter((item) => (item.parent_id ?? null) === parentId);
    }
  } else {
    const expectedParent = parentParamSupplied ? parentId : null;
    list = list.filter((item) => (item.parent_id ?? null) === expectedParent);
  }
  if (q) {
    list = list.filter((item) => item.name.toLowerCase().includes(q) || (item.mime ?? '').toLowerCase().includes(q));
  }
  list.sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    const timeDiff = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.name.localeCompare(b.name);
  });

  const items = list.slice(offset, offset + pageSize).map((item) => cloneFile(item));
  const nextCursor = offset + pageSize < list.length ? String(offset + pageSize) : null;

  res.json(
    envelope({
      items,
      next_cursor: nextCursor,
    }),
  );
});

app.post('/api/folders', (req, res) => {
  const { name, disk, parent_id: parentIdInput } = req.body ?? {};
  const parentId = normalizeParentId(parentIdInput);
  if (!name || !disk) {
    res.status(400).json(errorEnvelope(40002, '缺少名称或目标盘'));
    return;
  }
  if (parentId && !files.has(parentId)) {
    res.status(404).json(errorEnvelope(40401, 'Parent folder not found'));
    return;
  }
  const siblings = findSiblings(disk, parentId);
  if (siblings.some((item) => !item.deleted && item.name === name)) {
    res.status(409).json(errorEnvelope(40901, 'Name conflict'));
    return;
  }
  const path = buildPath(disk, parentId, name);
  const record = addFile({ is_dir: true, name, disk, path, parent_id: parentId });
  res.json(envelope(cloneFile(record)));
});

app.patch('/api/files/:id', (req, res) => {
  const id = String(req.params.id);
  const file = files.get(id);
  if (!file) {
    res.status(404).json(errorEnvelope(40401, 'File not found'));
    return;
  }
  const { name } = req.body ?? {};
  if (!name) {
    res.status(400).json(errorEnvelope(40003, '缺少新名称'));
    return;
  }
  const siblings = findSiblings(file.disk, file.parent_id);
  if (siblings.some((item) => item.id !== file.id && !item.deleted && item.name === name)) {
    res.status(409).json(errorEnvelope(40901, 'Name conflict'));
    return;
  }
  file.name = name;
  file.path = buildPath(file.disk, file.parent_id, name);
  file.updated_at = new Date().toISOString();
  res.json(envelope(cloneFile(file)));
});

app.delete('/api/files/:id', (req, res) => {
  const id = String(req.params.id);
  const file = files.get(id);
  if (!file) {
    res.status(404).json(errorEnvelope(40401, 'File not found'));
    return;
  }
  const force = req.query.force === 'true';
  if (force) {
    removeRecursively(id);
    res.json(envelope({ deleted: true }));
    return;
  }
  applyRecursiveFlag(id, true);
  res.json(envelope({ deleted: true }));
});

app.post('/api/files/restore/:id', (req, res) => {
  const id = String(req.params.id);
  const file = files.get(id);
  if (!file) {
    res.status(404).json(errorEnvelope(40401, 'File not found'));
    return;
  }
  applyRecursiveFlag(id, false);
  res.json(envelope(cloneFile(file)));
});

app.post('/api/recycle/empty', (req, res) => {
  const deletedIds = Array.from(files.values())
    .filter((item) => item.deleted)
    .map((item) => item.id);
  deletedIds.forEach((fileId) => removeRecursively(fileId));
  res.json(envelope({ cleared: true }));
});

function ensureTaskProgress(task) {
  const now = Date.now();
  if (task.status === 'queued' && now - task.createdAt > 500) {
    task.status = 'running';
    task.updatedAt = now;
  }
  if (task.status === 'running') {
    const elapsed = now - task.createdAt;
    const progress = Math.min(95, Math.round((elapsed / 4000) * 100));
    task.progress = Math.max(task.progress ?? 0, progress);
    task.speed_bps = 5_242_880;
    task.eta_seconds = Math.max(0, Math.round((4000 - elapsed) / 1000));
    if (elapsed > 4000) {
      task.status = 'succeed';
      task.progress = 100;
      task.speed_bps = null;
      task.eta_seconds = 0;
      if (!task.completed) {
        const source = files.get(task.sourceId);
        if (source) {
          const name = source.name;
          const parentId = task.target.parentId;
          const disk = task.target.disk;
          const duplicateName = findSiblings(disk, parentId).some((item) => item.name === name && !item.deleted);
          const finalName = duplicateName ? `${name.replace(/(\.[^.]*)?$/, '')}-copy${source.ext ? `.${source.ext}` : ''}` : name;
          const newPath = buildPath(disk, parentId, finalName);
          const record = addFile({
            is_dir: source.is_dir,
            name: finalName,
            disk,
            parent_id: parentId,
            path: newPath,
            size: source.size,
            mime: source.mime,
            ext: source.ext,
            hash: source.hash,
          });
          task.resultFileId = record.id;
        }
        task.completed = true;
      }
    }
  }
  if (task.status === 'succeed') {
    task.progress = 100;
    task.speed_bps = null;
    task.eta_seconds = 0;
  }
}

app.post('/api/files/copy', (req, res) => {
  const { id, target_disk: targetDisk, target_parent_id: targetParentIdInput } = req.body ?? {};
  if (!id || !targetDisk) {
    res.status(400).json(errorEnvelope(40004, '缺少复制参数'));
    return;
  }
  const source = files.get(String(id));
  if (!source) {
    res.status(404).json(errorEnvelope(40401, 'File not found'));
    return;
  }
  const targetParentId = normalizeParentId(targetParentIdInput);
  const taskId = `task-${nanoid(10)}`;
  const task = {
    id: taskId,
    status: 'queued',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    progress: 0,
    eta_seconds: null,
    speed_bps: null,
    sourceId: source.id,
    target: { disk: targetDisk, parentId: targetParentId },
    completed: false,
  };
  taskStore.set(taskId, task);
  res.json(envelope({ task_id: taskId }));
});

app.get('/api/tasks/:id', (req, res) => {
  const id = String(req.params.id);
  const task = taskStore.get(id);
  if (!task) {
    res.status(404).json(errorEnvelope(40401, 'Task not found'));
    return;
  }
  ensureTaskProgress(task);
  res.json(
    envelope({
      status: task.status,
      progress: task.progress ?? null,
      speed_bps: task.speed_bps ?? null,
      eta_seconds: task.eta_seconds ?? null,
      error: null,
    }),
  );
});

const shareStore = new Map([
  [
    'share-demo-1',
    {
      token: 'share-demo-1',
      fileId: '2',
      requiresPassword: false,
      password: null,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      sessions: new Set(),
    },
  ],
  [
    'share-protected',
    {
      token: 'share-protected',
      fileId: '4',
      requiresPassword: true,
      password: '1234',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString(),
      sessions: new Set(),
    },
  ],
]);

function resolveShare(token) {
  const share = shareStore.get(token);
  if (!share) return null;
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    return { ...share, expired: true };
  }
  return share;
}

app.get('/s/:token', (req, res) => {
  const token = String(req.params.token);
  const share = resolveShare(token);
  if (!share || share.expired) {
    res.status(404).json(errorEnvelope(40401, '分享已失效或不存在'));
    return;
  }
  const file = files.get(share.fileId);
  if (!file || file.deleted) {
    res.status(404).json(errorEnvelope(40401, '分享文件不存在'));
    return;
  }
  res.json(
    envelope({
      file: cloneFile(file),
      requires_password: share.requiresPassword,
      expires_at: share.expiresAt,
    }),
  );
});

app.post('/s/:token/unlock', (req, res) => {
  const token = String(req.params.token);
  const share = resolveShare(token);
  if (!share || share.expired) {
    res.status(404).json(errorEnvelope(40401, '分享已失效或不存在'));
    return;
  }
  if (!share.requiresPassword) {
    const sessionToken = `share-${nanoid(12)}`;
    share.sessions.add(sessionToken);
    res.json(envelope({ unlocked: true, session_token: sessionToken }));
    return;
  }
  const { password } = req.body ?? {};
  if (!password) {
    res.status(400).json(errorEnvelope(40005, '缺少口令'));
    return;
  }
  if (password !== share.password) {
    res.status(403).json(errorEnvelope(40301, '口令错误'));
    return;
  }
  const sessionToken = `share-${nanoid(12)}`;
  share.sessions.add(sessionToken);
  res.json(envelope({ unlocked: true, session_token: sessionToken }));
});

app.get('/s/:token/download', (req, res) => {
  const token = String(req.params.token);
  const share = resolveShare(token);
  if (!share || share.expired) {
    res.status(404).json(errorEnvelope(40401, '分享已失效或不存在'));
    return;
  }
  if (share.requiresPassword) {
    const session = req.headers['x-share-session'];
    if (!session || !share.sessions.has(session)) {
      res.status(403).json(errorEnvelope(40302, '分享会话无效'));
      return;
    }
  }
  const file = files.get(share.fileId);
  if (!file || file.deleted) {
    res.status(404).json(errorEnvelope(40401, '分享文件不存在'));
    return;
  }
  res.json(
    envelope({
      url: `https://download.example.com/${encodeURIComponent(file.name)}`,
      headers: {
        'X-Accel-Redirect': `/protected/${encodeURIComponent(file.path)}`,
      },
    }),
  );
});

const PORT = Number.parseInt(process.env.PORT ?? '8787', 10);
app.listen(PORT, () => {
  console.log(`Federated Drive server listening on http://localhost:${PORT}`);
});
