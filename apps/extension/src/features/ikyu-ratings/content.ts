/**
 * Content-script mount for the Ikyu Tabelog+Maps rating panel.
 *
 * Mirrors the tabelog-gmap content script: waits for the page to settle
 * (MutationObserver-based polling), opens a Shadow DOM mount, requests
 * data from the background, and re-renders on state changes.
 */

import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { RatingPanel, RATING_PANEL_CSS } from './components/RatingPanel';
import { extractPageInfo, isStoreDetailUrl, type IkyuPageInfo } from './lib/ikyu-extract';
import { readSettings, subscribeSettings } from './storage';
import type { IkyuLookupMessage, IkyuLookupResponse } from './background';

const HOST_ID = 'sidekick-ikyu-ratings-host';
const LOG = '[ikyu-ratings]';

interface Mount {
  host: HTMLElement;
  root: Root;
  ikyuId: string;
}

let current: Mount | null = null;

export async function mountIkyuRatings(): Promise<void> {
  console.log(`${LOG} content script init`, {
    url: location.href,
    readyState: document.readyState,
  });
  const settings = await readSettings();
  if (!settings.enabled) {
    console.log(`${LOG} disabled in settings — skipping`);
    return;
  }

  void ensureMounted();
  watchUrlChanges(() => {
    console.log(`${LOG} URL change detected`);
    void ensureMounted();
  });

  subscribeSettings((s) => {
    if (!s.enabled) teardown();
    else void ensureMounted();
  });
}

async function ensureMounted(): Promise<void> {
  if (!isStoreDetailUrl(location.href)) {
    console.log(`${LOG} not a store-detail URL`, location.href);
    teardown();
    return;
  }
  const info = await waitForPageInfo(8000);
  if (!info) {
    console.warn(`${LOG} could not extract page info`);
    teardown();
    return;
  }
  console.log(`${LOG} extracted`, {
    storeName: info.storeName,
    area: info.area,
    ikyuId: info.ikyuId,
    anchorTag: info.anchor?.tagName,
    anchorClass: info.anchor?.className,
  });
  if (!info.anchor) {
    console.warn(`${LOG} no anchor on page — DOM may have changed`);
    teardown();
    return;
  }
  if (current && current.ikyuId === info.ikyuId && document.contains(current.host)) {
    return;
  }
  teardown();
  current = mountHost(info);
  renderState({ kind: 'loading' });

  try {
    const message: IkyuLookupMessage = {
      type: 'ikyu-ratings:lookup',
      ikyuId: info.ikyuId,
      ikyuUrl: info.ikyuUrl,
      storeName: info.storeName,
      area: info.area,
    };
    console.log(`${LOG} sending lookup`, message);
    const res = (await chrome.runtime.sendMessage(message)) as IkyuLookupResponse;
    console.log(`${LOG} lookup response`, res);
    const fallback = buildFallbackUrls(info);
    if (res?.ok && res.lookup) {
      renderState({ kind: 'data', lookup: res.lookup, fallback });
    } else if (res?.error === 'paused') {
      renderState({ kind: 'paused' });
    } else {
      renderState({ kind: 'error', fallback });
    }
  } catch (err) {
    console.warn(`${LOG} lookup message failed`, err);
    renderState({ kind: 'error', fallback: buildFallbackUrls(info) });
  }
}

function mountHost(info: IkyuPageInfo): Mount {
  if (!info.anchor) throw new Error('mountHost called with null anchor');
  const host = document.createElement('div');
  host.id = HOST_ID;
  host.dataset.ikyuId = info.ikyuId;
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = RATING_PANEL_CSS;
  shadow.appendChild(style);
  const reactRoot = document.createElement('div');
  shadow.appendChild(reactRoot);
  info.anchor.insertAdjacentElement('afterend', host);
  return { host, root: createRoot(reactRoot), ikyuId: info.ikyuId };
}

function renderState(state: Parameters<typeof RatingPanel>[0]['state']): void {
  if (!current) return;
  current.root.render(createElement(RatingPanel, { state }));
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

function buildFallbackUrls(info: IkyuPageInfo): { tabelog: string; gmaps: string } {
  const q = [info.storeName, info.area].filter(Boolean).join(' ');
  const enc = encodeURIComponent(q);
  return {
    tabelog: `https://tabelog.com/rstLst/?sw=${enc}`,
    gmaps: `https://www.google.com/maps/search/${enc}`,
  };
}

function waitForPageInfo(timeoutMs: number): Promise<IkyuPageInfo | null> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    let last: IkyuPageInfo | null = null;
    let resolved = false;
    let observer: MutationObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (value: IkyuPageInfo | null) => {
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
  const observer = new MutationObserver(() => {
    if (!current) {
      check();
      return;
    }
    if (!document.contains(current.host)) {
      current = null;
      callback();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
