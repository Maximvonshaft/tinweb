import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useShareDetail, useShareUnlock, useShareDownload, useSharePreview, useShareDirectory } from '@/hooks/use-share';
import { useToast } from '@/stores/toast';
import { FilePreviewDialog } from '@/components/FilePreviewDialog';
import { Folder, Grid3x3, Loader2, ChevronRight } from 'lucide-react';
import type { FileItem } from '@/types/api';

function formatSize(bytes: number): string {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** idx).toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export function SharePage() {
  const { token } = useParams();
  const { data, isLoading, isError, error, refetch } = useShareDetail(token);
  const unlockMutation = useShareUnlock(token);
  const downloadShare = useShareDownload();
  const [previewOpen, setPreviewOpen] = useState(false);
  const { push } = useToast();
  const [password, setPassword] = useState('');
  const sessionKey = useMemo(() => (token ? `share:${token}` : 'share'), [token]);
  const sessionToken = token ? sessionStorage.getItem(sessionKey) : null;
  const previewQuery = useSharePreview(token, sessionToken, previewOpen);
  const [activeParentId, setActiveParentId] = useState<number | null>(null);
  const isDirectoryShare = Boolean(data?.file?.is_dir);
  const directoryEnabled = Boolean(token) && isDirectoryShare && (!data?.requires_password || Boolean(sessionToken));
  const directoryQuery = useShareDirectory(token, sessionToken, activeParentId ?? undefined, directoryEnabled);

  useEffect(() => {
    setActiveParentId(null);
  }, [token]);

  if (!token) {
    return <div className="p-8 text-center text-sm text-[var(--fg-2)]">无效的分享链接。</div>;
  }

  const handleUnlock = async () => {
    if (!password) {
      push({ tone: 'warn', title: '输入口令', description: '请输入访问口令。' });
      return;
    }
    try {
      const response = await unlockMutation.mutateAsync({ password });
      sessionStorage.setItem(sessionKey, response.session_token);
      push({ tone: 'success', title: 'UNLOCKED', description: '外链已解锁，可立即下载。' });
      refetch();
    } catch (err) {
      push({ tone: 'danger', title: 'FAILED', description: (err as Error).message });
    }
  };

  const handleDownload = async () => {
    try {
      const info = await downloadShare(token, sessionToken);
      push({ tone: 'success', title: 'DOWNLOAD', description: '已获取下载链接。' });
      window.open(info.url, '_blank');
    } catch (err) {
      if ((err as { code?: number }).code === 40401) {
        sessionStorage.removeItem(sessionKey);
      }
      push({ tone: 'danger', title: 'FAILED', description: (err as Error).message });
    }
  };

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-[var(--fg-2)]">正在载入分享信息…</div>;
  }

  if (isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center text-sm text-[var(--fg-2)]">
        <p className="font-mono text-base tracking-[0.4em]">EXPIRED</p>
        <p>{(error as Error).message}</p>
        <Button variant="outline" onClick={() => refetch()}>
          重试
        </Button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const file = data.file;
  const expired = data.expires_at ? new Date(data.expires_at) < new Date() : false;
  const canAccessContent = !data.requires_password || Boolean(sessionToken);
  const directoryBreadcrumbs = directoryQuery.data?.breadcrumbs ?? (file.is_dir
    ? [{ id: Number(file.id), name: file.name }]
    : []);
  const directoryItems: FileItem[] = directoryQuery.data?.items ?? [];

  const directoryContent = () => {
    if (!file.is_dir) return null;
    if (!canAccessContent) {
      return <p className="text-sm text-[var(--fg-2)]">输入访问口令后即可浏览分享的目录内容。</p>;
    }
    if (directoryQuery.isLoading) {
      return (
        <div className="flex items-center gap-2 text-sm text-[var(--fg-2)]">
          <Loader2 className="animate-spin" size={16} /> 正在加载目录…
        </div>
      );
    }
    if (directoryQuery.isError) {
      return <p className="text-sm text-[var(--danger)]">目录载入失败：{(directoryQuery.error as Error).message}</p>;
    }
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--fg-2)]">
          {directoryBreadcrumbs.map((crumb, index) => (
            <button
              key={`${crumb.id}-${crumb.name}`}
              type="button"
              onClick={() => setActiveParentId(Number(crumb.id))}
              className="flex items-center gap-1 rounded px-2 py-1 uppercase tracking-[0.2em] text-[var(--fg-2)] hover:bg-[var(--hover)] hover:text-[var(--fg)]"
            >
              {index !== 0 && <ChevronRight size={12} />}
              {crumb.name || 'ROOT'}
            </button>
          ))}
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg)]">
          {directoryItems.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--fg-3)]">该目录为空。</div>
          ) : (
            <div className="divide-y divide-[var(--line)]/40">
              {directoryItems.map((item) => (
                <div
                  key={item.id}
                  className={`${item.is_dir ? 'cursor-pointer hover:bg-[var(--hover)]' : 'cursor-default'} flex items-center justify-between px-4 py-3 text-sm transition`}
                  onClick={() => {
                    if (item.is_dir) {
                      setActiveParentId(Number(item.id));
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    {item.is_dir ? <Folder size={18} /> : <Grid3x3 size={18} />}
                    <span className="font-medium text-[var(--fg)]">{item.name}</span>
                  </div>
                  <span className="font-mono text-xs text-[var(--fg-2)]">{item.is_dir ? '目录' : formatSize(item.size)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-[var(--fg-3)]">目录分享暂不支持在线预览与直接下载，请根据文件名称进行查阅。</p>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--fg)]">
      <div
        className={`w-full ${file.is_dir ? 'max-w-3xl' : 'max-w-xl'} space-y-6 rounded-2xl border border-[var(--line)] bg-[var(--bg-2)] p-8 shadow-elevated`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-sm text-[var(--fg-2)]">SHARE TOKEN</p>
            <h1 className="mt-2 font-mono text-lg">{file.name}</h1>
            <p className="text-xs text-[var(--fg-2)]">
              {file.is_dir ? '目录分享' : `大小 ${Math.round(file.size / 1024)} KB`} · 过期时间 {data.expires_at ?? 'N/A'}
            </p>
          </div>
          {expired && <span className="rounded bg-[var(--danger)] px-3 py-1 text-xs text-white">EXPIRED</span>}
        </div>

        {data.requires_password && !sessionToken && (
          <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg)] p-4">
            <p className="font-mono text-xs text-[var(--fg-2)]">输入访问口令</p>
            <div className="mt-3 flex gap-2">
              <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="0000" maxLength={6} />
              <Button onClick={handleUnlock} disabled={unlockMutation.isPending}>
                {unlockMutation.isPending ? '验证中…' : '解锁'}
              </Button>
            </div>
          </div>
        )}

        {file.is_dir ? (
          directoryContent()
        ) : (
          <>
            <div className="flex flex-col gap-3 md:flex-row">
              <Button onClick={handleDownload} disabled={data.requires_password && !sessionToken}>
                下载
              </Button>
              <Button
                variant="outline"
                disabled={data.requires_password && !sessionToken}
                onClick={() => setPreviewOpen(true)}
              >
                浏览器预览
              </Button>
            </div>
            <p className="text-xs text-[var(--fg-2)]">Single-use / Rate-limited / Logged</p>
          </>
        )}
      </div>
      {!file.is_dir && (
        <FilePreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          data={previewQuery.data}
          isLoading={previewQuery.isLoading || previewQuery.isFetching}
          error={(previewQuery.error as Error) ?? null}
          onRetry={() => {
            void previewQuery.refetch();
          }}
        />
      )}
    </div>
  );
}
