import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Command, Layers, ListChecks, Menu, Search, Trash2, Upload, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDriveStore } from '@/stores/drive';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore } from '@/stores/settings';
import { useHealthQuery } from '@/hooks/use-health';
import { useToast } from '@/stores/toast';
import { TaskCenterDrawer } from './TaskCenterDrawer';
import { TaskPollingManager } from './TaskPollingManager';
import { useFileUpload } from '@/hooks/use-file-upload';
import { DirectoryDrawer } from './DirectoryDrawer';
import { CommandPalette } from './CommandPalette';

interface AppShellProps {
  children: ReactNode;
}

const navItems = [
  { path: '/drive', label: 'DRIVE' },
  { path: '/recycle', label: 'RECYCLE' },
  { path: '/settings', label: 'SETTINGS' },
];

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { push } = useToast();
  const { data: health } = useHealthQuery();
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  const disk = useDriveStore((state) => state.disk);
  const setDisk = useDriveStore((state) => state.setDisk);
  const parentId = useDriveStore((state) => state.parentId);
  const search = useDriveStore((state) => state.search);
  const setSearch = useDriveStore((state) => state.setSearch);

  const theme = useSettingsStore((state) => state.theme);
  const toggleTheme = useSettingsStore((state) => state.toggleTheme);
  const density = useSettingsStore((state) => state.density);
  const setDensity = useSettingsStore((state) => state.setDensity);

  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clear);

  const disks = useMemo(() => health?.disks ?? [{ name: 'local', status: 'ok', latency_ms: 0, note: null }], [health]);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const uploadFiles = useFileUpload();

  const onSearchSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const onTriggerUpload = () => {
    uploadInputRef.current?.click();
  };

  const focusSearchInput = () => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const onUploadChange: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }
    try {
      const uploaded = await uploadFiles(files, { disk, parentId });
      push({
        tone: 'success',
        title: 'UPLOAD COMPLETE',
        description: `已上传 ${uploaded.length} 个文件。`,
      });
    } catch (error) {
      push({ tone: 'danger', title: 'FAILED', description: (error as Error).message });
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <aside className="hidden w-64 border-r border-[var(--line)] bg-[var(--bg-2)] p-4 md:flex md:flex-col">
        <div className="mb-6">
          <p className="font-mono text-xs tracking-[0.3em] text-[var(--fg-2)]">FD-CLIENT</p>
          <p className="text-xs text-[var(--fg-2)]">冷战加密 · 极简终端</p>
        </div>
        <div className="space-y-6 overflow-y-auto">
          <section>
            <p className="mb-2 font-mono text-[10px] tracking-[0.3em] text-[var(--fg-2)]">DISKS</p>
            <div className="space-y-2">
              {disks.map((item) => {
                const disabled = item.note === 'read-only';
                return (
                  <button
                    key={item.name}
                    onClick={() => setDisk(item.name)}
                    className={`flex w-full items-center justify-between rounded-[var(--radius)] border border-transparent px-3 py-2 text-left text-sm transition ${
                      disk === item.name ? 'border-[var(--accent)] bg-[rgba(46,107,242,0.12)] text-[var(--accent)]' : 'hover:bg-[var(--hover)]'
                    }`}
                  >
                    <span className="font-mono text-xs uppercase">{item.name}</span>
                    <span className="text-[10px] text-[var(--fg-2)]">
                      {item.status.toUpperCase()} {disabled ? '🔒' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
          <section>
            <p className="mb-2 font-mono text-[10px] tracking-[0.3em] text-[var(--fg-2)]">PINS</p>
            <div className="space-y-2">
              <button className="w-full rounded-[var(--radius)] border border-dashed border-[var(--line)] px-3 py-2 text-left text-xs text-[var(--fg-2)]">
                暂无置顶 · 在 Drive 中长按文件夹可置顶
              </button>
            </div>
          </section>
          <section>
            <p className="mb-2 font-mono text-[10px] tracking-[0.3em] text-[var(--fg-2)]">ACTIONS</p>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" onClick={onTriggerUpload}>
                <Upload size={16} /> 上传
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/recycle')}>
                <Trash2 size={16} /> 回收站
              </Button>
            </div>
          </section>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--bg-2)] px-4 py-3">
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setDirectoryOpen(true)}>
              <Menu size={18} />
            </button>
            <nav className="hidden items-center gap-4 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`text-xs font-medium transition ${
                    location.pathname.startsWith(item.path) ? 'text-[var(--accent)]' : 'text-[var(--fg-2)] hover:text-[var(--fg)]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <form onSubmit={onSearchSubmit} className="relative hidden w-[320px] md:block">
            <Search size={16} className="absolute left-3 top-2.5 text-[var(--fg-2)]" />
            <Input
              ref={searchInputRef}
              name="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="/ 搜索或 > 跳转路径"
              className="pl-9"
            />
          </form>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="hidden md:inline-flex"
              type="button"
              onClick={() => setCommandOpen(true)}
            >
              <Command size={16} />
            </Button>
            <Button variant="ghost" type="button" onClick={toggleTheme}>
              {theme === 'dark' ? '🌙' : '☀️'}
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={() => setDensity(density === 'compact' ? 'standard' : 'compact')}
            >
              <Layers size={16} />
            </Button>
            <Button variant="ghost" type="button" onClick={() => setTaskDrawerOpen(true)}>
              <ListChecks size={16} />
            </Button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button variant="ghost" type="button">
                  <User size={16} />
                  <span className="hidden text-xs md:inline">{user?.username ?? '未登录'}</span>
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content className="z-50 rounded-md border border-[var(--line)] bg-[var(--bg-2)] p-2 shadow-elevated">
                <DropdownMenu.Label className="px-2 py-1 text-xs text-[var(--fg-2)]">SESSION</DropdownMenu.Label>
                <DropdownMenu.Item className="cursor-pointer rounded px-2 py-1 text-sm text-[var(--fg)] focus:bg-[var(--hover)]">
                  角色：{user?.role ?? '—'}
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-2 h-px bg-[var(--line)]" />
                <DropdownMenu.Item
                  className="cursor-pointer rounded px-2 py-1 text-sm text-[var(--danger)] focus:bg-[rgba(255,77,79,0.12)]"
                  onSelect={() => {
                    clearAuth();
                    navigate('/login');
                  }}
                >
                  退出登录
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </div>
        </header>
        <main className="flex-1 overflow-hidden bg-[var(--bg)]">
          <div className="h-full overflow-y-auto px-4 py-4 md:px-6">{children}</div>
        </main>
      </div>
      <DirectoryDrawer open={directoryOpen} onOpenChange={setDirectoryOpen} disks={disks} />
      <TaskCenterDrawer open={taskDrawerOpen} onOpenChange={setTaskDrawerOpen} />
      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onNavigate={(path) => navigate(path)}
        onToggleTheme={toggleTheme}
        onToggleDensity={() => setDensity(density === 'compact' ? 'standard' : 'compact')}
        onOpenTasks={() => setTaskDrawerOpen(true)}
        onTriggerUpload={onTriggerUpload}
        onFocusSearch={focusSearchInput}
        density={density}
      />
      <TaskPollingManager />
      <input ref={uploadInputRef} type="file" multiple className="hidden" onChange={onUploadChange} />
    </div>
  );
}
