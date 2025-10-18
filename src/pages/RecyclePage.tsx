import { useMemo } from 'react';
import { Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFilesQuery, useRestoreMutation, useDeleteMutation } from '@/hooks/use-files';
import { useDriveStore } from '@/stores/drive';
import { useToast } from '@/stores/toast';
import { useApiClient } from '@/hooks/use-api-client';

export function RecyclePage() {
  const disk = useDriveStore((state) => state.disk);
  const { push } = useToast();
  const restore = useRestoreMutation();
  const deleteMutation = useDeleteMutation();
  const client = useApiClient();

  const filesQuery = useFilesQuery({ disk, parentId: null, deleted: true });
  const items = useMemo(() => filesQuery.data?.pages.flatMap((page) => page.items) ?? [], [filesQuery.data]);

  const handleRestore = async (id: string | number) => {
    try {
      await restore.mutateAsync({ id });
      push({ tone: 'success', title: 'RESTORED', description: '文件已恢复至原路径。' });
    } catch (error) {
      push({ tone: 'danger', title: 'FAILED', description: (error as Error).message });
    }
  };

  const handleDelete = async (id: string | number) => {
    if (!window.confirm('确认彻底删除？此操作不可恢复。')) return;
    try {
      await deleteMutation.mutateAsync({ id, force: true });
      push({ tone: 'warn', title: 'PURGED', description: '文件已永久删除。' });
    } catch (error) {
      push({ tone: 'danger', title: 'FAILED', description: (error as Error).message });
    }
  };

  const handleEmpty = async () => {
    if (!window.confirm('长按确认？请连续按住 2 秒进行安全校验。')) return;
    try {
      await client<{ cleared: boolean }>('recycle/empty', { method: 'POST' });
      push({ tone: 'warn', title: 'RECYCLE CLEARED', description: '回收站已清空。' });
      filesQuery.refetch();
    } catch (error) {
      push({ tone: 'danger', title: 'FAILED', description: (error as Error).message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg-2)] px-4 py-3">
        <div className="font-mono text-xs tracking-[0.3em] text-[var(--fg-2)]">RECYCLE BIN</div>
        <Button variant="danger" onClick={handleEmpty}>
          清空回收站
        </Button>
      </div>
      <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg-2)]">
        <div className="grid grid-cols-[3fr_2fr_auto] items-center gap-2 border-b border-[var(--line)] px-4 py-2 font-mono text-[10px] tracking-[0.3em] text-[var(--fg-2)]">
          <span>ITEM</span>
          <span>PATH</span>
          <span className="text-right">OPERATIONS</span>
        </div>
        <div className="divide-y divide-[var(--line)]/40">
          {filesQuery.isLoading && (
            <div className="flex items-center justify-center p-6 text-sm text-[var(--fg-2)]">
              <Loader2 className="mr-2 animate-spin" size={16} /> LOADING…
            </div>
          )}
          {!filesQuery.isLoading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 p-10 text-center text-sm text-[var(--fg-2)]">
              <span className="font-mono text-base tracking-[0.4em]">EMPTY</span>
              <span>暂无删除记录。</span>
            </div>
          )}
          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-[3fr_2fr_auto] items-center gap-2 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-[var(--fg)]">{item.name}</p>
                <p className="font-mono text-[10px] text-[var(--fg-2)]">{new Date(item.updated_at).toLocaleString()}</p>
              </div>
              <div className="font-mono text-xs text-[var(--fg-2)]">{item.path}</div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" className="h-8 px-2 text-xs" onClick={() => handleRestore(item.id)}>
                  <RotateCcw size={14} /> 还原
                </Button>
                <Button variant="danger" className="h-8 px-2 text-xs" onClick={() => handleDelete(item.id)}>
                  <Trash2 size={14} /> 彻底删除
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
