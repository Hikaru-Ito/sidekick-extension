import { extractTab } from '../ai-summary/lib/extract';
import { generateKeyPoints, streamOverview, type UsageInfo } from '../ai-summary/lib/anthropic';
import { readSettings as readAiSettings } from '../ai-summary/storage';
import { findByUrl, genId, listItems, patchItem, putItem } from './lib/db';
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
  let coverImage: string | undefined;
  if (looksScriptable(tabUrl)) {
    try {
      const page = await extractTab(msg.tabId, tabUrl);
      if (page) {
        pageContent = page.content;
        pageDescription = page.excerpt;
        if (page.title) extractedTitle = page.title;
        coverImage = page.image;
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
    image: coverImage ?? existing?.image,
  };

  await putItem(item);

  // The SW lifecycle in MV3 is unreliable: long Anthropic streams can be cut
  // mid-flight even with an active fetch, leaving deliveries stuck in
  // "pending". We rely on two mechanisms in tandem:
  //
  //   1. Best-effort: run side effects now while the SW is alive.
  //   2. Safety net: schedule a chrome.alarms retry. Alarms RELIABLY wake the
  //      SW even if it died — recovery on alarm fire picks up any still-
  //      pending deliveries.
  //
  // Either path can succeed; both are idempotent (deliveries flip from
  // pending to sent atomically per webhook).
  scheduleRetryAlarm(msg.withSummary);

  const stop = startKeepAlive();
  void runSideEffects(item, msg.withSummary, pageContent)
    .catch((err) => {
      console.warn('[read-later] side effects failed', err);
    })
    .finally(() => stop());

  return { ok: true, itemId: id };
}

/**
 * Schedule a one-off alarm that wakes the SW and re-runs delivery for any
 * items still in pending state. Alarms are the only documented way to
 * guarantee SW wakeup after termination.
 *
 * Delay tuned to be > expected AI summary duration (~30s without summary,
 * up to ~90s with). If alarms fire too early they just see no pending
 * deliveries and exit cheaply.
 */
function scheduleRetryAlarm(withSummary: boolean): void {
  const delayMinutes = withSummary ? 1.5 : 0.5; // 90s vs 30s
  // create() replaces any existing alarm with the same name — only the
  // most-recent save's deadline is active. That's fine: recovery is
  // unconditional and idempotent over all pending items.
  chrome.alarms.create(RETRY_ALARM, { delayInMinutes: delayMinutes });
}

const RETRY_ALARM = 'read-later:retry';

/**
 * Keeps the MV3 service worker awake by periodically invoking a chrome.* API.
 * Each call resets the SW idle timer. Returns a stop function.
 *
 * Without this, a long Anthropic stream (10–30s) followed by webhook dispatch
 * can be cut short — the SW idles out mid-stream, the fetch is aborted, and
 * the webhook delivery code never runs. The user sees a save with
 * "pending" deliveries that never resolve.
 */
function startKeepAlive(): () => void {
  // First ping immediately so the timer is fresh.
  void chrome.runtime.getPlatformInfo().catch(() => {});
  const id = setInterval(() => {
    void chrome.runtime.getPlatformInfo().catch(() => {});
  }, 20_000);
  return () => clearInterval(id);
}

async function runSideEffects(
  baseItem: ReadLaterItem,
  withSummary: boolean,
  pageContent: string,
): Promise<void> {
  console.log('[read-later] side effects start', {
    id: baseItem.id,
    url: baseItem.url,
    withSummary,
    pageContentChars: pageContent.length,
  });

  // 1. Optional AI summary
  if (withSummary && pageContent.length > 0) {
    try {
      const aiSettings = await readAiSettings();
      if (!aiSettings.anthropicApiKey) {
        console.warn('[read-later] withSummary requested but no Anthropic API key set');
      }
      if (aiSettings.anthropicApiKey) {
        console.log('[read-later] AI summary: streamOverview begin', {
          model: aiSettings.prefs.defaultModel,
        });
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
        console.log('[read-later] AI summary: streamOverview done', {
          chars: overview.text.length,
        });
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
        console.log('[read-later] AI summary: keypoints done', {
          count: keypoints.points.length,
        });
        await patchItem(baseItem.id, {
          summary: {
            overview: overview.text,
            keypoints: keypoints.points,
            model: aiSettings.prefs.defaultModel,
            generatedAt: Date.now(),
          },
        });
        console.log('[read-later] AI summary: written to IDB');
      }
    } catch (err) {
      console.warn('[read-later] AI summary failed', err);
    }
  }

  // 2. Webhook delivery — uses the freshest item (with summary if it was
  //    generated above). We reload from IDB to pick that up.
  const settings = await readSettings();
  const webhooks = settings.webhooks.filter((w) => w.enabled);
  console.log('[read-later] webhook dispatch begin', {
    enabledCount: webhooks.length,
    names: webhooks.map((w) => w.name),
  });
  if (webhooks.length === 0) return;
  // Re-read so we have the latest summary, deliveries, etc.
  const fresh = await findByUrl(baseItem.url);
  if (!fresh) {
    console.warn('[read-later] freshly-saved item not found by URL — aborting webhook dispatch');
    return;
  }

  const updated: WebhookDelivery[] = [...fresh.deliveries];
  for (const webhook of webhooks) {
    const idx = updated.findIndex((d) => d.webhookId === webhook.id);
    const result = await deliverWebhook(webhook, fresh);
    console.log('[read-later] webhook result', {
      name: webhook.name,
      provider: webhook.provider,
      status: result.status,
      error: result.error,
    });
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
  console.log('[read-later] side effects done', { id: baseItem.id });
}

/**
 * Re-dispatch webhook deliveries that were left in "pending" state by a
 * previous SW lifecycle that got cut short (e.g. SW killed mid-AI-stream
 * before reaching the webhook block). Runs on SW boot, on each retry-alarm
 * fire, and after each save (via the in-line side-effects path).
 *
 * Only items saved in the last 24 hours are considered, to avoid flooding
 * webhooks with old saves if a user comes back after a long break.
 *
 * Returns the number of deliveries that *remained* pending after the run
 * (e.g. because the underlying webhook is currently unreachable). The caller
 * uses this to decide whether to reschedule another alarm.
 */
async function recoverPendingDeliveries(): Promise<number> {
  const RECOVERY_WINDOW_MS = 24 * 60 * 60 * 1000;
  const since = Date.now() - RECOVERY_WINDOW_MS;

  let items: ReadLaterItem[];
  try {
    items = await listItems();
  } catch (err) {
    console.warn('[read-later] recovery: list failed', err);
    return 0;
  }

  const stuck = items.filter(
    (it) => it.savedAt >= since && it.deliveries.some((d) => d.status === 'pending'),
  );
  if (stuck.length === 0) return 0;

  console.log('[read-later] recovering pending deliveries', { count: stuck.length });

  const settings = await readSettings();
  const stop = startKeepAlive();
  try {
    for (const item of stuck) {
      const enabledMap = new Map(settings.webhooks.filter((w) => w.enabled).map((w) => [w.id, w]));
      const updated: WebhookDelivery[] = [...item.deliveries];
      for (let i = 0; i < updated.length; i++) {
        const d = updated[i];
        if (!d || d.status !== 'pending') continue;
        const webhook = enabledMap.get(d.webhookId);
        if (!webhook) {
          // Webhook config was removed since save — mark as failed so it
          // doesn't sit in pending forever.
          updated[i] = {
            webhookId: d.webhookId,
            webhookName: d.webhookName,
            provider: d.provider,
            status: 'failed',
            attemptedAt: Date.now(),
            error: 'Webhook removed',
          };
          continue;
        }
        const result = await deliverWebhook(webhook, item);
        console.log('[read-later] recovery webhook result', {
          name: webhook.name,
          status: result.status,
        });
        updated[i] = {
          webhookId: webhook.id,
          webhookName: webhook.name,
          provider: webhook.provider,
          status: result.status,
          attemptedAt: Date.now(),
          sentAt: result.status === 'sent' ? Date.now() : undefined,
          error: result.error,
          responseUrl: result.responseUrl,
        };
        await patchItem(item.id, { deliveries: updated.slice() });
      }
    }
  } finally {
    stop();
  }

  // After best-effort recovery, count how many deliveries are still pending
  // (i.e. items the recovery loop never reached — typically because the SW
  // died mid-pass). Caller may reschedule another alarm in that case.
  let stillPending = 0;
  try {
    const recheck = await listItems();
    for (const it of recheck) {
      if (it.savedAt < since) continue;
      for (const d of it.deliveries) if (d.status === 'pending') stillPending++;
    }
  } catch {
    /* listItems shouldn't throw here, but be defensive. */
  }
  return stillPending;
}

export function registerReadLaterBackground(): void {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== 'read-later:save') return false;
    void handleSave(msg as SaveMessage).then(sendResponse);
    return true; // keep channel open for async response
  });

  // The retry alarm — fires after each save (and recursively reschedules
  // itself while there is still pending work). Alarms wake the SW even
  // after termination, so this is the bulletproof path for delivering
  // webhooks that got skipped due to SW lifecycle issues.
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== RETRY_ALARM) return;
    console.log('[read-later] retry alarm fired');
    void recoverPendingDeliveries()
      .then((stillPending) => {
        // If anything is still pending after recovery (e.g. transient
        // network failure), schedule another retry. Caps out after 24h
        // via the savedAt window inside recoverPendingDeliveries.
        if (stillPending > 0) {
          console.log('[read-later] still pending after retry — rescheduling', { stillPending });
          chrome.alarms.create(RETRY_ALARM, { delayInMinutes: 2 });
        }
      })
      .catch((err) => {
        console.warn('[read-later] retry alarm: recovery failed', err);
      });
  });

  // SW boot — kick recovery for previously-stuck items. We don't await this
  // (the listener registration above must be synchronous), so we just let it
  // run in the background. It opens its own keep-alive while working.
  void recoverPendingDeliveries().catch((err) => {
    console.warn('[read-later] recovery failed', err);
  });
}
