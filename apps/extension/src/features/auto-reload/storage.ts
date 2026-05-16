import { featureStorage } from '../../lib/storage';
import {
  DEFAULT_AUTO_RELOAD_CONFIG,
  DEFAULT_INTERVAL_MODE,
  MIN_INTERVAL_SECONDS,
  MAX_INTERVAL_SECONDS,
  type AutoReloadConfig,
  type DayOfWeek,
  type ReloadMode,
  type TabReloadState,
  type TimeOfDay,
} from './types';

const store = featureStorage('auto-reload', 'local');
const KEY = 'config';

function isDayOfWeek(value: unknown): value is DayOfWeek {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6;
}

function sanitizeTimeOfDay(value: unknown): TimeOfDay | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const hour = v.hour;
  const minute = v.minute;
  if (typeof hour !== 'number' || !Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (typeof minute !== 'number' || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    return null;
  }
  return { hour, minute };
}

function sanitizeMode(value: unknown): ReloadMode | null {
  if (!value || typeof value !== 'object') return null;
  const m = value as Record<string, unknown>;
  if (m.kind === 'interval') {
    let seconds = Number(m.intervalSeconds);
    if (!Number.isFinite(seconds)) return null;
    seconds = Math.min(MAX_INTERVAL_SECONDS, Math.max(MIN_INTERVAL_SECONDS, Math.floor(seconds)));
    return { kind: 'interval', intervalSeconds: seconds };
  }
  if (m.kind === 'schedule') {
    const rawDays = Array.isArray(m.daysOfWeek) ? (m.daysOfWeek as unknown[]) : [];
    const rawTimes = Array.isArray(m.times) ? (m.times as unknown[]) : [];
    const daysOfWeek = Array.from(new Set(rawDays.filter(isDayOfWeek) as DayOfWeek[])).sort();
    const times: TimeOfDay[] = [];
    const seen = new Set<string>();
    for (const t of rawTimes) {
      const safe = sanitizeTimeOfDay(t);
      if (!safe) continue;
      const key = `${safe.hour}:${safe.minute}`;
      if (seen.has(key)) continue;
      seen.add(key);
      times.push(safe);
    }
    // An invalid schedule (no days OR no times) cannot run; drop the mode.
    if (daysOfWeek.length === 0 || times.length === 0) return null;
    return { kind: 'schedule', daysOfWeek, times };
  }
  return null;
}

/**
 * Tolerate older configs that only had `intervalSeconds` at the top level
 * and in each tab. New shape uses a `mode` discriminated union. Any malformed
 * entries are dropped so the runtime never sees an invalid schedule.
 */
function migrate(raw: unknown): AutoReloadConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_AUTO_RELOAD_CONFIG;
  const r = raw as Record<string, unknown>;

  const defaultModeFromRaw =
    sanitizeMode(r.defaultMode) ??
    (typeof r.intervalSeconds === 'number'
      ? sanitizeMode({ kind: 'interval', intervalSeconds: r.intervalSeconds })
      : null) ??
    DEFAULT_INTERVAL_MODE;

  const rawTabs = (r.tabs ?? {}) as Record<string, Record<string, unknown>>;
  const tabs: Record<number, TabReloadState> = {};
  for (const [id, t] of Object.entries(rawTabs)) {
    if (!t || typeof t !== 'object') continue;
    const tabId = Number(t.tabId ?? id);
    if (!Number.isFinite(tabId)) continue;
    const mode =
      sanitizeMode(t.mode) ??
      (typeof t.intervalSeconds === 'number'
        ? sanitizeMode({ kind: 'interval', intervalSeconds: t.intervalSeconds })
        : null);
    // Drop tab entries whose mode can't be salvaged — keeping a corrupted
    // entry alive would cause the scheduler to fail every time it runs.
    if (!mode) continue;
    tabs[tabId] = {
      tabId,
      url: typeof t.url === 'string' ? t.url : '',
      title: typeof t.title === 'string' ? t.title : '',
      mode,
      startedAt: typeof t.startedAt === 'number' ? t.startedAt : Date.now(),
      nextReloadAt: typeof t.nextReloadAt === 'number' ? t.nextReloadAt : Date.now(),
    };
  }

  return {
    enabled: Boolean(r.enabled),
    defaultMode: defaultModeFromRaw,
    tabs,
  };
}

export async function readConfig(): Promise<AutoReloadConfig> {
  const raw = await store.get<unknown>(KEY, DEFAULT_AUTO_RELOAD_CONFIG);
  return migrate(raw);
}

export async function writeConfig(config: AutoReloadConfig): Promise<void> {
  await store.set(KEY, config);
}

export async function updateConfig(
  updater: (current: AutoReloadConfig) => AutoReloadConfig,
): Promise<AutoReloadConfig> {
  const current = await readConfig();
  const next = updater(current);
  await writeConfig(next);
  return next;
}

export async function setTabReload(state: TabReloadState): Promise<AutoReloadConfig> {
  return updateConfig((cfg) => ({
    ...cfg,
    enabled: true,
    tabs: { ...cfg.tabs, [state.tabId]: state },
  }));
}

export async function clearTabReload(tabId: number): Promise<AutoReloadConfig> {
  return updateConfig((cfg) => {
    const next = { ...cfg.tabs };
    delete next[tabId];
    return { ...cfg, tabs: next };
  });
}

export function subscribeConfig(handler: (cfg: AutoReloadConfig) => void): () => void {
  return store.onChange<unknown>(KEY, (newValue) => {
    if (newValue !== undefined) handler(migrate(newValue));
  });
}
