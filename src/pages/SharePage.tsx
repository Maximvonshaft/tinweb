import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useShareDetail, useShareUnlock, fetchShareDownload } from '@/hooks/use-share';
import { useToast } from '@/stores/toast';

export function SharePage() {
  const { token } = useParams();
  const { data, isLoading, isError, error, refetch } = useShareDetail(token);
  const unlockMutation = useShareUnlock(token);
  const { push } = useToast();
  const [password, setPassword] = useState('');
  const sessionKey = useMemo(() => (token ? `share:${token}` : 'share'), [token]);
  const sessionToken = token ? sessionStorage.getItem(sessionKey) : null;

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
      const info = await fetchShareDownload(token, sessionToken);
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--fg)]">
      <div className="w-full max-w-xl space-y-6 rounded-2xl border border-[var(--line)] bg-[var(--bg-2)] p-8 shadow-elevated">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-sm text-[var(--fg-2)]">SHARE TOKEN</p>
            <h1 className="mt-2 font-mono text-lg">{file.name}</h1>
            <p className="text-xs text-[var(--fg-2)]">
              大小 {Math.round(file.size / 1024)} KB · 过期时间 {data.expires_at ?? 'N/A'}
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

        <div className="flex flex-col gap-3 md:flex-row">
          <Button onClick={handleDownload} disabled={data.requires_password && !sessionToken}>
            下载
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              push({ tone: 'neutral', title: 'PREVIEW', description: '浏览器预览将在后续版本提供。' });
            }}
          >
            浏览器预览
          </Button>
        </div>

        <p className="text-xs text-[var(--fg-2)]">Single-use / Rate-limited / Logged</p>
      </div>
    </div>
  );
}
