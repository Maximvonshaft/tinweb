import { useEffect, type ReactNode } from 'react';
import { useSettingsStore } from '@/stores/settings';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSettingsStore((state) => state.theme);
  const density = useSettingsStore((state) => state.density);

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.body.dataset.density = density;
  }, [density]);

  return <>{children}</>;
}
