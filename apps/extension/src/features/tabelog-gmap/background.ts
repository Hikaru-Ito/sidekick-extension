import {
  CAPTCHA_COOLDOWN_MS,
  MIN_INTERVAL_MS,
  SCRAPE_TIMEOUT_MS,
  type GmapLookup,
  type MatchConfidence,
} from './types';
import { getCached, isFresh, setCached } from './lib/cache';
import { confidenceFor, similarity } from './lib/match';
import { scrapeGmaps, type ScrapeResult } from './lib/gmaps-scrape';
import { readSettings } from './storage';

export interface LookupMessage {
  type: 'tabelog-gmap:lookup';
  tabelogId: string;
  tabelogUrl: string;
  storeName: string;
  station: string;
}

export interface LookupResponse {
  ok: boolean;
  lookup?: GmapLookup;
  error?: string;
}

/**
 * Single-flight serialiser. Tabelog SPA-style navigation can fire several
 * lookups in quick succession; we coalesce them into a queue and process
 * one hidden tab at a time. This avoids both the per-tab cost of opening
 * Google Maps and the increased CAPTCHA risk from parallel scrapes.
 */
let chain: Promise<void> = Promise.resolve();
let lastScrapeAt = 0;
let captchaPausedUntil = 0;

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const result = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  chain = chain.then(async () => {
    try {
      resolve(await work());
    } catch (err) {
      reject(err);
    }
  });
  return result;
}

async function handleLookup(msg: LookupMessage): Promise<LookupResponse> {
  if (!msg.tabelogId) return { ok: false, error: 'Missing tabelogId' };

  console.log('[tabelog-gmap] handleLookup: reading settings');
  const settings = await readSettings();
  console.log('[tabelog-gmap] handleLookup: settings ok', settings);
  if (!settings.enabled) return { ok: false, error: 'Disabled' };

  console.log('[tabelog-gmap] handleLookup: checking cache');
  const cached = await getCached(msg.tabelogId);
  console.log('[tabelog-gmap] handleLookup: cache result', { hit: !!cached });
  if (cached && isFresh(cached, settings.cacheTtlDays)) {
    return { ok: true, lookup: cached };
  }

  if (Date.now() < captchaPausedUntil) {
    return { ok: false, error: 'paused' };
  }

  console.log('[tabelog-gmap] handleLookup: enqueueing');
  return enqueue(() => performLookup(msg));
}

async function performLookup(msg: LookupMessage): Promise<LookupResponse> {
  console.log('[tabelog-gmap] performLookup begin', { id: msg.tabelogId, store: msg.storeName });

  // Rate-limit between scrapes — avoids Google's bot heuristics tripping.
  const wait = lastScrapeAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) {
    console.log('[tabelog-gmap] rate-limit wait', wait, 'ms');
    await sleep(wait);
  }

  // Re-check the cache inside the queue: another tab may have populated it
  // while we waited for our turn.
  const settings = await readSettings();
  const cached = await getCached(msg.tabelogId);
  if (cached && isFresh(cached, settings.cacheTtlDays)) {
    console.log('[tabelog-gmap] cache hit (post-queue)');
    return { ok: true, lookup: cached };
  }

  let tabId: number | undefined;
  const query = buildQuery(msg.storeName, msg.station);
  const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  console.log('[tabelog-gmap] opening hidden tab', { mapsUrl });

  try {
    const tab = await chrome.tabs.create({ url: mapsUrl, active: false });
    tabId = tab.id;
    console.log('[tabelog-gmap] hidden tab created', { tabId });
    if (tabId === undefined) throw new Error('Failed to open lookup tab');

    console.log('[tabelog-gmap] waiting for tab load…');
    await waitForTabComplete(tabId, SCRAPE_TIMEOUT_MS);
    console.log('[tabelog-gmap] tab loaded — running scrape');

    const [exec] = await chrome.scripting.executeScript({
      target: { tabId },
      func: scrapeGmaps,
      args: [SCRAPE_TIMEOUT_MS - 2000, msg.storeName],
    });
    const scrape = (exec?.result ?? null) as ScrapeResult | null;
    console.log('[tabelog-gmap] scrape result', scrape);

    lastScrapeAt = Date.now();
    const lookup = buildLookup(msg, scrape);

    if (scrape && !scrape.ok && scrape.reason === 'captcha') {
      captchaPausedUntil = Date.now() + CAPTCHA_COOLDOWN_MS;
      console.warn('[tabelog-gmap] CAPTCHA detected — pausing lookups for 30 min');
    } else {
      await setCached(lookup);
    }

    return { ok: true, lookup };
  } catch (err) {
    console.warn('[tabelog-gmap] lookup failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Lookup failed',
    };
  } finally {
    if (tabId !== undefined) {
      console.log('[tabelog-gmap] closing hidden tab', tabId);
      chrome.tabs.remove(tabId).catch(() => {});
    }
  }
}

