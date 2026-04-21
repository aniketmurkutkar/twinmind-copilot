import { DEFAULT_SETTINGS } from './defaultSettings';

const STORAGE_KEY = 'twinmind-copilot-settings-v1';

export function loadSettings() {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(partial) {
  if (typeof window === 'undefined') return;
  const next = { ...loadSettings(), ...partial };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
