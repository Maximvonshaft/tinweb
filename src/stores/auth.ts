import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type UserRole = 'user' | 'admin';

export interface AuthUser {
  username: string;
  role: UserRole;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  remember: boolean;
  setAuth: (payload: { token: string; user: AuthUser; remember: boolean }) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      remember: false,
      setAuth: ({ token, user, remember }) =>
        set(() => ({ accessToken: token, user, remember })),
      clear: () => set({ accessToken: null, user: null, remember: false }),
    }),
    {
      name: 'fd-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) =>
        state.remember
          ? { accessToken: state.accessToken, user: state.user, remember: state.remember }
          : { remember: false },
    },
  ),
);
