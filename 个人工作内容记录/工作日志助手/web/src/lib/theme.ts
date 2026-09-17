// 主题（浅色/深色）管理，持久化到 localStorage，默认跟随系统
export type ThemeMode = 'light' | 'dark';

const KEY = 'worklog:theme';

export function getStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {}
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
  root.dataset.theme = mode;
}

export function setTheme(mode: ThemeMode) {
  try { localStorage.setItem(KEY, mode); } catch {}
  applyTheme(mode);
}

export function toggleTheme(): ThemeMode {
  const next: ThemeMode = getStoredTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

// 应用启动时尽早调用
export function initTheme() {
  applyTheme(getStoredTheme());
}
