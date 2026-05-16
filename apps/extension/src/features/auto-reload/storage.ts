import { featureStorage } from '../../lib/storage';
import {
  DEFAULT_AUTO_RELOAD_CONFIG,
  DEFAULT_INTERVAL_MODE,
  type AutoReloadConfig,
  type ReloadMode,
  type TabReloadState,
} from './types';

const store = featureStorage('auto-reload', 'local');
const KEY = 'config';

/**
 * Tolerate older configs that only had `intervalSeconds` at the top level
 * and in each tab. New shape uses a `mode` discriminated union.
 */
function migrate(raw: unknown): AutoReloadConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_AUTO_RELOAD_CONFIG;
  const r = raw as Record<string, unknown>;
  const defaultMode: ReloadMode =
    r.defaultMode && typeof r.defaultMode === 'object'
      ? (r.defaultMode as ReloadMode)
      : typeof r.intervalSeconds === 'number'
        ? { kind: 'interval', intervalSeconds: r.intervalSeconds as number }
        : DEFAULT_INTERVAL_MODE;

  const rawTabs = (r.tabs ?? {}) as Record<string, Record<string, unknown>>;
  const tabs: Record<number, TabReloadState> = {};
  for (const [id, t] of Object.entries(rawTabs)) {
    if (!t || typeof t !== 'object') continue;
    const mode: ReloadMode =
      t.mode && typeof t.mode === 'object'
        ? (t.mode as ReloadMode)
        : typeof t.intervalSeconds === 'number'
          ? { kind: 'interval', intervalSeconds: t.intervalSeconds as number }
          : defaultMode;
    tabs[Number(id)] = {
      tabId: Number(t.tabId ?? id),
      url: typeof t.url === 'string' ? t.url : '',
      title: typeof t.title === 'string' ? t.title : '',
      mode,
      startedAt: typeof t.startedAt === 'number' ? t.startedAt : Date.now(),
      nextReloadAt: typeof t.nextReloadAt === 'number' ? t.nextReloadAt : Date.now(),
    };
  }

  return {
    enabled: Boolean(r.enabled),
    defaultMode,
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
