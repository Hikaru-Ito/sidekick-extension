import type { KeyPoint } from '../ai-summary/types';

export interface ReadLaterItem {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  description: string;
  /** Hostname extracted from URL — cached so the list can render without parsing every row. */
  hostname: string;
  savedAt: number;
  readAt: number | null;
  tags: string[];
  notes: string;
  summary: ReadLaterSummary | null;
  deliveries: WebhookDelivery[];
}

export interface ReadLaterSummary {
  /** Markdown overview. */
  overview: string;
  keypoints: KeyPoint[];
  model: string;
  generatedAt: number;
}

export type WebhookProvider = 'slack' | 'linear' | 'discord' | 'custom';

export interface WebhookConfig {
  id: string;
  provider: WebhookProvider;
  /** Display name shown in lists / delivery badges. */
  name: string;
  enabled: boolean;
  /** Slack / Discord / custom: target URL. Empty for Linear (uses fixed endpoint). */
  url: string;
  /** Custom: HTTP method (defaults to POST). */
  method: 'POST' | 'PUT' | 'PATCH';
  /** Custom: extra headers. */
  headers: { key: string; value: string }[];
  /** Slack / Discord / custom: body template (mustache-style `{{var}}`). */
  bodyTemplate: string;
  /** Linear-only: API key. */
  linearApiKey?: string;
  /** Linear-only: team key (e.g. "ENG") or team UUID. */
  linearTeam?: string;
  /** Created-at timestamp. */
  createdAt: number;
}

export type WebhookDeliveryStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface WebhookDelivery {
  webhookId: string;
  webhookName: string;
  provider: WebhookProvider;
  status: WebhookDeliveryStatus;
  attemptedAt: number;
  sentAt?: number;
  error?: string;
  /** For Linear: the URL of the created issue. For Slack: response_url if any. */
  responseUrl?: string;
}

export interface ReadLaterPrefs {
  /** Default state of the "create AI summary too" checkbox. */
  summaryByDefault: boolean;
}

export const DEFAULT_PREFS: ReadLaterPrefs = {
  summaryByDefault: false,
};

export interface ReadLaterSettings {
  prefs: ReadLaterPrefs;
  webhooks: WebhookConfig[];
}

export const DEFAULT_SETTINGS: ReadLaterSettings = {
  prefs: DEFAULT_PREFS,
  webhooks: [],
};

export const WEBHOOK_PROVIDER_LABEL: Record<WebhookProvider, string> = {
  slack: 'Slack',
  linear: 'Linear',
  discord: 'Discord',
  custom: 'カスタム',
};

export const DEFAULT_SLACK_TEMPLATE = `📚 *{{title}}*
<{{url}}|{{hostname}}>{{#tags}}
{{tags}}{{/tags}}{{#summary}}

{{summary}}{{/summary}}`;

export const DEFAULT_DISCORD_TEMPLATE = `📚 **{{title}}**
{{url}}{{#summary}}

{{summary}}{{/summary}}`;

export const DEFAULT_CUSTOM_TEMPLATE = `{
  "title": "{{title}}",
  "url": "{{url}}",
  "tags": "{{tags}}",
  "summary": "{{summary}}"
}`;

export const DEFAULT_LINEAR_TITLE_TEMPLATE = `📚 {{title}}`;
export const DEFAULT_LINEAR_DESCRIPTION_TEMPLATE = `[{{title}}]({{url}})

Saved from {{hostname}} on {{savedAt}}.{{#tags}}

Tags: {{tags}}{{/tags}}{{#summary}}

---

{{summary}}{{/summary}}`;
