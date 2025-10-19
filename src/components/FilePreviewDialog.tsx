import * as Dialog from '@radix-ui/react-dialog';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FilePreviewData } from '@/types/api';

interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data?: FilePreviewData;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

export function FilePreviewDialog({ open, onOpenChange, data, isLoading, error, onRetry }: FilePreviewDialogProps) {
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--fg-2)]">
          <Loader2 className="animate-spin" size={16} /> 载入预览中…
        </div>
      );
    }
    if (error) {
      return (
        <div className="space-y-3 text-sm text-[var(--fg-2)]">
          <p>预览失败：{error.message}</p>
          {onRetry && (
            <Button variant="outline" onClick={onRetry}>
              重试
            </Button>
          )}
        </div>
      );
    }
    if (!data) {
      return <p className="text-sm text-[var(--fg-2)]">选择文件以查看预览。</p>;
    }
    if (data.kind === 'text') {
      return (
        <pre className="max-h-[60vh] overflow-auto rounded bg-[var(--bg)] p-4 text-xs text-[var(--fg)]">
          {data.content ?? ''}
        </pre>
      );
    }
    if (data.kind === 'image') {
      return (
        <div className="flex max-h-[60vh] items-center justify-center overflow-auto">
          <img src={data.dataUrl} alt={data.name} className="max-h-[60vh] max-w-full rounded" />
        </div>
      );
    }
    return (
      <div className="space-y-3 text-sm text-[var(--fg-2)]">
        <p>文件类型 {data.mime} 暂不支持在线预览。</p>
        <a href={data.downloadPath} target="_blank" rel="noreferrer">
          <Button>在新窗口打开</Button>
        </a>
      </div>
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1200] bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[1300] w-[90vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg-2)] p-6 shadow-elevated focus:outline-none">
          <div className="flex items-center justify-between">
            <div>
              <Dialog.Title className="font-mono text-sm text-[var(--fg)]">
                {data?.name ?? '文件预览'}
              </Dialog.Title>
              {data && (
                <p className="text-xs text-[var(--fg-2)]">
                  {data.mime} · {Math.round(data.size / 1024)} KB
                </p>
              )}
            </div>
            <Dialog.Close asChild>
              <button type="button" className="rounded bg-transparent p-1 text-[var(--fg-2)] hover:text-[var(--fg)]">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>
          <div className="mt-4">{renderContent()}</div>
          {data && (
            <div className="mt-4 flex items-center justify-between text-xs text-[var(--fg-2)]">
              <span>哈希：{data.hash ?? '—'}</span>
              <a href={data.downloadPath} target="_blank" rel="noreferrer" className="text-[var(--accent)]">
                打开原文件
              </a>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
