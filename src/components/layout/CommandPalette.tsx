import { useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Command as CommandIcon, Search, Upload, X } from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (path: string) => void;
  onToggleTheme: () => void;
  onToggleDensity: () => void;
  onOpenTasks: () => void;
  onTriggerUpload: () => void;
  onFocusSearch: () => void;
  density: 'compact' | 'standard';
}

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  action: () => void;
  icon?: ReactNode;
}

export function CommandPalette({
  open,
  onOpenChange,
  onNavigate,
  onToggleTheme,
  onToggleDensity,
  onOpenTasks,
  onTriggerUpload,
  onFocusSearch,
  density,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  const commands = useMemo<CommandItem[]>(
    () => [
      {
        id: 'go-drive',
        label: '前往 Drive',
        description: '切换到文件主界面',
        keywords: ['drive', 'home'],
        action: () => onNavigate('/drive'),
        icon: <CommandIcon size={16} />, 
      },
      {
        id: 'go-recycle',
        label: '前往回收站',
        description: '查看已删除的文件',
        keywords: ['recycle', 'trash'],
        action: () => onNavigate('/recycle'),
      },
      {
        id: 'go-settings',
        label: '打开设置',
        keywords: ['settings', 'config'],
        action: () => onNavigate('/settings'),
      },
      {
        id: 'focus-search',
        label: '聚焦搜索框',
        keywords: ['search', 'find'],
        action: () => {
          onFocusSearch();
        },
        icon: <Search size={16} />,
      },
      {
        id: 'upload',
        label: '上传文件',
        keywords: ['upload'],
        action: () => onTriggerUpload(),
        icon: <Upload size={16} />,
      },
      {
        id: 'tasks',
        label: '打开任务中心',
        keywords: ['tasks', 'queue'],
        action: () => onOpenTasks(),
      },
      {
        id: 'toggle-theme',
        label: '切换主题',
        keywords: ['theme', 'dark', 'light'],
        action: () => onToggleTheme(),
      },
      {
        id: 'toggle-density',
        label: `切换布局密度（当前：${density === 'compact' ? '紧凑' : '标准'}）`,
        keywords: ['density', 'spacing'],
        action: () => onToggleDensity(),
      },
    ],
    [density, onNavigate, onToggleDensity, onToggleTheme, onOpenTasks, onTriggerUpload, onFocusSearch],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return commands;
    }
    const lower = query.toLowerCase();
    return commands.filter((item) => {
      const inLabel = item.label.toLowerCase().includes(lower);
      const inKeywords = item.keywords?.some((keyword) => keyword.toLowerCase().includes(lower));
      return inLabel || inKeywords;
    });
  }, [commands, query]);

  useEffect(() => {
    if (activeIndex >= filtered.length) {
      setActiveIndex(filtered.length - 1 >= 0 ? filtered.length - 1 : 0);
    }
  }, [filtered, activeIndex]);

  const runCommand = (command: CommandItem) => {
    onOpenChange(false);
    setTimeout(() => {
      command.action();
    }, 0);
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === 'Enter' && filtered[activeIndex]) {
      event.preventDefault();
      runCommand(filtered[activeIndex]);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1400] bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[1500] w-[90vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg-2)] shadow-elevated">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
            <Dialog.Title className="font-mono text-sm text-[var(--fg)]">COMMAND PALETTE</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="rounded bg-transparent p-1 text-[var(--fg-2)] hover:text-[var(--fg)]">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>
          <div className="px-4 py-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-2.5 text-[var(--fg-2)]" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onKeyDown}
                className="w-full rounded border border-[var(--line)] bg-[var(--bg)] py-2 pl-9 pr-3 text-sm text-[var(--fg)] outline-none focus:border-[var(--accent)]"
                placeholder="搜索命令或直接按 Enter 执行高亮项"
              />
            </div>
            <div className="mt-4 max-h-[280px] overflow-y-auto">
              {filtered.length === 0 && (
                <div className="rounded border border-dashed border-[var(--line)] px-4 py-6 text-center text-sm text-[var(--fg-2)]">
                  未找到匹配的命令。
                </div>
              )}
              <ul className="space-y-2">
                {filtered.map((command, index) => (
                  <li key={command.id}>
                    <button
                      type="button"
                      onClick={() => runCommand(command)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left text-sm transition ${
                        index === activeIndex
                          ? 'border-[var(--accent)] bg-[rgba(46,107,242,0.12)] text-[var(--accent)]'
                          : 'border-transparent hover:border-[var(--accent)] hover:text-[var(--accent)]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {command.icon}
                        {command.label}
                      </span>
                      {command.description && (
                        <span className="text-xs text-[var(--fg-2)]">{command.description}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
