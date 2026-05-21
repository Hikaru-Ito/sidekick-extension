import { featureStorage } from '../../lib/storage';
import { DEFAULT_SETTINGS, type IkyuRatingsSettings } from './types';

const store = featureStorage('ikyu-ratings', 'local');
const SETTINGS_KEY = 'settings';

function sanitize(raw: unknown): IkyuRatingsSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
  const r = raw as Partial<IkyuRatingsSettings>;
  const ttl =
    typeof r.cacheTtlDays === 'number' && r.cacheTtlDays > 0 && r.cacheTtlDays <= 365
      ? r.cacheTtlDays
      : DEFAULT_SETTINGS.cacheTtlDays;
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : DEFAULT_SETTINGS.enabled,
    cacheTtlDays: ttl,
    showFallbackLink:
      typeof r.showFallbackLink === 'boolean'
        ? r.showFallbackLink
        : DEFAULT_SETTINGS.showFallbackLink,
  };
}

export async function readSettings(): Promise<IkyuRatingsSettings> {
  return sanitize(await store.get<unknown>(SETTINGS_KEY, null));
}

export async function writeSettings(
  patch: Partial<IkyuRatingsSettings>,
): Promise<IkyuRatingsSettings> {
  const current = await readSettings();
  const next: IkyuRatingsSettings = sanitize({ ...current, ...patch });
  await store.set(SETTINGS_KEY, next);
  return next;
}

export function subscribeSettings(handler: (s: IkyuRatingsSettings) => void): () => void {
  return store.onChange<unknown>(SETTINGS_KEY, (raw) => {
    if (raw === undefined) return;
    handler(sanitize(raw));
  });
}
