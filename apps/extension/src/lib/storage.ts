/**
 * Thin promise wrapper around `chrome.storage` (sync or local).
 * Each feature accesses storage through a namespaced accessor (e.g. `auto-reload:config`).
 */

type StorageArea = 'sync' | 'local';

function getArea(area: StorageArea) {
  return chrome.storage[area];
}

export async function getValue<T>(
  key: string,
  fallback: T,
  area: StorageArea = 'sync',
): Promise<T> {
  const result = await getArea(area).get(key);
  return (result[key] as T | undefined) ?? fallback;
}

export async function setValue<T>(
  key: string,
  value: T,
  area: StorageArea = 'sync',
): Promise<void> {
  await getArea(area).set({ [key]: value });
}

export async function removeValue(key: string, area: StorageArea = 'sync'): Promise<void> {
  await getArea(area).remove(key);
}

export function onChange<T>(
  key: string,
  handler: (newValue: T | undefined, oldValue: T | undefined) => void,
  area: StorageArea = 'sync',
): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    changedArea: chrome.storage.AreaName,
  ) => {
    if (changedArea !== area) return;
    const change = changes[key];
    if (!change) return;
    handler(change.newValue as T | undefined, change.oldValue as T | undefined);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/** Returns a namespaced accessor scoped to a single feature id. */
export function featureStorage(featureId: string, area: StorageArea = 'sync') {
  const key = (suffix: string) => `feature:${featureId}:${suffix}`;
  return {
    get: <T>(suffix: string, fallback: T) => getValue<T>(key(suffix), fallback, area),
    set: <T>(suffix: string, value: T) => setValue<T>(key(suffix), value, area),
    remove: (suffix: string) => removeValue(key(suffix), area),
    onChange: <T>(
      suffix: string,
      handler: (newValue: T | undefined, oldValue: T | undefined) => void,
    ) => onChange<T>(key(suffix), handler, area),
  };
}
