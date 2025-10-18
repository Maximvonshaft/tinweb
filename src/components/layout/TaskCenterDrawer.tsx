import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useTasksStore } from '@/stores/tasks';

interface TaskCenterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const toneByStatus = {
  queued: 'text-[var(--fg-2)]',
  running: 'text-[var(--accent)]',
  succeed: 'text-[var(--success)]',
  failed: 'text-[var(--danger)]',
} as const;

export function TaskCenterDrawer({ open, onOpenChange }: TaskCenterDrawerProps) {
  const tasks = useTasksStore((state) => state.tasks);
  const removeTask = useTasksStore((state) => state.removeTask);

  const entries = useMemo(
    () =>
      Object.values(tasks)
        .map((task) => ({ ...task }))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [tasks],
  );

  return (
    <>
      <div
        className={`fixed inset-y-0 right-0 z-[1100] w-[360px] transform border-l border-[var(--line)] bg-[var(--bg-2)] transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <div>
            <p className="font-mono text-xs tracking-[0.3em] text-[var(--fg-2)]">TASK CENTER</p>
            <p className="text-xs text-[var(--fg-2)]">复制 / 上传 / 跨盘 任务监控</p>
          </div>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </div>
        <div className="space-y-4 overflow-y-auto p-4">
          {entries.length === 0 && (
            <div className="rounded border border-dashed border-[var(--line)] px-4 py-6 text-center text-sm text-[var(--fg-2)]">
              NO SIGNAL<br />
              <span className="text-xs">当前无任务 · 上传或复制后在此监控</span>
            </div>
          )}
          {entries.map((task) => (
            <div key={task.id} className="rounded-lg border border-[var(--line)] bg-[var(--bg)] p-4">
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs text-[var(--fg)]">{task.title}</p>
                <span className={`text-xs ${toneByStatus[task.status]}`}>{task.status.toUpperCase()}</span>
              </div>
              <div className="mt-2 h-1 w-full overflow-hidden rounded bg-[var(--line)]">
                <div
                  className={`h-full bg-[var(--accent)] transition-all ${task.status === 'succeed' ? 'bg-[var(--success)]' : ''}`}
                  style={{ width: `${Math.min(100, task.progress ?? 0)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-[var(--fg-2)]">
                <span>速度：{task.speed_bps ? `${(task.speed_bps / 1024 / 1024).toFixed(1)} MB/s` : '—'}</span>
                <span>ETA：{task.eta_seconds ? `${Math.round(task.eta_seconds)}s` : '—'}</span>
              </div>
              {task.error && <p className="mt-2 text-xs text-[var(--danger)]">错误：{task.error}</p>}
              <div className="mt-3 flex items-center gap-2 text-xs text-[var(--fg-2)]">
                <Button
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => removeTask(task.id)}
                  disabled={task.status === 'running'}
                >
                  移除
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {open && <div className="fixed inset-0 z-[1000] bg-black/30" onClick={() => onOpenChange(false)} />}
    </>
  );
}
