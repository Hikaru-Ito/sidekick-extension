import {
  CAPTCHA_COOLDOWN_MS,
  CONFIDENCE_THRESHOLDS,
  MIN_INTERVAL_MS,
  SCRAPE_TIMEOUT_MS,
  type IkyuLookup,
  type MatchConfidence,
  type SourceRating,
} from './types';
import { getCached, isFresh, setCached } from './lib/cache';
import {
  findTabelogUrlOnGoogle,
  scrapeTabelogDetailPage,
  type FindUrlResult,
  type TabelogScrapeResult,
} from './lib/tabelog-scrape';
import {
  scrapeGmaps,
  type ScrapeResult as GmapsScrapeResult,
} from '../tabelog-gmap/lib/gmaps-scrape';
import { similarity } from '../tabelog-gmap/lib/match';
import { readSettings } from './storage';

export interface IkyuLookupMessage {
  type: 'ikyu-ratings:lookup';
  ikyuId: string;
  ikyuUrl: string;
  storeName: string;
  area: string;
}

export interface IkyuLookupResponse {
  ok: boolean;
  lookup?: IkyuLookup;
  error?: string;
}

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

async function handleLookup(msg: IkyuLookupMessage): Promise<IkyuLookupResponse> {
  if (!msg.ikyuId) return { ok: false, error: 'Missing ikyuId' };
  console.log('[ikyu-ratings] handleLookup', { id: msg.ikyuId, store: msg.storeName });

  const settings = await readSettings();
  if (!settings.enabled) return { ok: false, error: 'Disabled' };

  const cached = await getCached(msg.ikyuId);
  if (cached && isFresh(cached, settings.cacheTtlDays)) {
    console.log('[ikyu-ratings] cache hit');
    return { ok: true, lookup: cached };
  }
  if (Date.now() < captchaPausedUntil) {
    return { ok: false, error: 'paused' };
  }

  return enqueue(() => performLookup(msg));
}

async function performLookup(msg: IkyuLookupMessage): Promise<IkyuLookupResponse> {
  console.log('[ikyu-ratings] performLookup begin');
  const query = buildQuery(msg.storeName, msg.area);

  // Tabelog uses a two-step flow: Google search (better relevance than
  // Tabelog's own search) → the detail page (so we get the real numbers,
  // not list-view averages).
  const tabelogResult = await scrapeTabelogViaGoogle(query, msg.storeName);
  if (tabelogResult.captchaDetected) {
    captchaPausedUntil = Date.now() + CAPTCHA_COOLDOWN_MS;
  }

  // Maps is unchanged — single hidden tab, scrape, close.
  const gmaps = await scrapeGmapsRun({
    url: `https://www.google.com/maps/search/${encodeURIComponent(query)}`,
    storeName: msg.storeName,
  });
  if (gmaps.captchaDetected) {
    captchaPausedUntil = Date.now() + CAPTCHA_COOLDOWN_MS;
  }

  const lookup: IkyuLookup = {
    ikyuId: msg.ikyuId,
    ikyuUrl: msg.ikyuUrl,
    ikyuName: msg.storeName,
    area: msg.area,
    tabelog: tabelogResult.rating,
    gmaps: gmaps.rating,
    fetchedAt: Date.now(),
  };
  await setCached(lookup);

  console.log('[ikyu-ratings] performLookup done', {
    tabelog: lookup.tabelog,
    gmaps: lookup.gmaps,
  });
  return { ok: true, lookup };
}

interface ScrapeRunResult {
  rating: SourceRating;
  captchaDetected: boolean;
}

/**
 * Two-step Tabelog flow:
 *   1. Hidden tab → google.com/search?q=...+site:tabelog.com → executeScript
 *      to find the first detail-page link.
 *   2. Same tab → navigate to that detail URL → executeScript to read the
 *      actual rating + review count off the header.
 */
