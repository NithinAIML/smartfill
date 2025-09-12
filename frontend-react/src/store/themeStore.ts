import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (isDark: boolean) => void;
  initializeTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      isDark: false,
      
      toggleTheme: () => {
        set((state) => ({ isDark: !state.isDark }));
      },
      
      setTheme: (isDark: boolean) => {
        set({ isDark });
      },
      
      initializeTheme: () => {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const stored = get().isDark;
        
        // If no stored preference, use system preference
        if (stored === undefined) {
          set({ isDark: prefersDark });
        }
      },
    }),
    {
      name: 'theme-storage',
    }
  )
);
