import { featureStorage } from '../../lib/storage';
import { DEFAULT_AUTO_RELOAD_CONFIG, type AutoReloadConfig, type TabReloadState } from './types';

const store = featureStorage('auto-reload', 'local');
const KEY = 'config';

export async function readConfig(): Promise<AutoReloadConfig> {
  return store.get<AutoReloadConfig>(KEY, DEFAULT_AUTO_RELOAD_CONFIG);
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
  return store.onChange<AutoReloadConfig>(KEY, (newValue) => {
    if (newValue) handler(newValue);
  });
}