async function scrapeTabelogViaGoogle(query: string, storeName: string): Promise<ScrapeRunResult> {
  await waitForRateLimit();

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `${query} site:tabelog.com`,
  )}`;

  let tabId: number | undefined;
  try {
    console.log('[ikyu-ratings] tabelog step 1: open Google SERP', searchUrl);
    const tab = await chrome.tabs.create({ url: searchUrl, active: false });
    tabId = tab.id;
    if (tabId === undefined) throw new Error('failed to open tab');
    await waitForTabComplete(tabId, SCRAPE_TIMEOUT_MS);

    const [exec1] = await chrome.scripting.executeScript({
      target: { tabId },
      func: findTabelogUrlOnGoogle,
      args: [SCRAPE_TIMEOUT_MS - 2000, storeName],
    });
    const found = (exec1?.result ?? null) as FindUrlResult | null;
    console.log('[ikyu-ratings] tabelog step 1 result', found);
    lastScrapeAt = Date.now();

    if (!found) {
      return {
        rating: emptyRating('tabelog', storeName, 'serp scrape returned null'),
        captchaDetected: false,
      };
    }
    if (!found.ok) {
      return {
        rating: emptyRating('tabelog', storeName, found.reason),
        captchaDetected: found.reason === 'captcha',
      };
    }

    // Step 2: navigate same tab to the detail page and extract the actual
    // rating widget. Keeping it in one tab saves a tabstrip flash + halves
    // the CAPTCHA surface.
    console.log('[ikyu-ratings] tabelog step 2: navigate to', found.url);
    await chrome.tabs.update(tabId, { url: found.url });
    console.log('[ikyu-ratings] tabelog step 2: navigation initiated, waiting for load…');
    // Wait specifically for the tab to settle ON tabelog.com — `tabs.update`
    // returns instantly and the tab can briefly still report `status:
    // "complete"` for the previous Google page before the navigation actually
    // commits, so a generic "wait for complete" can finish too early.
    await waitForTabHostComplete(tabId, 'tabelog.com', SCRAPE_TIMEOUT_MS);
    const tabState = await chrome.tabs.get(tabId).catch(() => null);
    console.log('[ikyu-ratings] tabelog step 2: tab loaded', {
      url: tabState?.url,
      status: tabState?.status,
    });

    const [exec2] = await chrome.scripting.executeScript({
      target: { tabId },
      func: scrapeTabelogDetailPage,
      args: [SCRAPE_TIMEOUT_MS - 2000],
    });
    const detail = (exec2?.result ?? null) as TabelogScrapeResult | null;
    console.log('[ikyu-ratings] tabelog step 2 result', detail);
    lastScrapeAt = Date.now();

    if (!detail) {
      return {
        rating: emptyRating('tabelog', storeName, 'detail scrape returned null'),
        captchaDetected: false,
      };
    }
    if (!detail.ok) {
      return {
        rating: emptyRating('tabelog', storeName, detail.reason),
        captchaDetected: false,
      };
    }

    const sim = detail.name ? similarity(storeName, detail.name) : 0;
    return {
      rating: {
        source: 'tabelog',
        rating: detail.rating ?? undefined,
        reviewCount: detail.reviewCount ?? undefined,
        matchedName: detail.name,
        sourceUrl: detail.tabelogUrl,
        similarity: sim,
        confidence: confidenceFor(sim, detail.name),
      },
      captchaDetected: false,
    };
  } catch (err) {
    console.warn('[ikyu-ratings] tabelog flow failed', err);
    return {
      rating: emptyRating('tabelog', storeName, err instanceof Error ? err.message : 'error'),
      captchaDetected: false,
    };
  } finally {
    if (tabId !== undefined) chrome.tabs.remove(tabId).catch(() => {});
  }
}

