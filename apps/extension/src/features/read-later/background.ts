import { extractTab } from '../ai-summary/lib/extract';
import { generateKeyPoints, streamOverview, type UsageInfo } from '../ai-summary/lib/anthropic';
import { readSettings as readAiSettings } from '../ai-summary/storage';
import { findByUrl, genId, patchItem, putItem } from './lib/db';
import { buildPendingDelivery, deliverWebhook } from './lib/webhooks';
import { readSettings } from './storage';
import type { ReadLaterItem, WebhookDelivery } from './types';

export interface SaveMessage {
  type: 'read-later:save';
  tabId: number;
  /** User-entered tags (already parsed into array). */
  tags: string[];
  /** When true the background will also run AI summary generation. */
  withSummary: boolean;
}

export interface SaveResponse {
  ok: boolean;
  itemId?: string;
  error?: string;
}

function looksScriptable(url: string | undefined): boolean {
  if (!url) return false;
  return (
    !url.startsWith('chrome://') &&
    !url.startsWith('chrome-extension://') &&
    !url.startsWith('edge://') &&
    !url.startsWith('about:')
  );
}

async function handleSave(msg: SaveMessage): Promise<SaveResponse> {
  // Resolve tab info first so we have title/URL even when extraction fails.
  const tab = await chrome.tabs.get(msg.tabId).catch(() => null);
  if (!tab) return { ok: false, error: 'Tab not found' };
  const tabUrl = tab.url ?? '';
  if (!tabUrl) return { ok: false, error: 'Tab has no URL' };

  // Extract the page body (best effort).
  let pageContent = '';
  let pageDescription = '';
  let extractedTitle = tab.title ?? '';
  if (looksScriptable(tabUrl)) {
    try {
      const page = await extractTab(msg.tabId, tabUrl);
      if (page) {
        pageContent = page.content;
        pageDescription = page.excerpt;
        if (page.title) extractedTitle = page.title;
      }
    } catch (err) {
      console.warn('[read-later] page extract failed', err);
    }
  }

  const hostname = (() => {
    try {
      return new URL(tabUrl).hostname;
    } catch {
      return '';
    }
  })();

  const settings = await readSettings();
  const enabledWebhooks = settings.webhooks.filter((w) => w.enabled);

  // Dedup on URL — update existing, otherwise create.
  const existing = await findByUrl(tabUrl);
  const id = existing?.id ?? genId();
  const now = Date.now();

  // Merge tags (existing + new, deduplicated, preserving order).
  const mergedTags = [...(existing?.tags ?? []), ...msg.tags].filter(
    (t, i, arr) => arr.indexOf(t) === i,
  );

  const baseDeliveries: WebhookDelivery[] = enabledWebhooks.map((w) => buildPendingDelivery(w));

  const item: ReadLaterItem = {
    id,
    url: tabUrl,
    title: extractedTitle || tabUrl,
    favicon: tab.favIconUrl,
    description: pageDescription || existing?.description || '',
    hostname,
    savedAt: now,
    readAt: existing?.readAt ?? null,
    tags: mergedTags,
    notes: existing?.notes ?? '',
    // Drop the prior summary when re-saving so a fresh one can replace it.
    summary: msg.withSummary ? null : (existing?.summary ?? null),
    deliveries: baseDeliveries,
  };

  await putItem(item);

  // Fan out work without blocking the response. Webhook delivery waits for
  // summary completion when both are enabled — that way templates with
  // `{{summary}}` actually have content.
  void runSideEffects(item, msg.withSummary, pageContent).catch((err) => {
    console.warn('[read-later] side effects failed', err);
  });

  return { ok: true, itemId: id };
}

async function runSideEffects(
  baseItem: ReadLaterItem,
  withSummary: boolean,
  pageContent: string,
): Promise<void> {
  // 1. Optional AI summary
  if (withSummary && pageContent.length > 0) {
    try {
      const aiSettings = await readAiSettings();
      if (aiSettings.anthropicApiKey) {
        const usage: UsageInfo[] = [];
        const overview = await streamOverview({
          apiKey: aiSettings.anthropicApiKey,
          model: aiSettings.prefs.defaultModel,
          page: {
            title: baseItem.title,
            url: baseItem.url,
            byline: '',
            siteName: baseItem.hostname,
            excerpt: baseItem.description,
            content: pageContent,
            length: pageContent.length,
            fallback: false,
          },
          length: aiSettings.prefs.length,
          tone: aiSettings.prefs.tone,
          lang: aiSettings.prefs.lang,
          onDelta: () => undefined,
        });
        usage.push(overview.usage);
        const keypoints = await generateKeyPoints({
          apiKey: aiSettings.anthropicApiKey,
          model: aiSettings.prefs.defaultModel,
          page: {
            title: baseItem.title,
            url: baseItem.url,
            byline: '',
            siteName: baseItem.hostname,
            excerpt: baseItem.description,
            content: pageContent,
            length: pageContent.length,
            fallback: false,
          },
          length: aiSettings.prefs.length,
          tone: aiSettings.prefs.tone,
          lang: aiSettings.prefs.lang,
        });
        usage.push(keypoints.usage);
        await patchItem(baseItem.id, {
          summary: {
            overview: overview.text,
            keypoints: keypoints.points,
            model: aiSettings.prefs.defaultModel,
            generatedAt: Date.now(),
          },
        });
      }
    } catch (err) {
      console.warn('[read-later] AI summary failed', err);
    }
  }

  // 2. Webhook delivery — uses the freshest item (with summary if it was
  //    generated above). We reload from IDB to pick that up.
  const settings = await readSettings();
  const webhooks = settings.webhooks.filter((w) => w.enabled);
  if (webhooks.length === 0) return;
  // Re-read so we have the latest summary, deliveries, etc.
  const fresh = await findByUrl(baseItem.url);
  if (!fresh) return;

  const updated: WebhookDelivery[] = [...fresh.deliveries];
  for (const webhook of webhooks) {
    const idx = updated.findIndex((d) => d.webhookId === webhook.id);
    const result = await deliverWebhook(webhook, fresh);
    const delivery: WebhookDelivery = {
      webhookId: webhook.id,
      webhookName: webhook.name,
      provider: webhook.provider,
      status: result.status,
      attemptedAt: Date.now(),
      sentAt: result.status === 'sent' ? Date.now() : undefined,
      error: result.error,
      responseUrl: result.responseUrl,
    };
    if (idx >= 0) updated[idx] = delivery;
    else updated.push(delivery);
    // Write incrementally so the UI can reflect each delivery as it happens.
    await patchItem(fresh.id, { deliveries: updated.slice() });
  }
}

export function registerReadLaterBackground(): void {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== 'read-later:save') return false;
    void handleSave(msg as SaveMessage).then(sendResponse);
    return true; // keep channel open for async response
  });
}
