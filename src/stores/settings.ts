import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'dark' | 'light';
export type DensityMode = 'compact' | 'standard';

interface SettingsState {
  theme: ThemeMode;
  density: DensityMode;
  locale: 'zh-CN' | 'en-US';
  setTheme: (theme: ThemeMode) => void;
  setDensity: (density: DensityMode) => void;
  toggleTheme: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      density: 'compact',
      locale: 'zh-CN',
      setTheme: (theme) => set({ theme }),
      setDensity: (density) => set({ density }),
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
    }),
    {
      name: 'fd-settings',
      partialize: (state) => ({ theme: state.theme, density: state.density, locale: state.locale }),
    },
  ),
);
