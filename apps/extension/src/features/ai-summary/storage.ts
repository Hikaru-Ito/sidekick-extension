import { featureStorage } from '../../lib/storage';
import {
  ANTHROPIC_MODELS,
  DEFAULT_SETTINGS,
  HISTORY_LIMIT,
  type AISummarySettings,
  type AnthropicModelId,
  type HistoryEntry,
  type Lang,
  type Length,
  type SidePanelTab,
  type Tone,
  type UserPreferences,
} from './types';

// API keys must stay on-device — never use `sync` storage.
const store = featureStorage('ai-summary', 'local');

const SETTINGS_KEY = 'settings';
const HISTORY_KEY = 'history';
const INTENT_KEY = 'intent';

/** Hand-off from popup launcher to the side panel. */
export interface LauncherIntent {
  /** Which UI tab to land on. `summary` auto-fires overview + keypoints. */
  tab: SidePanelTab;
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

// Whitelist sets used to normalize legacy values that may still live in
// storage from previous extension versions (e.g. a Haiku 4.5 model that no
// longer exists in our type union, or a stray 'overview' from before we
// merged it into the summary tab).
const VALID_MODELS = new Set<AnthropicModelId>(ANTHROPIC_MODELS.map((m) => m.id));
const VALID_LENGTHS = new Set<Length>(['short', 'standard', 'detailed']);
const VALID_TONES = new Set<Tone>(['casual', 'neutral', 'formal']);
const VALID_LANGS = new Set<Lang>(['ja', 'en']);

function sanitizePrefs(raw: unknown): UserPreferences {
  const fallback = DEFAULT_SETTINGS.prefs;
  if (!raw || typeof raw !== 'object') return fallback;
  const p = raw as Partial<UserPreferences>;
  const model: AnthropicModelId =
    typeof p.defaultModel === 'string' && VALID_MODELS.has(p.defaultModel as AnthropicModelId)
      ? (p.defaultModel as AnthropicModelId)
      : fallback.defaultModel;
  const length: Length =
    typeof p.length === 'string' && VALID_LENGTHS.has(p.length as Length)
      ? (p.length as Length)
      : fallback.length;
  const tone: Tone =
    typeof p.tone === 'string' && VALID_TONES.has(p.tone as Tone)
      ? (p.tone as Tone)
      : fallback.tone;
  const lang: Lang =
    typeof p.lang === 'string' && VALID_LANGS.has(p.lang as Lang)
      ? (p.lang as Lang)
      : fallback.lang;
  return { defaultModel: model, length, tone, lang };
}

function sanitizeSettings(raw: unknown): AISummarySettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
  const r = raw as Partial<AISummarySettings>;
  return {
    anthropicApiKey:
      typeof r.anthropicApiKey === 'string' && r.anthropicApiKey.length > 0
        ? r.anthropicApiKey
        : null,
    prefs: sanitizePrefs(r.prefs),
  };
}

export async function readSettings(): Promise<AISummarySettings> {
  const raw = await store.get<unknown>(SETTINGS_KEY, null);
  const settings = sanitizeSettings(raw);
  // Heal stale persisted values (e.g. a Haiku model we no longer ship).
  // `JSON.stringify` is fine here since the shape is plain JSON.
  if (raw && JSON.stringify(raw) !== JSON.stringify(settings)) {
    await store.set(SETTINGS_KEY, settings);
  }
  return settings;
}

export async function writeSettings(settings: AISummarySettings): Promise<void> {
  await store.set(SETTINGS_KEY, sanitizeSettings(settings));
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
  const safe = sanitizeSettings(next);
  await store.set(SETTINGS_KEY, safe);
  return safe;
}

export function subscribeSettings(handler: (s: AISummarySettings) => void): () => void {
  return store.onChange<unknown>(SETTINGS_KEY, (raw) => {
    if (raw === undefined) return;
    handler(sanitizeSettings(raw));
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
