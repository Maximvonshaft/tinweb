import { useMemo, useState } from 'react';
import { ChevronRight, Copy, Folder, Grid3x3, Loader2, MoreHorizontal, Share2, Table, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFilesQuery, useCreateFolderMutation, useDeleteMutation } from '@/hooks/use-files';
import { useDriveStore } from '@/stores/drive';
import { useToast } from '@/stores/toast';
import type { FileItem } from '@/types/api';
import { useApiClient } from '@/hooks/use-api-client';
import { useTasksStore } from '@/stores/tasks';
import { FilePreviewDialog } from '@/components/FilePreviewDialog';
import { useDriveFilePreview } from '@/hooks/use-preview';
import { useShareCreate } from '@/hooks/use-share';
import { useAppConfig } from '@/providers/config-provider';

function formatSize(bytes: number): string {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** idx).toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function hashPreview(hash?: string | null) {
  if (!hash) return '—';
  if (hash.length <= 8) return hash;
  return `${hash.slice(0, 4)}··${hash.slice(-4)}`;
}

export function DrivePage() {
  const disk = useDriveStore((state) => state.disk);
  const parentId = useDriveStore((state) => state.parentId);
  const search = useDriveStore((state) => state.search);
  const viewMode = useDriveStore((state) => state.viewMode);
  const setViewMode = useDriveStore((state) => state.setViewMode);
  const selectedIds = useDriveStore((state) => state.selectedIds);
  const toggleSelect = useDriveStore((state) => state.toggleSelect);
  const clearSelection = useDriveStore((state) => state.clearSelection);
  const setParentId = useDriveStore((state) => state.setParentId);
  const { push } = useToast();

  const filesQuery = useFilesQuery({ disk, parentId, deleted: false, search });
  const createFolder = useCreateFolderMutation();
  const deleteMutation = useDeleteMutation();
  const client = useApiClient();
  const upsertTask = useTasksStore((state) => state.upsertTask);
  const [previewTarget, setPreviewTarget] = useState<FileItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewQuery = useDriveFilePreview(previewTarget ? previewTarget.id : null, previewOpen);
  const shareMutation = useShareCreate();
  const { SHARE_BASE_URL } = useAppConfig();

  const items = useMemo(() => filesQuery.data?.pages.flatMap((page) => page.items) ?? [], [filesQuery.data]);

  const breadcrumbs = useMemo(() => {
    const crumbs: Array<{ label: string; target: string | null }> = [{ label: 'ROOT', target: null }];
    if (parentId) {
      crumbs.push({ label: String(parentId), target: parentId });
    }
    return crumbs;
  }, [parentId]);

  const currentSelection = items.filter((item) => selectedIds.has(String(item.id)));

  const handleCreateFolder = async () => {
    const name = window.prompt('输入新文件夹名称');
    if (!name) return;
    try {
      await createFolder.mutateAsync({ name, disk, parent_id: parentId });
      push({ tone: 'success', title: 'FOLDER CREATED', description: `已在 ${disk} 创建 ${name}` });
    } catch (error) {
      push({ tone: 'danger', title: 'FAILED', description: (error as Error).message });
    }
  };

  const handleDelete = async () => {
    if (currentSelection.length === 0) return;
    if (!window.confirm(`确认删除选中的 ${currentSelection.length} 项？`)) return;
    try {
      await Promise.all(currentSelection.map((item) => deleteMutation.mutateAsync({ id: item.id })));
      push({ tone: 'warn', title: 'MOVED TO RECYCLE', description: '可在回收站恢复或清空。' });
      clearSelection();
    } catch (error) {
      push({ tone: 'danger', title: 'FAILED', description: (error as Error).message });
    }
  };

  const handleShare = async (item: FileItem) => {
    if (shareMutation.isPending) {
      push({ tone: 'warn', title: 'HOLD ON', description: '正在生成外链，请稍候…' });
      return;
    }
    const expiresInput = window.prompt('输入外链有效期（小时，可留空为 24 小时）', '24');
    if (expiresInput === null) {
      return;
    }
    const trimmed = expiresInput.trim();
    let expiresInHours: number | null = 24;
    if (trimmed !== '') {
      const parsed = Number(trimmed);
      if (Number.isNaN(parsed) || parsed <= 0) {
        push({ tone: 'warn', title: 'INVALID', description: '请输入正确的小时数。' });
        return;
      }
      expiresInHours = Math.max(1, Math.round(parsed));
    }
    const passwordInput = window.prompt('设置访问口令（可留空）') ?? '';
    try {
      const result = await shareMutation.mutateAsync({
        fileId: item.id,
        expires_in_hours: expiresInHours ?? undefined,
        password: passwordInput.trim() ? passwordInput.trim() : undefined,
      });
      const base = SHARE_BASE_URL.replace(/\/$/, '');
      const shareUrl = `${base}/${result.token}`;
      const extra = result.requires_password ? '（需口令）' : '';
      try {
        await navigator.clipboard.writeText(shareUrl);
        push({ tone: 'success', title: 'SHARE READY', description: `外链已复制${extra}：${shareUrl}` });
      } catch {
        push({ tone: 'success', title: 'SHARE READY', description: `外链${extra}：${shareUrl}` });
      }
    } catch (error) {
      push({ tone: 'danger', title: 'FAILED', description: (error as Error).message });
    }
  };

  const handleCopy = async () => {
    const target = currentSelection[0];
    if (!target) {
      push({ tone: 'warn', title: '选择文件', description: '请选择一项进行跨盘复制。' });
      return;
    }
    try {
      const response = await client<{ task_id?: string }>('files/copy', {
        method: 'POST',
        body: JSON.stringify({ id: target.id, target_parent_id: null, target_disk: disk === 'local' ? 'gdrive' : 'local' }),
      });
      if (response?.task_id) {
        upsertTask({
          id: response.task_id,
          title: `COPY ${target.disk}:${target.name}`,
          status: 'queued',
          progress: 0,
          updatedAt: Date.now(),
        });
        push({ tone: 'neutral', title: 'TASK QUEUED', description: '跨盘复制已加入任务中心。' });
      }
    } catch (error) {
      push({ tone: 'danger', title: 'FAILED', description: (error as Error).message });
    }
  };

  const renderRow = (item: FileItem) => {
    const selected = selectedIds.has(String(item.id));
    return (
      <div
        key={item.id}
        role="button"
        tabIndex={0}
        onClick={(event) => toggleSelect(String(item.id), event.metaKey || event.ctrlKey)}
        onDoubleClick={() => {
          if (item.is_dir) {
            setParentId(String(item.id));
          } else {
            setPreviewTarget(item);
            setPreviewOpen(true);
          }
        }}
        className={`compact-row grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] items-center gap-2 rounded px-3 text-sm transition ${
          selected ? 'bg-[rgba(46,107,242,0.18)] text-[var(--accent)]' : 'hover:bg-[var(--hover)]'
        }`}
      >
        <div className="flex items-center gap-2">
          {item.is_dir ? <Folder size={16} /> : <Grid3x3 size={16} />}
          <span className="truncate font-medium">{item.name}</span>
        </div>
        <span className="font-mono text-xs text-[var(--fg-2)]">{formatSize(item.size)}</span>
        <span className="font-mono text-xs text-[var(--fg-2)]">{new Date(item.updated_at).toLocaleString()}</span>
        <span className="font-mono text-xs text-[var(--fg-2)]">{item.disk}</span>
        <span className="font-mono text-xs text-[var(--fg-2)]">{hashPreview(item.hash)}</span>
        <div className="flex items-center justify-end gap-2 text-[var(--fg-2)]">
          <Share2
            size={16}
            className={`cursor-pointer hover:text-[var(--accent)] ${shareMutation.isPending ? 'opacity-50' : ''}`}
            onClick={(event) => {
              event.stopPropagation();
              void handleShare(item);
            }}
          />
          <Copy
            size={16}
            className="cursor-pointer hover:text-[var(--accent)]"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(item.path);
                push({ tone: 'success', title: 'COPIED', description: '已复制路径。' });
              } catch (err) {
                push({ tone: 'danger', title: 'FAILED', description: (err as Error).message });
              }
            }}
          />
          <MoreHorizontal size={16} className="cursor-pointer hover:text-[var(--accent)]" />
        </div>
      </div>
    );
  };

  const gridView = (
    <div className="space-y-4">
      {filesQuery.isLoading && (
        <div className="flex items-center justify-center p-6 text-sm text-[var(--fg-2)]">
          <Loader2 className="mr-2 animate-spin" size={16} /> 正在索引…
        </div>
      )}
      {!filesQuery.isLoading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 p-10 text-center text-sm text-[var(--fg-2)]">
          <span className="font-mono text-base tracking-[0.5em]">NO SIGNAL</span>
          <span>将文件拖入以加密上传，或新建文件夹。</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const selected = selectedIds.has(String(item.id));
          return (
            <div
              key={`grid-${item.id}`}
            className={`group rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg)] p-4 transition ${
              selected ? 'border-[var(--accent)] text-[var(--accent)]' : 'hover:border-[var(--accent)]'
            }`}
            onClick={(event) => toggleSelect(String(item.id), event.metaKey || event.ctrlKey)}
            onDoubleClick={() => {
              if (item.is_dir) {
                setParentId(String(item.id));
              } else {
                setPreviewTarget(item);
                setPreviewOpen(true);
              }
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {item.is_dir ? <Folder size={18} /> : <Grid3x3 size={18} />}
                <span className="truncate text-sm font-semibold">{item.name}</span>
              </div>
              <Share2
                size={16}
                className={`cursor-pointer text-[var(--fg-2)] hover:text-[var(--accent)] ${shareMutation.isPending ? 'opacity-50' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  void handleShare(item);
                }}
              />
            </div>
            <p className="mt-3 font-mono text-[10px] text-[var(--fg-2)]">{formatSize(item.size)}</p>
            <p className="font-mono text-[10px] text-[var(--fg-2)]">{hashPreview(item.hash)}</p>
            </div>
          );
        })}
      </div>
      {filesQuery.hasNextPage && (
        <div className="pb-6 text-center">
          <Button variant="outline" onClick={() => filesQuery.fetchNextPage()} disabled={filesQuery.isFetchingNextPage}>
            {filesQuery.isFetchingNextPage ? '载入中…' : '加载更多'}
          </Button>
        </div>
      )}
    </div>
  );

  const tableView = (
    <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg-2)]">
      <div className="compact-row grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] items-center gap-2 border-b border-[var(--line)] px-3 font-mono text-[10px] tracking-[0.3em] text-[var(--fg-2)]">
        <span>NAME</span>
        <span>SIZE</span>
        <span>UPDATED</span>
        <span>DISK</span>
        <span>HASH</span>
        <span className="text-right">ACTIONS</span>
      </div>
      <div className="divide-y divide-[var(--line)]/40">
        {filesQuery.isLoading && (
          <div className="flex items-center justify-center p-6 text-sm text-[var(--fg-2)]">
            <Loader2 className="mr-2 animate-spin" size={16} /> 正在索引…
          </div>
        )}
        {!filesQuery.isLoading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 p-10 text-center text-sm text-[var(--fg-2)]">
            <span className="font-mono text-base tracking-[0.5em]">NO SIGNAL</span>
            <span>将文件拖入以加密上传，或新建文件夹。</span>
          </div>
        )}
        {items.map((item) => renderRow(item))}
      </div>
      {filesQuery.hasNextPage && (
        <div className="border-t border-[var(--line)] bg-[var(--bg)] p-3 text-center">
          <Button variant="outline" onClick={() => filesQuery.fetchNextPage()} disabled={filesQuery.isFetchingNextPage}>
            {filesQuery.isFetchingNextPage ? '载入中…' : '加载更多'}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg-2)] px-4 py-3">
        <div className="flex items-center gap-2 font-mono text-xs text-[var(--fg-2)]">
          {breadcrumbs.map((crumb, index) => (
            <button
              key={crumb.label}
              type="button"
              onClick={() => setParentId(crumb.target)}
              className="flex items-center gap-1 text-xs uppercase text-[var(--fg-2)] hover:text-[var(--fg)]"
            >
              {index !== 0 && <ChevronRight size={12} />}
              {crumb.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant={viewMode === 'table' ? 'primary' : 'outline'} onClick={() => setViewMode('table')}>
            <Table size={16} />
          </Button>
          <Button variant={viewMode === 'grid' ? 'primary' : 'outline'} onClick={() => setViewMode('grid')}>
            <Grid3x3 size={16} />
          </Button>
          <Button variant="outline" onClick={handleCreateFolder}>
            新建文件夹
          </Button>
          <Button variant="outline" onClick={handleDelete} disabled={currentSelection.length === 0}>
            <Trash2 size={16} /> 删除
          </Button>
          <Button variant="outline" onClick={handleCopy} disabled={currentSelection.length === 0}>
            跨盘复制
          </Button>
        </div>
      </div>
      {viewMode === 'grid' ? gridView : tableView}
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
    </div>
  );
}
