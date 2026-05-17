import { featureStorage } from '../../lib/storage';
import {
  DEFAULT_LINEAR_DESCRIPTION_TEMPLATE,
  DEFAULT_LINEAR_TITLE_TEMPLATE,
  DEFAULT_PREFS,
  DEFAULT_SETTINGS,
  type ReadLaterPrefs,
  type ReadLaterSettings,
  type WebhookConfig,
  type WebhookProvider,
} from './types';

const store = featureStorage('read-later', 'local');
const SETTINGS_KEY = 'settings';

function sanitizeWebhook(raw: unknown): WebhookConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const w = raw as Partial<WebhookConfig>;
  const provider = w.provider;
  if (
    provider !== 'slack' &&
    provider !== 'linear' &&
    provider !== 'discord' &&
    provider !== 'custom'
  ) {
    return null;
  }
  return {
    id: typeof w.id === 'string' ? w.id : '',
    provider,
    name: typeof w.name === 'string' ? w.name : '',
    enabled: Boolean(w.enabled),
    url: typeof w.url === 'string' ? w.url : '',
    method: w.method === 'PUT' || w.method === 'PATCH' ? w.method : 'POST',
    headers: Array.isArray(w.headers)
      ? w.headers
          .filter((h): h is { key: string; value: string } => !!h && typeof h === 'object')
          .map((h) => ({
            key: typeof h.key === 'string' ? h.key : '',
            value: typeof h.value === 'string' ? h.value : '',
          }))
      : [],
    bodyTemplate: typeof w.bodyTemplate === 'string' ? w.bodyTemplate : '',
    linearApiKey: typeof w.linearApiKey === 'string' ? w.linearApiKey : undefined,
    linearTeam: typeof w.linearTeam === 'string' ? w.linearTeam : undefined,
    createdAt: typeof w.createdAt === 'number' ? w.createdAt : Date.now(),
  };
}

function sanitizeSettings(raw: unknown): ReadLaterSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
  const r = raw as Partial<ReadLaterSettings>;
  const prefs: ReadLaterPrefs = {
    summaryByDefault:
      typeof r.prefs?.summaryByDefault === 'boolean'
        ? r.prefs.summaryByDefault
        : DEFAULT_PREFS.summaryByDefault,
  };
  const webhooks = Array.isArray(r.webhooks)
    ? r.webhooks.map(sanitizeWebhook).filter((w): w is WebhookConfig => !!w && w.id.length > 0)
    : [];
  return { prefs, webhooks };
}

export async function readSettings(): Promise<ReadLaterSettings> {
  const raw = await store.get<unknown>(SETTINGS_KEY, null);
  return sanitizeSettings(raw);
}

export async function writeSettings(settings: ReadLaterSettings): Promise<void> {
  await store.set(SETTINGS_KEY, sanitizeSettings(settings));
}

export async function updateSettings(
  patch: Partial<ReadLaterSettings>,
): Promise<ReadLaterSettings> {
  const current = await readSettings();
  const next: ReadLaterSettings = {
    prefs: { ...current.prefs, ...(patch.prefs ?? {}) },
    webhooks: patch.webhooks ?? current.webhooks,
  };
  await writeSettings(next);
  return next;
}

export function subscribeSettings(handler: (s: ReadLaterSettings) => void): () => void {
  return store.onChange<unknown>(SETTINGS_KEY, (raw) => {
    if (raw === undefined) return;
    handler(sanitizeSettings(raw));
  });
}

export function makeDefaultWebhook(provider: WebhookProvider): WebhookConfig {
  const base = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 10),
    provider,
    enabled: true,
    method: 'POST' as const,
    headers: [],
    createdAt: Date.now(),
  };
  switch (provider) {
    case 'slack':
      return {
        ...base,
        name: 'Slack',
        url: '',
        bodyTemplate: `📚 *{{title}}*
<{{url}}|{{hostname}}>{{#tags}}
{{tags}}{{/tags}}{{#summary}}

{{summary}}{{/summary}}`,
      };
    case 'discord':
      return {
        ...base,
        name: 'Discord',
        url: '',
        bodyTemplate: `📚 **{{title}}**
{{url}}{{#summary}}

{{summary}}{{/summary}}`,
      };
    case 'linear':
      return {
        ...base,
        name: 'Linear',
        url: '',
        linearApiKey: '',
        linearTeam: '',
        bodyTemplate: `${DEFAULT_LINEAR_TITLE_TEMPLATE}\n---\n${DEFAULT_LINEAR_DESCRIPTION_TEMPLATE}`,
      };
    case 'custom':
      return {
        ...base,
        name: 'カスタム',
        url: '',
        headers: [{ key: 'content-type', value: 'application/json' }],
        bodyTemplate: `{
  "title": "{{title}}",
  "url": "{{url}}",
  "tags": "{{tags}}",
  "summary": "{{summary}}"
}`,
      };
  }
}
