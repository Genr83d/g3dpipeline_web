import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type TextSize = 'small' | 'medium' | 'large';

export interface Appearance {
  theme: ThemeMode;
  highContrast: boolean;
  reduceMotion: boolean;
  textSize: TextSize;
}

interface AppearanceState extends Appearance {
  /** Resolved dark flag after applying `system`. */
  isDark: boolean;
  /** True if the user set reduce-motion here or at the OS level. */
  motionReduced: boolean;
  set: (patch: Partial<Appearance>) => void;
}

const STORAGE_KEY = 'genr8:appearance';

const defaults: Appearance = {
  theme: 'system',
  highContrast: false,
  reduceMotion: false,
  textSize: 'medium',
};

function load(): Appearance {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}

const AppearanceContext = createContext<AppearanceState>({
  ...defaults,
  isDark: false,
  motionReduced: false,
  set: () => {},
});

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>(load);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const [systemReduced, setSystemReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const dark = window.matchMedia('(prefers-color-scheme: dark)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onDark = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    const onMotion = (e: MediaQueryListEvent) => setSystemReduced(e.matches);
    dark.addEventListener('change', onDark);
    motion.addEventListener('change', onMotion);
    return () => {
      dark.removeEventListener('change', onDark);
      motion.removeEventListener('change', onMotion);
    };
  }, []);

  const isDark = appearance.theme === 'system' ? systemDark : appearance.theme === 'dark';
  const motionReduced = appearance.reduceMotion || systemReduced;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
  }, [appearance]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    root.classList.toggle('hc', appearance.highContrast);
    root.dataset.textSize = appearance.textSize;
  }, [isDark, appearance.highContrast, appearance.textSize]);

  const value = useMemo<AppearanceState>(
    () => ({
      ...appearance,
      isDark,
      motionReduced,
      set: (patch) => setAppearance((prev) => ({ ...prev, ...patch })),
    }),
    [appearance, isDark, motionReduced],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppearance(): AppearanceState {
  return useContext(AppearanceContext);
}
