import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useDriveStore } from '@/stores/drive';
import { useFilesQuery } from '@/hooks/use-files';
import type { FileItem, HealthDisk } from '@/types/api';

interface DirectoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disks: HealthDisk[];
}

interface StackNode {
  id: string | null;
  label: string;
}

export function DirectoryDrawer({ open, onOpenChange, disks }: DirectoryDrawerProps) {
  const disk = useDriveStore((state) => state.disk);
  const setDisk = useDriveStore((state) => state.setDisk);
  const setParentId = useDriveStore((state) => state.setParentId);
  const [stack, setStack] = useState<StackNode[]>([{ id: null, label: 'ROOT' }]);

  useEffect(() => {
    if (open) {
      setStack([{ id: null, label: 'ROOT' }]);
    }
  }, [open, disk]);

  const current = stack[stack.length - 1];
  const filesQuery = useFilesQuery({ disk, parentId: current.id, deleted: false, search: '' });
  const directories = useMemo(
    () => filesQuery.data?.pages.flatMap((page) => page.items).filter((item) => item.is_dir) ?? [],
    [filesQuery.data],
  );

  const enterDirectory = (item: FileItem) => {
    setStack((prev) => [...prev, { id: String(item.id), label: item.name }]);
  };

  const goBack = () => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const selectDirectory = (target: string | null) => {
    setParentId(target);
    onOpenChange(false);
  };

  return (
    <>
      <div
        className={`fixed inset-y-0 left-0 z-[1200] w-[320px] transform border-r border-[var(--line)] bg-[var(--bg-2)] transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <div>
            <p className="font-mono text-xs tracking-[0.3em] text-[var(--fg-2)]">DIRECTORY</p>
            <p className="text-xs text-[var(--fg-2)]">选择磁盘与目录</p>
          </div>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </div>
        <div className="h-full overflow-y-auto p-4 space-y-6">
          <section>
            <p className="mb-2 text-xs text-[var(--fg-2)]">磁盘</p>
            <div className="flex flex-wrap gap-2">
              {disks.map((item) => (
                <Button
                  key={item.name}
                  variant={disk === item.name ? 'primary' : 'outline'}
                  onClick={() => {
                    setDisk(item.name);
                    setStack([{ id: null, label: 'ROOT' }]);
                  }}
                >
                  {item.name}
                </Button>
              ))}
            </div>
          </section>
          <section>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs text-[var(--fg-2)]">当前位置</p>
              <div className="text-xs text-[var(--fg-2)]">{stack.map((node) => node.label).join(' / ')}</div>
            </div>
            <div className="space-y-2">
              {stack.length > 1 && (
                <Button variant="outline" className="w-full justify-start" onClick={goBack}>
                  返回上一级
                </Button>
              )}
              <Button variant="outline" className="w-full justify-start" onClick={() => selectDirectory(null)}>
                回到根目录
              </Button>
              {filesQuery.isLoading && (
                <div className="rounded border border-dashed border-[var(--line)] px-3 py-4 text-center text-xs text-[var(--fg-2)]">
                  正在加载目录…
                </div>
              )}
              {directories.length === 0 && !filesQuery.isLoading && (
                <div className="rounded border border-dashed border-[var(--line)] px-3 py-4 text-center text-xs text-[var(--fg-2)]">
                  此目录暂无子目录。
                </div>
              )}
              {directories.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm">
                  <span className="truncate">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => enterDirectory(item)}>
                      查看
                    </Button>
                    <Button
                      variant="primary"
                      className="h-7 px-3 text-xs"
                      onClick={() => selectDirectory(String(item.id))}
                    >
                      前往
                    </Button>
                  </div>
                </div>
              ))}
              {filesQuery.hasNextPage && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => filesQuery.fetchNextPage()}
                  disabled={filesQuery.isFetchingNextPage}
                >
                  {filesQuery.isFetchingNextPage ? '加载中…' : '加载更多'}
                </Button>
              )}
            </div>
          </section>
        </div>
      </div>
      {open && <div className="fixed inset-0 z-[1100] bg-black/30" onClick={() => onOpenChange(false)} />}
    </>
  );
}
