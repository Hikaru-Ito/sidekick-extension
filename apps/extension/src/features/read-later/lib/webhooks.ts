import {
  type ReadLaterItem,
  type WebhookConfig,
  type WebhookDelivery,
  type WebhookDeliveryStatus,
} from '../types';
import { buildContext, renderJsonTemplate, renderTemplate } from './templates';

interface DeliveryResult {
  status: WebhookDeliveryStatus;
  error?: string;
  responseUrl?: string;
}

export async function deliverWebhook(
  webhook: WebhookConfig,
  item: ReadLaterItem,
): Promise<DeliveryResult> {
  if (!webhook.enabled) {
    return { status: 'skipped' };
  }
  try {
    switch (webhook.provider) {
      case 'slack':
        return await deliverSlack(webhook, item);
      case 'discord':
        return await deliverDiscord(webhook, item);
      case 'linear':
        return await deliverLinear(webhook, item);
      case 'custom':
        return await deliverCustom(webhook, item);
    }
  } catch (err) {
    return {
      status: 'failed',
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

async function deliverSlack(webhook: WebhookConfig, item: ReadLaterItem): Promise<DeliveryResult> {
  const ctx = buildContext(item);
  const text = renderTemplate(webhook.bodyTemplate, ctx);
  const res = await fetch(webhook.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const errText = await safeText(res);
    return { status: 'failed', error: `${res.status} ${errText.slice(0, 120)}` };
  }
  return { status: 'sent' };
}

async function deliverDiscord(
  webhook: WebhookConfig,
  item: ReadLaterItem,
): Promise<DeliveryResult> {
  const ctx = buildContext(item);
  const content = renderTemplate(webhook.bodyTemplate, ctx);
  const res = await fetch(webhook.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const errText = await safeText(res);
    return { status: 'failed', error: `${res.status} ${errText.slice(0, 120)}` };
  }
  return { status: 'sent' };
}

async function deliverLinear(webhook: WebhookConfig, item: ReadLaterItem): Promise<DeliveryResult> {
  if (!webhook.linearApiKey) {
    return { status: 'failed', error: 'API key not configured' };
  }
  if (!webhook.linearTeam) {
    return { status: 'failed', error: 'Team key/UUID not configured' };
  }
  const ctx = buildContext(item);
  // The default template fields are stored in `bodyTemplate` (description)
  // and a side channel for the title. To keep the schema small we lay both
  // out in `bodyTemplate` separated by a sentinel.
  // Format: <title-template>\n---\n<description-template>
  const [titleTpl, descTpl] = splitTitleDescription(webhook.bodyTemplate);
  const title = renderTemplate(titleTpl, ctx);
  const description = renderTemplate(descTpl, ctx);

  const teamLookup = await resolveLinearTeamId(webhook.linearApiKey, webhook.linearTeam);
  if ('error' in teamLookup) return { status: 'failed', error: teamLookup.error };

  const mutation = `mutation IssueCreate($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue { id url }
    }
  }`;
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: webhook.linearApiKey,
    },
    body: JSON.stringify({
      query: mutation,
      variables: { input: { teamId: teamLookup.teamId, title, description } },
    }),
  });
  if (!res.ok) {
    const errText = await safeText(res);
    return { status: 'failed', error: `${res.status} ${errText.slice(0, 120)}` };
  }
  const json = (await res.json()) as {
    data?: { issueCreate?: { success: boolean; issue?: { id: string; url: string } } };
    errors?: { message: string }[];
  };
  if (json.errors?.length) {
    return { status: 'failed', error: json.errors[0]!.message };
  }
  const issue = json.data?.issueCreate?.issue;
  return {
    status: 'sent',
    responseUrl: issue?.url,
  };
}

async function deliverCustom(webhook: WebhookConfig, item: ReadLaterItem): Promise<DeliveryResult> {
  if (!webhook.url) {
    return { status: 'failed', error: 'URL not configured' };
  }
  const ctx = buildContext(item);
  // Best-effort: detect JSON content-type and use JSON-escaped rendering.
  const ct = webhook.headers.find((h) => h.key.toLowerCase() === 'content-type')?.value;
  const isJson = ct ? ct.includes('json') : webhook.bodyTemplate.trim().startsWith('{');
  const body = isJson
    ? renderJsonTemplate(webhook.bodyTemplate, ctx)
    : renderTemplate(webhook.bodyTemplate, ctx);
  const headers: Record<string, string> = {};
  for (const h of webhook.headers) {
    if (h.key.trim().length > 0) headers[h.key] = h.value;
  }
  if (!('content-type' in Object.keys(headers).map((k) => k.toLowerCase()))) {
    headers['content-type'] = isJson ? 'application/json' : 'text/plain';
  }
  const res = await fetch(webhook.url, {
    method: webhook.method ?? 'POST',
    headers,
    body,
  });
  if (!res.ok) {
    const errText = await safeText(res);
    return { status: 'failed', error: `${res.status} ${errText.slice(0, 120)}` };
  }
  return { status: 'sent' };
}

/** Split a Linear template into title and description parts, separated by `\n---\n`. */
function splitTitleDescription(template: string): [string, string] {
  const sep = template.indexOf('\n---\n');
  if (sep === -1) {
    return [template, ''];
  }
  return [template.slice(0, sep), template.slice(sep + 5)];
}

/**
 * Resolves a Linear team key (e.g. "ENG") to a team UUID, or returns the UUID
 * directly if the user already typed one.
 */
async function resolveLinearTeamId(
  apiKey: string,
  teamRef: string,
): Promise<{ teamId: string } | { error: string }> {
  // UUIDs look like 8-4-4-4-12 hex chars.
  if (/^[0-9a-f-]{36}$/i.test(teamRef)) {
    return { teamId: teamRef };
  }
  const query = `query Team($key: String!) {
    teams(filter: { key: { eq: $key } }, first: 1) {
      nodes { id key name }
    }
  }`;
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: apiKey },
    body: JSON.stringify({ query, variables: { key: teamRef } }),
  });
  if (!res.ok) {
    return { error: `Failed to resolve Linear team (${res.status})` };
  }
  const json = (await res.json()) as {
    data?: { teams?: { nodes: { id: string }[] } };
    errors?: { message: string }[];
  };
  if (json.errors?.length) {
    return { error: json.errors[0]!.message };
  }
  const node = json.data?.teams?.nodes[0];
  if (!node) {
    return { error: `Linear team "${teamRef}" not found` };
  }
  return { teamId: node.id };
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

export function buildPendingDelivery(webhook: WebhookConfig): WebhookDelivery {
  return {
    webhookId: webhook.id,
    webhookName: webhook.name,
    provider: webhook.provider,
    status: 'pending',
    attemptedAt: Date.now(),
  };
}
