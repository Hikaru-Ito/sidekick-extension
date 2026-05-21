/**
 * Pulls the bits we need to query Tabelog + Maps off a 一休レストラン
 * detail page. Runs in the content-script context.
 *
 * Ikyu's HTML uses fairly stable class prefixes (`restaurantHeader`,
 * `restaurantSummary`, ...) but we still try multiple selectors so
 * cosmetic restyling doesn't break the feature.
 */

export interface IkyuPageInfo {
  /** Numeric restaurant id from the URL. */
  ikyuId: string;
  ikyuUrl: string;
  /** Restaurant display name. */
  storeName: string;
  /** Nearest station / area copy when present. */
  area: string;
  /** Element to mount the rating panel under. */
  anchor: HTMLElement | null;
}

// Accepts:
//   https://restaurant.ikyu.com/103456/
//   https://restaurant.ikyu.com/103456
//   https://restaurant.ikyu.com/103456/menu/
//   https://restaurant.ikyu.com/103456/?foo=bar
const STORE_PAGE_URL = /^https:\/\/restaurant\.ikyu\.com\/(\d+)(?:[/?#]|$)/i;

export function isStoreDetailUrl(url: string): boolean {
  return STORE_PAGE_URL.test(url);
}

export function extractIkyuId(url: string): string | null {
  const m = STORE_PAGE_URL.exec(url);
  return m ? (m[1] ?? null) : null;
}

export function extractPageInfo(): IkyuPageInfo | null {
  const url = location.href.split('#')[0]?.split('?')[0] ?? location.href;
  const id = extractIkyuId(url);
  if (!id) return null;
  return {
    ikyuId: id,
    ikyuUrl: url,
    storeName: extractStoreName(),
    area: extractArea(),
    anchor: findAnchor(),
  };
}

function extractStoreName(): string {
  const selectors = [
    'h1[class*="restaurantName"]',
    'h1[class*="RestaurantName"]',
    'h1[class*="rstName"]',
    '[class*="restaurantHeader"] h1',
    '[class*="restaurantHeader"] [class*="name"]',
    '[class*="restaurantInfo"] h1',
    'main h1',
    'header h1',
    'h1',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const text = (el?.textContent ?? '').trim();
    if (text) return text;
  }
  // Fallback: og:title / document title (strip "一休.com" suffix).
  const og = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
  if (og) {
    return og
      .replace(/\s*[-―|｜]\s*一休\.com.*$/, '')
      .replace(/\s*[（(].*?[)）]\s*$/, '')
      .trim();
  }
  return (document.title || '').replace(/\s*[-―|｜]\s*一休\.com.*$/, '').trim();
}

function extractArea(): string {
  // Ikyu shows area / nearest station in a few different places depending
  // on the layout. We pull the first "○○駅" token we can find; otherwise
  // fall back to area copy like "銀座 / 鮨".
  const haystacks: string[] = [];

  const subInfoSelectors = [
    '[class*="restaurantHeader"]',
    '[class*="restaurantSummary"]',
    '[class*="restaurantInfo"]',
    '[class*="rstInfo"]',
    '[class*="rstSummary"]',
    '[class*="breadcrumb"]',
  ];
  for (const sel of subInfoSelectors) {
    const el = document.querySelector(sel);
    if (el) haystacks.push(el.textContent ?? '');
  }

  for (const text of haystacks) {
    const station = pickStation(text);
    if (station) return station;
  }
  // No 駅 token → return the first "area / cuisine" breadcrumb hint we can find.
  for (const text of haystacks) {
    const trimmed = text.replace(/\s+/g, ' ').trim();
    if (trimmed) {
      // Keep it short — usually the first 20–30 chars are the area name.
      return trimmed.slice(0, 30);
    }
  }
  return '';
}

function pickStation(text: string): string {
  const m = text.match(/[一-龯ぁ-んァ-ヶーA-Za-z0-9]+駅/);
  return m ? m[0] : '';
}

function findAnchor(): HTMLElement | null {
  const selectors = [
    '[class*="restaurantHeader"]',
    '[class*="restaurantSummary"]',
    '[class*="restaurantInfo"]',
    '[class*="rstHeader"]',
    'main > section:first-of-type',
    'main > div:first-of-type',
  ];
  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
  }
  // Heuristic: look for any block close to the page h1 that contains the
  // restaurant name + some price/cuisine copy.
  const h1 = document.querySelector('h1');
  if (h1) {
    const container = h1.closest<HTMLElement>('section, article, header, div');
    if (container) return container;
  }
  return null;
}