/** Single-step Maps scrape (unchanged from before). */
async function scrapeGmapsRun(args: { url: string; storeName: string }): Promise<ScrapeRunResult> {
  await waitForRateLimit();

  let tabId: number | undefined;
  try {
    console.log('[ikyu-ratings] open hidden tab gmaps', args.url);
    const tab = await chrome.tabs.create({ url: args.url, active: false });
    tabId = tab.id;
    if (tabId === undefined) throw new Error('failed to open tab');
    await waitForTabComplete(tabId, SCRAPE_TIMEOUT_MS);

    const [exec] = await chrome.scripting.executeScript({
      target: { tabId },
      func: scrapeGmaps,
      args: [SCRAPE_TIMEOUT_MS - 2000, args.storeName],
    });
    const scrape = (exec?.result ?? null) as GmapsScrapeResult | null;
    lastScrapeAt = Date.now();
    console.log('[ikyu-ratings] gmaps scrape result', scrape);

    if (!scrape) {
      return {
        rating: emptyRating('gmaps', args.storeName, 'scrape returned null'),
        captchaDetected: false,
      };
    }
    if (!scrape.ok) {
      return {
        rating: emptyRating('gmaps', args.storeName, scrape.reason),
        captchaDetected: scrape.reason === 'captcha',
      };
    }
    const sim = scrape.name ? similarity(args.storeName, scrape.name) : 0;
    return {
      rating: {
        source: 'gmaps',
        rating: scrape.rating ?? undefined,
        reviewCount: scrape.reviewCount ?? undefined,
        matchedName: scrape.name,
        sourceUrl: scrape.mapsUrl,
        similarity: sim,
        confidence: confidenceFor(sim, scrape.name),
      },
      captchaDetected: false,
    };
  } catch (err) {
    console.warn('[ikyu-ratings] gmaps flow failed', err);
    return {
      rating: emptyRating('gmaps', args.storeName, err instanceof Error ? err.message : 'error'),
      captchaDetected: false,
    };
  } finally {
    if (tabId !== undefined) chrome.tabs.remove(tabId).catch(() => {});
  }
}

async function waitForRateLimit(): Promise<void> {
  const wait = lastScrapeAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) {
    console.log('[ikyu-ratings] rate-limit wait', wait, 'ms');
    await sleep(wait);
  }
}

function confidenceFor(score: number, name: string | undefined): MatchConfidence {
  if (!name) return 'unknown';
  if (score >= CONFIDENCE_THRESHOLDS.high) return 'high';
  if (score >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
  return 'low';
}

function emptyRating(
  source: SourceRating['source'],
  _storeName: string,
  error: string,
): SourceRating {
  return {
    source,
    similarity: 0,
    confidence: 'unknown',
    error,
  };
}

function buildQuery(storeName: string, area: string): string {
  return [storeName, area]
    .filter((s) => s && s.trim().length > 0)
    .join(' ')
    .trim();
}

async function waitForTabComplete(tabId: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
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

/**
 * Like `waitForTabComplete`, but only resolves when the tab is `complete`
 * AND has landed on a URL whose host contains `hostFragment`. After a
 * `tabs.update` call the previous page can still flash `complete` briefly,
 * so we need to filter on URL.
 */
async function waitForTabHostComplete(
  tabId: number,
  hostFragment: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise<void>((resolve, reject) => {
    const isMatch = (url?: string) =>
      !!url &&
      (() => {
        try {
          return new URL(url).hostname.includes(hostFragment);
        } catch {
          return false;
        }
      })();

    const timer = setTimeout(
      () => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error(`tab load timeout (waiting for ${hostFragment})`));
      },
      Math.max(0, deadline - Date.now()),
    );

    const listener = (id: number, info: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      if (id !== tabId) return;
      if (info.status === 'complete' && isMatch(tab.url)) {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);

    // Poll once in case the tab is already on the target host + complete by
    // the time we register the listener (rare race).
    chrome.tabs
      .get(tabId)
      .then((tab) => {
        if (tab.status === 'complete' && isMatch(tab.url)) {
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      })
      .catch(() => {});
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function registerIkyuRatingsBackground(): void {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== 'ikyu-ratings:lookup') return false;
    console.log('[ikyu-ratings] message received', { id: (msg as IkyuLookupMessage).ikyuId });
    let done = false;
    const respond = (response: IkyuLookupResponse) => {
      if (done) return;
      done = true;
      try {
        sendResponse(response);
      } catch (err) {
        console.warn('[ikyu-ratings] sendResponse failed', err);
      }
    };
    // Two scrapes back-to-back → hard cap at ~45 s, double the single-source
    // limit but still bounded so the content card never spins forever.
    const timer = setTimeout(() => respond({ ok: false, error: 'background timeout' }), 45_000);
    void handleLookup(msg as IkyuLookupMessage)
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
