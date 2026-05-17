/**
 * Pulls the bits we need to query Google Maps off a Tabelog restaurant page.
 *
 * Runs in the content-script context (so `document` is available) and is
 * intentionally selector-tolerant — Tabelog occasionally rotates classnames.
 */

export interface TabelogPageInfo {
  /** Numeric place id from the URL, e.g. "13123456". */
  tabelogId: string;
  /** Page URL (no fragment). */
  tabelogUrl: string;
  /** Display name of the restaurant. */
  storeName: string;
  /** Nearest station name (empty if not found). */
  station: string;
  /** Where on the page we should mount the rating card. */
  anchor: HTMLElement | null;
}

// Accepts:
//   https://tabelog.com/tokyo/A1301/A130101/13123456/
//   https://tabelog.com/tokyo/A1301/A130101/13123456?foo
//   https://tabelog.com/tokyo/A1301/A130101/13123456/dtlmenu/
//   https://tabelog.com/tokyo/A1301/A130101/13123456/dtlrvwlst/
// — anything under the restaurant id is still part of the same store, and the
// header we anchor under is present on most of those sub-pages.
const STORE_PAGE_URL = /^https:\/\/tabelog\.com\/[^/]+\/A\d+\/A\d+\/(\d+)(?:[/?#]|$)/i;

/** True for any URL under a Tabelog restaurant id (detail page or sub-pages). */
export function isStoreDetailUrl(url: string): boolean {
  return STORE_PAGE_URL.test(url);
}

export function extractTabelogId(url: string): string | null {
  const m = STORE_PAGE_URL.exec(url);
  return m ? (m[1] ?? null) : null;
}

export function extractPageInfo(): TabelogPageInfo | null {
  const url = location.href.split('#')[0]?.split('?')[0] ?? location.href;
  const id = extractTabelogId(url);
  if (!id) return null;

  return {
    tabelogId: id,
    tabelogUrl: url,
    storeName: extractStoreName(),
    station: extractStation(),
    anchor: findAnchor(),
  };
}

function extractStoreName(): string {
  // Multiple selectors — Tabelog rotates layouts every couple of years.
  const selectors = [
    '.display-name',
    '.display-name span',
    'h1.display-name',
    'h2.display-name',
    '.rstinfo-table__name',
    '.rd-header__rst-name',
    '.rdheader-rstname',
    'h1[class*="display"]',
    'h2[class*="display"]',
    'h2[class*="rstname"]',
    'h1[class*="rstname"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const text = (el?.textContent ?? '').trim();
    if (text) return text;
  }
  // Fallback: og:title meta.
  const og = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
  if (og) {
    // OG title is often "店名 (駅名/ジャンル) - 食べログ" — strip the suffix.
    return og
      .replace(/\s*[-―]\s*食べログ.*$/, '')
      .replace(/\s*[（(].*?[)）]\s*$/, '')
      .trim();
  }
  // Last resort: the document title.
  return (document.title || '').replace(/\s*[-―]\s*食べログ.*$/, '').trim();
}

function extractStation(): string {
  // Primary source: the <dd> inside .rdheader-subinfo__item--station. The
  // sibling <dt> holds the label "最寄り駅" — we must explicitly target dd.
  const headerDd = document.querySelector('.rdheader-subinfo__item--station dd')?.textContent ?? '';
  const fromHeader = pickStation(headerDd);
  if (fromHeader) return fromHeader;

  // Secondary: the "交通手段 / アクセス" row of the info table on dtlmap
  // pages, e.g. "東京メトロ銀座線 神田駅 1番出口 徒歩2分".
  const tableRows = Array.from(document.querySelectorAll('.rstinfo-table tr'));
  for (const row of tableRows) {
    const th = row.querySelector('th')?.textContent ?? '';
    if (/交通手段|最寄り|アクセス/.test(th)) {
      const text = row.querySelector('td')?.textContent ?? '';
      const station = pickStation(text);
      if (station) return station;
    }
  }

  // Tertiary: linktree (breadcrumb-style nav under the header) — pulls "新橋
  // 駅周辺グルメ" etc.
  const linktree = document.querySelector('.linktree')?.textContent ?? '';
  const fromLinktree = pickStation(linktree);
  if (fromLinktree) return fromLinktree;

  return '';
}

function pickStation(text: string): string {
  // Prefer "○○駅", optionally followed by 線 or "前"; fall back to bare names
  // for stations that don't include the 駅 character (e.g. "新橋").
  const m = text.match(/[一-龯ぁ-んァ-ヶーA-Za-z0-9]+駅/);
  return m ? m[0] : '';
}

function findAnchor(): HTMLElement | null {
  // Mount slot: the rating block in the page header. Tabelog's class names
  // change between layouts; try a broad list of candidates and fall back to
  // any element that *looks* like the rating block (has 総合点 / 食べログ評価
  // copy, or sits inside .rdheader / .rd-header).
  const selectors = [
    // Specific rating blocks we've observed
    '.rdheader-rating',
    '.rdheader-rating__score',
    '.rdheader-info',
    '.rd-header-rating',
    '.rd-header__rating',
    // Looser header containers — still better than appending to <body>
    '.rdheader',
    '.rd-header',
    '#rdheader',
    // Tabelog reviews / overall-rating section ids
    '#js-rdheader-rating',
    '[class*="rdheader-rating"]',
    '[class*="rd-header-rating"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
  }

  // Heuristic last resort: look for any element whose own text contains
  // "総合点" or "食べログ評価" — the rating label that always accompanies
  // the score.
  const all = Array.from(document.querySelectorAll<HTMLElement>('header, section, div'));
  for (const el of all) {
    const text = el.textContent ?? '';
    if (text.length > 0 && text.length < 400 && /総合点|食べログ評価/.test(text)) {
      return el;
    }
  }
  return null;
}
