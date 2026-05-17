import { featureStorage } from '../../lib/storage';
import {
  DEFAULT_SETTINGS,
  HISTORY_LIMIT,
  type AISummarySettings,
  type HistoryEntry,
  type SummaryMode,
} from './types';

// API keys must stay on-device — never use `sync` storage.
const store = featureStorage('ai-summary', 'local');

const SETTINGS_KEY = 'settings';
const HISTORY_KEY = 'history';
const INTENT_KEY = 'intent';

/** Hand-off from popup launcher to the side panel. */
export interface LauncherIntent {
  mode: SummaryMode;
  tabId: number;
  autostart: boolean;
  /** Epoch ms — used to expire stale intents (older than 30s). */
  createdAt: number;
}

const INTENT_TTL_MS = 30_000;

export async function readIntent(): Promise<LauncherIntent | null> {
  const raw = await store.get<LauncherIntent | null>(INTENT_KEY, null);
  if (!raw || typeof raw !== 'object') return null;
  if (Date.now() - raw.createdAt > INTENT_TTL_MS) return null;
  return raw;
}

export async function writeIntent(intent: LauncherIntent): Promise<void> {
  await store.set(INTENT_KEY, intent);
}

export async function clearIntent(): Promise<void> {
  await store.remove(INTENT_KEY);
}

export async function readSettings(): Promise<AISummarySettings> {
  const raw = await store.get<Partial<AISummarySettings> | null>(SETTINGS_KEY, null);
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
  return {
    anthropicApiKey:
      typeof raw.anthropicApiKey === 'string' && raw.anthropicApiKey.length > 0
        ? raw.anthropicApiKey
        : null,
    prefs: { ...DEFAULT_SETTINGS.prefs, ...(raw.prefs ?? {}) },
  };
}

export async function writeSettings(settings: AISummarySettings): Promise<void> {
  await store.set(SETTINGS_KEY, settings);
}

export async function updateSettings(
  patch: Partial<AISummarySettings>,
): Promise<AISummarySettings> {
  const current = await readSettings();
  const next: AISummarySettings = {
    ...current,
    ...patch,
    prefs: { ...current.prefs, ...(patch.prefs ?? {}) },
  };
  await writeSettings(next);
  return next;
}

export function subscribeSettings(handler: (s: AISummarySettings) => void): () => void {
  return store.onChange<Partial<AISummarySettings> | null>(SETTINGS_KEY, (raw) => {
    if (!raw) return;
    handler({
      anthropicApiKey:
        typeof raw.anthropicApiKey === 'string' && raw.anthropicApiKey.length > 0
          ? raw.anthropicApiKey
          : null,
      prefs: { ...DEFAULT_SETTINGS.prefs, ...(raw.prefs ?? {}) },
    });
  });
}

export async function readHistory(): Promise<HistoryEntry[]> {
  const raw = await store.get<HistoryEntry[]>(HISTORY_KEY, []);
  return Array.isArray(raw) ? raw : [];
}

export async function appendHistory(entry: HistoryEntry): Promise<HistoryEntry[]> {
  const current = await readHistory();
  // De-duplicate by id (latest wins) and trim to limit.
  const filtered = current.filter((e) => e.id !== entry.id);
  const next = [entry, ...filtered].slice(0, HISTORY_LIMIT);
  await store.set(HISTORY_KEY, next);
  return next;
}

export async function clearHistory(): Promise<void> {
  await store.set(HISTORY_KEY, []);
}

export function subscribeHistory(handler: (h: HistoryEntry[]) => void): () => void {
  return store.onChange<HistoryEntry[]>(HISTORY_KEY, (raw) => {
    if (Array.isArray(raw)) handler(raw);
  });
}
