import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, Copy, Loader2, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppConfig } from '@/providers/config-provider';
import { useToast } from '@/stores/toast';
import type { FileItem } from '@/types/api';
import {
  useFileShares,
  useShareCreate,
  useShareDeleteMutation,
  useShareUpdateMutation
} from '@/hooks/use-share';

interface ShareDialogProps {
  file: FileItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QUICK_PRESETS: Array<{ label: string; hours: number }> = [
  { label: '24 小时', hours: 24 },
  { label: '3 天', hours: 72 },
  { label: '7 天', hours: 168 }
];

function describeExpiry(expiresAt: string | null) {
  if (!expiresAt) {
    return '永久有效';
  }
  const expiry = new Date(expiresAt);
  const diff = expiry.getTime() - Date.now();
  if (diff <= 0) {
    return '即将过期';
  }
  const diffMinutes = Math.round(diff / 60000);
  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟后过期`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} 小时后过期`;
  }
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} 天后过期`;
}

export function ShareDialog({ file, open, onOpenChange }: ShareDialogProps) {
  const { SHARE_BASE_URL } = useAppConfig();
  const shareCreate = useShareCreate();
  const deleteMutation = useShareDeleteMutation();
  const updateMutation = useShareUpdateMutation();
  const [password, setPassword] = useState('');
  const [customHours, setCustomHours] = useState(24);
  const [duration, setDuration] = useState<'preset' | 'custom' | 'forever'>('preset');
  const [selectedPreset, setSelectedPreset] = useState(24);
  const [editingShareId, setEditingShareId] = useState<number | null>(null);
  const [editingHours, setEditingHours] = useState(24);
  const { push } = useToast();

  const fileId = file ? Number(file.id) : null;
  const sharesQuery = useFileShares(fileId);

  const expiresInHours = useMemo(() => {
    if (duration === 'forever') return null;
    if (duration === 'custom') return Math.max(1, Math.round(customHours));
    return selectedPreset;
  }, [duration, customHours, selectedPreset]);

  const shareUrlBase = SHARE_BASE_URL.replace(/\/$/, '');

  const handleCreate = async () => {
    if (!file) return;
    try {
      const result = await shareCreate.mutateAsync({
        fileId: file.id,
        expires_in_hours: duration === 'forever' ? null : expiresInHours,
        password: password.trim() ? password.trim() : undefined
      });
      const url = `${shareUrlBase}/${result.token}`;
      try {
        await navigator.clipboard.writeText(url);
        push({ tone: 'success', title: '外链已创建', description: '已复制到剪贴板。' });
      } catch {
        push({ tone: 'success', title: '外链已创建', description: url });
      }
      setPassword('');
      onOpenChange(false);
    } catch (error) {
      push({ tone: 'danger', title: '创建失败', description: (error as Error).message });
    }
  };

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      push({ tone: 'success', title: '已复制外链', description: url });
    } catch (error) {
      push({ tone: 'danger', title: '复制失败', description: (error as Error).message });
    }
  };

  const handleDelete = async (shareId: number) => {
    if (!fileId) return;
    try {
      await deleteMutation.mutateAsync({ shareId, fileId });
      push({ tone: 'success', title: '已取消分享', description: '外链已失效。' });
    } catch (error) {
      push({ tone: 'danger', title: '操作失败', description: (error as Error).message });
    }
  };

  const handleUpdate = async (shareId: number, hours: number | null) => {
    if (!fileId) return;
    try {
      await updateMutation.mutateAsync({ shareId, fileId, expires_in_hours: hours });
      push({ tone: 'success', title: '已更新有效期', description: hours ? `有效期延长为 ${hours} 小时` : '改为永久有效。' });
      setEditingShareId(null);
    } catch (error) {
      push({ tone: 'danger', title: '更新失败', description: (error as Error).message });
    }
  };

  const buildShareUrl = (token: string) => `${shareUrlBase}/${token}`;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1200] bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[1300] w-[90vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg-2)] p-6 shadow-elevated focus:outline-none">
          <div className="flex items-center justify-between">
            <div>
              <Dialog.Title className="font-mono text-sm text-[var(--fg)]">分享 {file?.name}</Dialog.Title>
              <Dialog.Description className="text-xs text-[var(--fg-2)]">生成外链或管理现有分享。</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="rounded p-1 text-[var(--fg-2)] hover:text-[var(--fg)]">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-6 space-y-4">
            <div className="space-y-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg)] p-4">
              <p className="font-mono text-xs text-[var(--fg-2)]">设置有效期</p>
              <div className="flex flex-wrap items-center gap-2">
                {QUICK_PRESETS.map((preset) => (
                  <button
                    key={preset.hours}
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs ${
                      duration === 'preset' && selectedPreset === preset.hours
                        ? 'border-[var(--accent)] bg-[rgba(46,107,242,0.15)] text-[var(--accent)]'
                        : 'border-transparent bg-[var(--bg-2)] text-[var(--fg-2)] hover:border-[var(--accent)]'
                    }`}
                    onClick={() => {
                      setDuration('preset');
                      setSelectedPreset(preset.hours);
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs ${
                    duration === 'custom'
                      ? 'border-[var(--accent)] bg-[rgba(46,107,242,0.15)] text-[var(--accent)]'
                      : 'border-transparent bg-[var(--bg-2)] text-[var(--fg-2)] hover:border-[var(--accent)]'
                  }`}
                  onClick={() => setDuration('custom')}
                >
                  自定义
                </button>
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs ${
                    duration === 'forever'
                      ? 'border-[var(--accent)] bg-[rgba(46,107,242,0.15)] text-[var(--accent)]'
                      : 'border-transparent bg-[var(--bg-2)] text-[var(--fg-2)] hover:border-[var(--accent)]'
                  }`}
                  onClick={() => setDuration('forever')}
                >
                  永久有效
                </button>
              </div>
              {duration === 'custom' && (
                <div className="flex items-center gap-2 text-xs text-[var(--fg-2)]">
                  <Input
                    type="number"
                    min={1}
                    value={customHours}
                    onChange={(event) => setCustomHours(Number(event.target.value) || 1)}
                    className="w-24"
                  />
                  小时
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-[var(--fg-2)]">
                <Input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="可选访问口令"
                  maxLength={12}
                  className="max-w-xs"
                />
                {password && <span>将要求访问者输入口令。</span>}
              </div>
              <div className="flex items-center justify-between text-xs text-[var(--fg-2)]">
                <span>创建后立即复制到剪贴板。</span>
                <Button onClick={handleCreate} disabled={shareCreate.isPending || !file}>
                  {shareCreate.isPending ? (
                    <Loader2 className="mr-2 animate-spin" size={16} />
                  ) : (
                    <Plus className="mr-2" size={16} />
                  )}
                  创建分享
                </Button>
              </div>
            </div>

            <div className="space-y-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg)] p-4">
              <p className="font-mono text-xs text-[var(--fg-2)]">已创建的分享</p>
              {sharesQuery.isLoading && (
                <div className="flex items-center gap-2 text-xs text-[var(--fg-2)]">
                  <Loader2 className="animate-spin" size={16} /> 正在加载…
                </div>
              )}
              {sharesQuery.isSuccess && sharesQuery.data.items.length === 0 && (
                <p className="text-xs text-[var(--fg-3)]">暂无分享记录。</p>
              )}
              {sharesQuery.isSuccess && sharesQuery.data.items.length > 0 && (
                <div className="space-y-3">
                  {sharesQuery.data.items.map((share) => {
                    const url = buildShareUrl(share.token);
                    const isUpdating = updateMutation.isPending || deleteMutation.isPending;
                    return (
                      <div
                        key={share.id}
                        className="rounded border border-[var(--line)] bg-[var(--bg-2)] p-3 text-xs text-[var(--fg-2)]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="break-all font-mono text-[11px] text-[var(--fg)]">{url}</span>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" className="px-2 py-1 text-xs" onClick={() => void handleCopy(url)}>
                              <Copy size={14} /> 复制
                            </Button>
                            <Button
                              variant="outline"
                              className="px-2 py-1 text-xs"
                              onClick={() => void handleUpdate(share.id, null)}
                              disabled={isUpdating}
                            >
                              <Check size={14} /> 永久
                            </Button>
                            <Button
                              variant="outline"
                              className="px-2 py-1 text-xs"
                              onClick={() => void handleUpdate(share.id, 24)}
                              disabled={isUpdating}
                            >
                              <ClockIcon /> +24h
                            </Button>
                            <Button
                              variant="outline"
                              className="px-2 py-1 text-xs"
                              onClick={() => {
                                setEditingShareId(share.id);
                                setEditingHours(24);
                              }}
                              disabled={isUpdating}
                            >
                              调整
                            </Button>
                            <Button
                              variant="outline"
                              className="px-2 py-1 text-xs border-[var(--danger)]/60 text-[var(--danger)] hover:bg-[var(--danger)]/10"
                              onClick={() => void handleDelete(share.id)}
                              disabled={isUpdating}
                            >
                              <Trash2 size={14} /> 取消
                            </Button>
                          </div>
                        </div>
                        {editingShareId === share.id && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--fg-2)]">
                            <span>输入新的有效期（小时）：</span>
                            <Input
                              type="number"
                              min={1}
                              value={editingHours}
                              onChange={(event) => setEditingHours(Number(event.target.value) || 1)}
                              className="w-24"
                            />
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                className="px-2 py-1 text-xs"
                                onClick={() => void handleUpdate(share.id, Math.max(1, Math.round(editingHours)))}
                                disabled={isUpdating}
                              >
                                <Check size={14} /> 确定
                              </Button>
                              <Button
                                variant="outline"
                                className="px-2 py-1 text-xs"
                                onClick={() => setEditingShareId(null)}
                                disabled={isUpdating}
                              >
                                <X size={14} /> 取消
                              </Button>
                            </div>
                          </div>
                        )}
                        <div className="mt-2 flex items-center justify-between text-[var(--fg-3)]">
                          <span>{describeExpiry(share.expires_at)}</span>
                          {share.requires_password && <span>需口令</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {sharesQuery.isError && (
                <div className="text-xs text-[var(--danger)]">加载分享列表失败：{(sharesQuery.error as Error).message}</div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ClockIcon() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
}
