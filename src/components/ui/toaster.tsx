import { useEffect } from 'react';
import { useToastStore } from '@/stores/toast';

const toneStyles: Record<string, string> = {
  neutral: 'border-[var(--line)] bg-[var(--bg-2)] text-[var(--fg)]',
  success: 'border-[var(--success)] text-[var(--fg)]',
  warn: 'border-[var(--warn)] text-[var(--fg)]',
  danger: 'border-[var(--danger)] text-[var(--fg)]',
};

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  useEffect(() => {
    const timers = toasts.map((toast) => {
      const duration = toast.duration ?? 3200;
      return setTimeout(() => dismiss(toast.id), duration);
    });
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [toasts, dismiss]);

  return (
    <div className="pointer-events-none fixed right-6 top-6 z-[1000] flex w-80 flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded border px-4 py-3 shadow-elevated transition-all ${toneStyles[toast.tone] ?? toneStyles.neutral}`}
        >
          {toast.title && <p className="font-mono text-xs tracking-widest text-[var(--fg)]">{toast.title}</p>}
          {toast.description && <p className="mt-1 text-sm text-[var(--fg-2)]">{toast.description}</p>}
        </div>
      ))}
    </div>
  );
}
