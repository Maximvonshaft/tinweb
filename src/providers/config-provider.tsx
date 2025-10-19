import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type AppConfig = {
  API_BASE_URL: string;
  SHARE_BASE_URL: string;
  SHARE_API_BASE_URL: string;
};

const defaultConfig: AppConfig = {
  API_BASE_URL: '/api',
  SHARE_BASE_URL: '/share/',
  SHARE_API_BASE_URL: '/',
};

interface ConfigContextValue {
  config: AppConfig;
}

const ConfigContext = createContext<ConfigContextValue | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/config.json')
      .then(async (res) => {
        if (!res.ok) throw new Error(`加载配置失败: ${res.status}`);
        return (await res.json()) as Partial<AppConfig>;
      })
      .then((value) => {
        if (cancelled) return;
        setConfig({ ...defaultConfig, ...value });
      })
      .catch((err) => {
        console.error('ConfigProvider: 使用默认配置', err);
        if (cancelled) return;
        setError(err.message);
        setConfig(defaultConfig);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--fg)]">
        <div className="space-y-2 text-center">
          <p className="font-mono text-sm tracking-widest text-[var(--fg-2)]">INITIALIZING LINK…</p>
          <p className="text-xs text-[var(--fg-2)]">读取配置中{error ? `（${error}）` : '…'}</p>
        </div>
      </div>
    );
  }

  return <ConfigContext.Provider value={{ config }}>{children}</ConfigContext.Provider>;
}

export function useAppConfig(): AppConfig {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error('useAppConfig 必须在 ConfigProvider 内使用');
  }
  return ctx.config;
}