function buildLookup(msg: LookupMessage, scrape: ScrapeResult | null): GmapLookup {
  const base: GmapLookup = {
    tabelogId: msg.tabelogId,
    tabelogUrl: msg.tabelogUrl,
    tabelogName: msg.storeName,
    station: msg.station,
    confidence: 'unknown',
    similarity: 0,
    fetchedAt: Date.now(),
  };
  if (!scrape) {
    return { ...base, error: 'scrape returned null' };
  }
  if (!scrape.ok) {
    const detail =
      scrape.reason === 'crash'
        ? `crash: ${scrape.message}`
        : scrape.reason === 'no-data' || scrape.reason === 'no-result'
          ? scrape.reason
          : scrape.reason;
    return { ...base, error: detail };
  }
  const sim = scrape.name ? similarity(msg.storeName, scrape.name) : 0;
  const conf: MatchConfidence = scrape.name ? confidenceFor(sim) : 'unknown';
  return {
    ...base,
    matchedName: scrape.name,
    rating: scrape.rating ?? undefined,
    reviewCount: scrape.reviewCount ?? undefined,
    mapsUrl: scrape.mapsUrl,
    similarity: sim,
    confidence: conf,
  };
}

function buildQuery(storeName: string, station: string): string {
  const parts = [storeName, station].filter((s) => s && s.trim().length > 0);
  return parts.join(' ').trim();
}

async function waitForTabComplete(tabId: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  // Initial fast check.
  const initial = await chrome.tabs.get(tabId).catch(() => null);
  if (initial?.status === 'complete') return;

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error('tab load timeout'));
      },
      Math.max(0, deadline - Date.now()),
    );

    const listener = (id: number, info: chrome.tabs.TabChangeInfo) => {
      if (id !== tabId) return;
      if (info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function registerTabelogGmapBackground(): void {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== 'tabelog-gmap:lookup') return false;
    console.log('[tabelog-gmap] message received', { id: (msg as LookupMessage).tabelogId });

    // Hard 30 s timeout: even if the orchestrator deadlocks somewhere, the
    // content script must always get a response so the card surfaces an
    // error instead of spinning indefinitely.
    let done = false;
    const respond = (response: LookupResponse) => {
      if (done) return;
      done = true;
      console.log('[tabelog-gmap] responding to content', response);
      try {
        sendResponse(response);
      } catch (err) {
        // Channel may already be closed if the tab navigated away.
        console.warn('[tabelog-gmap] sendResponse failed', err);
      }
    };
    const timer = setTimeout(() => {
      respond({ ok: false, error: 'background timeout' });
    }, 30_000);

    void handleLookup(msg as LookupMessage)
      .then((r) => {
        clearTimeout(timer);
        respond(r);
      })
      .catch((err) => {
        clearTimeout(timer);
        respond({ ok: false, error: err instanceof Error ? err.message : 'unknown' });
      });
    return true;
  });
}
