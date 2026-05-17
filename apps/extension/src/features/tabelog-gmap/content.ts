/**
 * Content-script mount for the Tabelog Google Maps card.
 *
 * Lifecycle:
 *  - On script init: if this is a store-detail page, mount the shadow-root UI.
 *  - Watches for SPA-style URL changes (Tabelog's pjax-ish nav) and remounts
 *    onto the new page when relevant.
 */

import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { RatingCard, RATING_CARD_CSS } from './components/RatingCard';
import { extractPageInfo, isStoreDetailUrl, type TabelogPageInfo } from './lib/tabelog-extract';
import { readSettings, subscribeSettings } from './storage';
import type { GmapLookup } from './types';
import type { LookupMessage, LookupResponse } from './background';

const HOST_ID = 'sidekick-tabelog-gmap-host';
const LOG = '[tabelog-gmap]';

interface Mount {
  host: HTMLElement;
  root: Root;
  tabelogId: string;
}

let current: Mount | null = null;

export async function mountTabelogGmap(): Promise<void> {
  console.log(`${LOG} content script init`, {
    url: location.href,
    readyState: document.readyState,
  });
  const settings = await readSettings();
  console.log(`${LOG} settings`, settings);
  if (!settings.enabled) {
    console.log(`${LOG} disabled in settings — skipping`);
    return;
  }

  // Initial mount + URL-change watcher.
  void ensureMounted();
  watchUrlChanges(() => {
    console.log(`${LOG} URL change detected`);
    void ensureMounted();
  });

  subscribeSettings((s) => {
    if (!s.enabled) {
      teardown();
    } else {
      void ensureMounted();
    }
  });
}

async function ensureMounted(): Promise<void> {
  if (!isStoreDetailUrl(location.href)) {
    console.log(`${LOG} URL is not a store-detail page — skipping`, location.href);
    teardown();
    return;
  }

  console.log(`${LOG} waiting for store header to render…`);
  const info = await waitForPageInfo(8000);
  if (!info) {
    console.warn(`${LOG} could not extract page info within timeout`);
    teardown();
    return;
  }
  console.log(`${LOG} extracted`, {
    storeName: info.storeName,
    station: info.station,
    tabelogId: info.tabelogId,
    anchorTag: info.anchor?.tagName,
    anchorClass: info.anchor?.className,
  });
  if (!info.anchor) {
    console.warn(`${LOG} no anchor element found on page — DOM may have changed`);
    teardown();
    return;
  }

  if (current && current.tabelogId === info.tabelogId && document.contains(current.host)) {
    console.log(`${LOG} already mounted for this restaurant`);
    return;
  }

  teardown();
  current = mountHost(info);
  console.log(`${LOG} mounted card host`, current.host);
  renderState({ kind: 'loading' });

  try {
    const message: LookupMessage = {
      type: 'tabelog-gmap:lookup',
      tabelogId: info.tabelogId,
      tabelogUrl: info.tabelogUrl,
      storeName: info.storeName,
      station: info.station,
    };
    console.log(`${LOG} sending lookup`, message);
    const res = (await chrome.runtime.sendMessage(message)) as LookupResponse;
    console.log(`${LOG} lookup response`, res);
    if (res?.ok && res.lookup) {
      renderState({
        kind: 'data',
        lookup: res.lookup,
        fallbackUrl: buildFallbackUrl(info),
      });
    } else if (res?.error === 'paused') {
      renderState({ kind: 'paused' });
    } else {
      renderState({ kind: 'error', fallbackUrl: buildFallbackUrl(info) });
    }
  } catch (err) {
    console.warn('[tabelog-gmap] lookup message failed', err);
    renderState({ kind: 'error', fallbackUrl: buildFallbackUrl(info) });
  }
}

function mountHost(info: TabelogPageInfo): Mount {
  if (!info.anchor) throw new Error('mountHost called with null anchor');

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.dataset.tabelogId = info.tabelogId;
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = RATING_CARD_CSS;
  shadow.appendChild(style);

  const reactRoot = document.createElement('div');
  shadow.appendChild(reactRoot);

  info.anchor.insertAdjacentElement('afterend', host);

  return {
    host,
    root: createRoot(reactRoot),
    tabelogId: info.tabelogId,
  };
}

function renderState(state: Parameters<typeof RatingCard>[0]['state']): void {
  if (!current) return;
  current.root.render(createElement(RatingCard, { state }));
}

function teardown(): void {
  if (!current) return;
  try {
    current.root.unmount();
  } catch {
    /* ignore */
  }
  current.host.remove();
  current = null;
}

function buildFallbackUrl(info: TabelogPageInfo): string {
  const q = [info.storeName, info.station].filter(Boolean).join(' ');
  return `https://www.google.com/maps/search/${encodeURIComponent(q)}`;
}

/**
 * Wait for both an anchor element and a store name to be in the DOM.
 * Polls extractPageInfo until both fields are populated or the deadline hits.
 * Uses both setTimeout and MutationObserver so we wake up immediately on
 * dynamic insertions instead of only every 150 ms.
 */
function waitForPageInfo(timeoutMs: number): Promise<TabelogPageInfo | null> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    let last: TabelogPageInfo | null = null;
    let resolved = false;
    let observer: MutationObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (value: TabelogPageInfo | null) => {
      if (resolved) return;
      resolved = true;
      observer?.disconnect();
      if (timer !== null) clearTimeout(timer);
      resolve(value);
    };

    const tick = () => {
      last = extractPageInfo();
      if (last && last.anchor && last.storeName) {
        finish(last);
        return;
      }
      if (Date.now() >= deadline) {
        finish(last);
        return;
      }
      timer = setTimeout(tick, 200);
    };

    observer = new MutationObserver(() => {
      last = extractPageInfo();
      if (last && last.anchor && last.storeName) finish(last);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    tick();
  });
}

/**
 * Tabelog occasionally swaps the main pane via pjax-style navigation
 * (no full page load). Observe both pushState and DOM swaps so the card
 * remounts on the new restaurant.
 */
function watchUrlChanges(callback: () => void): void {
  let lastHref = location.href;
  const check = () => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      callback();
    }
  };
  window.addEventListener('popstate', check);
  window.addEventListener('hashchange', check);
  // Wrap pushState / replaceState to fire on programmatic nav.
  const wrap = (key: 'pushState' | 'replaceState') => {
    const orig = history[key];
    history[key] = function patched(this: History, ...args: Parameters<typeof orig>) {
      const ret = orig.apply(this, args);
      setTimeout(check, 0);
      return ret;
    } as typeof orig;
  };
  wrap('pushState');
  wrap('replaceState');

  // Also re-check on DOM mutations to the body — covers SSR re-renders that
  // don't go through History API.
  const observer = new MutationObserver(() => {
    if (!current) {
      check();
      return;
    }
    if (!document.contains(current.host)) {
      // Anchor was wiped (e.g. SPA nav re-rendered the header). Remount.
      current = null;
      callback();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
