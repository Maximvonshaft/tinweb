import { useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
  Copy,
  Folder,
  Grid3x3,
  Loader2,
  Pencil,
  Share2,
  Table,
  Trash2,
  X
} from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFilesQuery, useCreateFolderMutation, useDeleteMutation, useRenameMutation } from '@/hooks/use-files';
import { useDriveStore } from '@/stores/drive';
import { useToast } from '@/stores/toast';
import type { FileItem } from '@/types/api';
import { useApiClient } from '@/hooks/use-api-client';
import { useTasksStore } from '@/stores/tasks';
import { FilePreviewDialog } from '@/components/FilePreviewDialog';
import { useDriveFilePreview } from '@/hooks/use-preview';
import { ShareDialog } from '@/components/ShareDialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu';
import { TooltipContent, TooltipProvider, TooltipRoot, TooltipTrigger } from '@/components/ui/tooltip';

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

function describeExpiry(expiresAt: string | null) {
  if (!expiresAt) return '永久有效';
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return '即将过期';
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `${minutes} 分钟后过期`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时后过期`;
  const days = Math.round(hours / 24);
  return `${days} 天后过期`;
}

function getShareTooltip(item: FileItem): string {
  const shares = item.shares ?? [];
  if (shares.length === 0) return '';
  const unlimited = shares.find((share) => !share.expires_at);
  const requiresPassword = shares.some((share) => share.requires_password);
  if (unlimited) {
    return `分享中 · 永久有效${requiresPassword ? ' · 需口令' : ''}`;
  }
  const sorted = [...shares].sort((a, b) => {
    if (!a.expires_at) return -1;
    if (!b.expires_at) return 1;
    return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
  });
  const primary = sorted[0];
  return `分享中 · ${describeExpiry(primary.expires_at ?? null)}${requiresPassword ? ' · 需口令' : ''}`;
}

function hasActiveShare(item: FileItem) {
  return (item.shares?.length ?? 0) > 0;
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
  const renameMutation = useRenameMutation();
  const deleteMutation = useDeleteMutation();
  const client = useApiClient();
  const upsertTask = useTasksStore((state) => state.upsertTask);
  const [previewTarget, setPreviewTarget] = useState<FileItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewQuery = useDriveFilePreview(previewTarget ? previewTarget.id : null, previewOpen);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingId, setRenamingId] = useState<string | number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [shareTarget, setShareTarget] = useState<FileItem | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const items = useMemo(() => filesQuery.data?.pages.flatMap((page) => page.items) ?? [], [filesQuery.data]);

  const breadcrumbs = useMemo(() => {
    const crumbs: Array<{ label: string; target: string | null }> = [{ label: 'ROOT', target: null }];
    if (parentId) {
      crumbs.push({ label: String(parentId), target: parentId });
    }
    return crumbs;
  }, [parentId]);

  const currentSelection = items.filter((item) => selectedIds.has(String(item.id)));

  const startCreateFolder = () => {
    if (creatingFolder || createFolder.isPending) return;
    setCreatingFolder(true);
    setNewFolderName('');
  };

  const cancelCreateFolder = () => {
    setCreatingFolder(false);
    setNewFolderName('');
  };

  const confirmCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      push({ tone: 'warn', title: '请输入名称', description: '文件夹名称不能为空。' });
      return;
    }
    try {
      await createFolder.mutateAsync({ name, disk, parent_id: parentId });
      push({ tone: 'success', title: '已创建', description: `已在 ${disk} 创建 ${name}` });
      setCreatingFolder(false);
      setNewFolderName('');
    } catch (error) {
      push({ tone: 'danger', title: '创建失败', description: (error as Error).message });
    }
  };

  const deleteItems = async (targets: FileItem[]) => {
    if (targets.length === 0) return;
    const message = targets.length === 1 ? `确认删除 ${targets[0].name}？` : `确认删除选中的 ${targets.length} 项？`;
    if (!window.confirm(message)) return;
    try {
      await Promise.all(targets.map((item) => deleteMutation.mutateAsync({ id: item.id })));
      push({ tone: 'warn', title: '已移至回收站', description: '可在回收站恢复或清空。' });
      clearSelection();
    } catch (error) {
      push({ tone: 'danger', title: '删除失败', description: (error as Error).message });
    }
  };

  const handleDelete = () => {
    void deleteItems(currentSelection);
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
        push({ tone: 'neutral', title: '任务已加入', description: '跨盘复制已加入任务中心。' });
      }
    } catch (error) {
      push({ tone: 'danger', title: '复制失败', description: (error as Error).message });
    }
  };

  const copyPath = async (item: FileItem) => {
    try {
      await navigator.clipboard.writeText(item.path);
      push({ tone: 'success', title: '已复制路径', description: item.path });
    } catch (error) {
      push({ tone: 'danger', title: '复制失败', description: (error as Error).message });
    }
  };

  const openShare = (item: FileItem) => {
    setShareTarget(item);
    setShareDialogOpen(true);
  };

  const startRename = (item: FileItem) => {
    setRenamingId(item.id);
    setRenameValue(item.name);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue('');
  };

  const submitRename = async (item: FileItem) => {
    const name = renameValue.trim();
    if (!name) {
      push({ tone: 'warn', title: '请输入名称', description: '名称不能为空。' });
      return;
    }
    try {
      await renameMutation.mutateAsync({ id: item.id, name });
      push({ tone: 'success', title: '重命名成功', description: `${item.name} → ${name}` });
      cancelRename();
    } catch (error) {
      push({ tone: 'danger', title: '重命名失败', description: (error as Error).message });
    }
  };

  const openItem = (item: FileItem) => {
    if (item.is_dir) {
      setParentId(String(item.id));
    } else {
      setPreviewTarget(item);
      setPreviewOpen(true);
    }
  };

  const renderNameCell = (item: FileItem, size: 'sm' | 'base') => {
    const isRenaming = renamingId === item.id;
    const shareHint = getShareTooltip(item);
    const shareActive = hasActiveShare(item);

    if (isRenaming) {
      return (
        <div className="flex items-center gap-2">
          {item.is_dir ? <Folder size={size === 'sm' ? 16 : 18} /> : <Grid3x3 size={size === 'sm' ? 16 : 18} />}
          <Input
            autoFocus
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void submitRename(item);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                cancelRename();
              }
            }}
            className={clsx('h-8 text-sm', size === 'base' ? 'w-48' : 'w-full')}
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded bg-[var(--accent)]/10 p-1 text-[var(--accent)] hover:bg-[var(--accent)]/20"
              onClick={(event) => {
                event.stopPropagation();
                void submitRename(item);
              }}
              disabled={renameMutation.isPending}
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              className="rounded bg-[var(--fg-2)]/10 p-1 text-[var(--fg-2)] hover:bg-[var(--fg-2)]/20"
              onClick={(event) => {
                event.stopPropagation();
                cancelRename();
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        {item.is_dir ? <Folder size={size === 'sm' ? 16 : 18} /> : <Grid3x3 size={size === 'sm' ? 16 : 18} />}
        <span className="truncate font-medium">{item.name}</span>
        {shareActive && shareHint && (
          <TooltipRoot>
            <TooltipTrigger asChild>
              <span className="text-[var(--accent)]">
                <Share2 size={14} />
              </span>
            </TooltipTrigger>
            <TooltipContent>{shareHint}</TooltipContent>
          </TooltipRoot>
        )}
      </div>
    );
  };

  const renderRow = (item: FileItem) => {
    const selected = selectedIds.has(String(item.id));
    const shareActive = hasActiveShare(item);

    const row = (
      <div
        key={item.id}
        role="button"
        tabIndex={0}
        onClick={(event) => {
          if (renamingId === item.id) return;
          toggleSelect(String(item.id), event.metaKey || event.ctrlKey);
        }}
        onDoubleClick={() => openItem(item)}
        className={clsx(
          'compact-row grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] items-center gap-2 rounded px-3 text-sm transition',
          selected ? 'bg-[rgba(46,107,242,0.18)] text-[var(--accent)]' : 'hover:bg-[var(--hover)]'
        )}
      >
        {renderNameCell(item, 'sm')}
        <span className="font-mono text-xs text-[var(--fg-2)]">{formatSize(item.size)}</span>
        <span className="font-mono text-xs text-[var(--fg-2)]">{new Date(item.updated_at).toLocaleString()}</span>
        <span className="font-mono text-xs text-[var(--fg-2)]">{item.disk}</span>
        <span className="font-mono text-xs text-[var(--fg-2)]">{hashPreview(item.hash)}</span>
        <div className="flex items-center justify-end gap-2 text-[var(--fg-2)]">
          <TooltipRoot>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={clsx(
                  'rounded p-1 transition hover:bg-[var(--hover)]',
                  shareActive ? 'text-[var(--accent)]' : 'text-[var(--fg-2)]'
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  openShare(item);
                }}
              >
                <Share2 size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{shareActive ? '管理分享' : '创建分享'}</TooltipContent>
          </TooltipRoot>
          <TooltipRoot>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="rounded p-1 text-[var(--fg-2)] transition hover:bg-[var(--hover)] hover:text-[var(--fg)]"
                onClick={async (event) => {
                  event.stopPropagation();
                  await copyPath(item);
                }}
              >
                <Copy size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent>复制路径</TooltipContent>
          </TooltipRoot>
          <TooltipRoot>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="rounded p-1 text-[var(--fg-2)] transition hover:bg-[var(--hover)] hover:text-[var(--fg)]"
                onClick={(event) => {
                  event.stopPropagation();
                  startRename(item);
                }}
              >
                <Pencil size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent>重命名</TooltipContent>
          </TooltipRoot>
        </div>
      </div>
    );

    return (
      <ContextMenu key={item.id}>
        <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onSelect={(event) => {
              event.preventDefault();
              openItem(item);
            }}
          >
            {item.is_dir ? '打开' : '预览'}
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={(event) => {
              event.preventDefault();
              void copyPath(item);
            }}
          >
            复制路径
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={(event) => {
              event.preventDefault();
              startRename(item);
            }}
          >
            重命名
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={(event) => {
              event.preventDefault();
              openShare(item);
            }}
          >
            {hasActiveShare(item) ? '管理分享' : '创建分享'}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-[var(--danger)] focus:bg-[rgba(225,29,72,0.15)] focus:text-[var(--danger)]"
            onSelect={(event) => {
              event.preventDefault();
              void deleteItems([item]);
            }}
          >
            删除
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const renderNewFolderRow = () => (
    <div className="compact-row grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] items-center gap-2 rounded bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg-2)]">
      <div className="flex items-center gap-2">
        <Folder size={16} />
        <Input
          autoFocus
          value={newFolderName}
          onChange={(event) => setNewFolderName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void confirmCreateFolder();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              cancelCreateFolder();
            }
          }}
          className="h-8 w-48 text-sm"
          placeholder="新建文件夹"
        />
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded bg-[var(--accent)]/10 p-1 text-[var(--accent)] hover:bg-[var(--accent)]/20"
            onClick={() => void confirmCreateFolder()}
            disabled={createFolder.isPending}
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            className="rounded bg-[var(--fg-2)]/10 p-1 text-[var(--fg-2)] hover:bg-[var(--fg-2)]/20"
            onClick={cancelCreateFolder}
            disabled={createFolder.isPending}
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <span className="font-mono text-xs">—</span>
      <span className="font-mono text-xs">—</span>
      <span className="font-mono text-xs">{disk}</span>
      <span className="font-mono text-xs">—</span>
      <div className="flex justify-end text-xs">草稿</div>
    </div>
  );

  const renderGridItem = (item: FileItem) => {
    const selected = selectedIds.has(String(item.id));
    const shareActive = hasActiveShare(item);

    const card = (
      <div
        key={`grid-${item.id}`}
        className={clsx(
          'group rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg)] p-4 transition',
          selected ? 'border-[var(--accent)] text-[var(--accent)]' : 'hover:border-[var(--accent)]'
        )}
        onClick={(event) => {
          if (renamingId === item.id) return;
          toggleSelect(String(item.id), event.metaKey || event.ctrlKey);
        }}
        onDoubleClick={() => openItem(item)}
      >
        <div className="flex items-center justify-between">
          {renderNameCell(item, 'base')}
          <TooltipRoot>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={clsx(
                  'rounded p-1 transition hover:bg-[var(--hover)]',
                  shareActive ? 'text-[var(--accent)]' : 'text-[var(--fg-2)]'
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  openShare(item);
                }}
              >
                <Share2 size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{shareActive ? '管理分享' : '创建分享'}</TooltipContent>
          </TooltipRoot>
        </div>
        <p className="mt-3 font-mono text-[10px] text-[var(--fg-2)]">{formatSize(item.size)}</p>
        <p className="font-mono text-[10px] text-[var(--fg-2)]">{hashPreview(item.hash)}</p>
      </div>
    );

    return (
      <ContextMenu key={`grid-${item.id}`}>
        <ContextMenuTrigger asChild>{card}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onSelect={(event) => {
              event.preventDefault();
              openItem(item);
            }}
          >
            {item.is_dir ? '打开' : '预览'}
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={(event) => {
              event.preventDefault();
              void copyPath(item);
            }}
          >
            复制路径
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={(event) => {
              event.preventDefault();
              startRename(item);
            }}
          >
            重命名
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={(event) => {
              event.preventDefault();
              openShare(item);
            }}
          >
            {hasActiveShare(item) ? '管理分享' : '创建分享'}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-[var(--danger)] focus:bg-[rgba(225,29,72,0.15)] focus:text-[var(--danger)]"
            onSelect={(event) => {
              event.preventDefault();
              void deleteItems([item]);
            }}
          >
            删除
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const renderNewFolderCard = () => (
    <div className="rounded-[var(--radius)] border border-[var(--accent)] bg-[rgba(46,107,242,0.08)] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[var(--accent)]">
          <Folder size={18} />
          <Input
            autoFocus
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void confirmCreateFolder();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                cancelCreateFolder();
              }
            }}
            className="h-8 text-sm"
            placeholder="未命名文件夹"
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded bg-[var(--accent)]/10 p-1 text-[var(--accent)] hover:bg-[var(--accent)]/20"
            onClick={() => void confirmCreateFolder()}
            disabled={createFolder.isPending}
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            className="rounded bg-[var(--fg-2)]/10 p-1 text-[var(--fg-2)] hover:bg-[var(--fg-2)]/20"
            onClick={cancelCreateFolder}
            disabled={createFolder.isPending}
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <p className="mt-3 font-mono text-[10px] text-[var(--fg-2)]">—</p>
      <p className="font-mono text-[10px] text-[var(--fg-2)]">草稿</p>
    </div>
  );

  const gridView = (
    <div className="space-y-4">
      {filesQuery.isLoading && (
        <div className="flex items-center justify-center p-6 text-sm text-[var(--fg-2)]">
          <Loader2 className="mr-2 animate-spin" size={16} /> 正在索引…
        </div>
      )}
      {!filesQuery.isLoading && items.length === 0 && !creatingFolder && (
        <div className="flex flex-col items-center justify-center gap-2 p-10 text-center text-sm text-[var(--fg-2)]">
          <span className="font-mono text-base tracking-[0.5em]">NO SIGNAL</span>
          <span>将文件拖入以加密上传，或新建文件夹。</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
        {creatingFolder && renderNewFolderCard()}
        {items.map((item) => renderGridItem(item))}
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
        {creatingFolder && renderNewFolderRow()}
        {filesQuery.isLoading && (
          <div className="flex items-center justify-center p-6 text-sm text-[var(--fg-2)]">
            <Loader2 className="mr-2 animate-spin" size={16} /> 正在索引…
          </div>
        )}
        {!filesQuery.isLoading && items.length === 0 && !creatingFolder && (
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
    <TooltipProvider>
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
            <Button variant="outline" onClick={startCreateFolder} disabled={creatingFolder}>
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
      <ShareDialog
        file={shareTarget}
        open={shareDialogOpen && Boolean(shareTarget)}
        onOpenChange={(open) => {
          setShareDialogOpen(open);
          if (!open) {
            setShareTarget(null);
          }
        }}
      />
    </TooltipProvider>
  );
}
