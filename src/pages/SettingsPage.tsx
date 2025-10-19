import { Button } from '@/components/ui/button';
import { useSettingsStore } from '@/stores/settings';
import { useAppConfig } from '@/providers/config-provider';
import { useHealthQuery } from '@/hooks/use-health';
import { useToast } from '@/stores/toast';
import { useAuthStore } from '@/stores/auth';
import { useApiClient } from '@/hooks/use-api-client';
import type { IndexerSummary } from '@/types/api';

export function SettingsPage() {
  const { API_BASE_URL, SHARE_BASE_URL, SHARE_API_BASE_URL } = useAppConfig();
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const density = useSettingsStore((state) => state.density);
  const setDensity = useSettingsStore((state) => state.setDensity);
  const { data: health } = useHealthQuery();
  const { push } = useToast();
  const user = useAuthStore((state) => state.user);
  const client = useApiClient();

  const triggerIndexer = async () => {
    try {
      const summary = await client<IndexerSummary>('indexer/run', { method: 'POST' });
      push({
        tone: 'success',
        title: 'INDEX TRIGGERED',
        description: `已索引 ${summary.files} 个文件 / ${summary.directories} 个目录，耗时 ${summary.duration_ms}ms。`,
      });
    } catch (error) {
      push({ tone: 'danger', title: 'FAILED', description: (error as Error).message });
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg-2)] p-6">
        <h2 className="font-mono text-sm tracking-[0.3em] text-[var(--fg-2)]">APPEARANCE</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs text-[var(--fg-2)]">主题</p>
            <div className="mt-2 flex gap-2">
              <Button variant={theme === 'dark' ? 'primary' : 'outline'} onClick={() => setTheme('dark')}>
                深色
              </Button>
              <Button variant={theme === 'light' ? 'primary' : 'outline'} onClick={() => setTheme('light')}>
                亮色
              </Button>
            </div>
          </div>
          <div>
            <p className="text-xs text-[var(--fg-2)]">密度</p>
            <div className="mt-2 flex gap-2">
              <Button variant={density === 'compact' ? 'primary' : 'outline'} onClick={() => setDensity('compact')}>
                紧凑
              </Button>
              <Button variant={density === 'standard' ? 'primary' : 'outline'} onClick={() => setDensity('standard')}>
                标准
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg-2)] p-6">
        <h2 className="font-mono text-sm tracking-[0.3em] text-[var(--fg-2)]">NETWORK</h2>
        <div className="mt-4 space-y-3 text-sm">
          <div>
            <p className="font-mono text-xs text-[var(--fg-2)]">API BASE</p>
            <p className="mt-1 rounded-[var(--radius-small)] bg-[var(--bg)] px-3 py-2 font-mono text-xs">{API_BASE_URL}</p>
          </div>
          <div>
            <p className="font-mono text-xs text-[var(--fg-2)]">SHARE BASE</p>
            <p className="mt-1 rounded-[var(--radius-small)] bg-[var(--bg)] px-3 py-2 font-mono text-xs">{SHARE_BASE_URL}</p>
          </div>
          <div>
            <p className="font-mono text-xs text-[var(--fg-2)]">SHARE API</p>
            <p className="mt-1 rounded-[var(--radius-small)] bg-[var(--bg)] px-3 py-2 font-mono text-xs">{SHARE_API_BASE_URL}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg-2)] p-6">
        <h2 className="font-mono text-sm tracking-[0.3em] text-[var(--fg-2)]">STORAGE HEALTH</h2>
        <div className="mt-4 space-y-4">
          {health?.disks.map((disk) => (
            <div key={disk.name} className="rounded border border-[var(--line)] bg-[var(--bg)] p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[var(--fg)]">{disk.name}</span>
                <span className="text-xs text-[var(--fg-2)]">状态：{disk.status}</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-[var(--line)]">
                <div
                  className={`h-full ${disk.status === 'ok' ? 'bg-[var(--success)]' : disk.status === 'degraded' ? 'bg-[var(--warn)]' : 'bg-[var(--danger)]'}`}
                  style={{ width: `${Math.min(100, Math.max(10, 120 - disk.latency_ms / 2))}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-[var(--fg-2)]">延迟：{disk.latency_ms}ms {disk.note === 'read-only' ? '· 🔒 READ-ONLY' : ''}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg-2)] p-6">
        <h2 className="font-mono text-sm tracking-[0.3em] text-[var(--fg-2)]">ADMIN</h2>
        {user?.role === 'admin' ? (
          <Button variant="outline" onClick={triggerIndexer}>
            触发索引任务
          </Button>
        ) : (
          <p className="text-xs text-[var(--fg-2)]">仅管理员可触发索引。</p>
        )}
      </section>
    </div>
  );
}
