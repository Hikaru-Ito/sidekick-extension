/**
 * Tabelog rating extraction — two-step flow driven by the background:
 *
 *   1. `findTabelogUrlOnGoogle(timeoutMs, targetName)` runs on a Google
 *      SERP (`google.com/search?q={店名 駅 site:tabelog.com}`) and returns
 *      the first link whose URL matches Tabelog's detail-page pattern.
 *      Google's ranking is much stronger than Tabelog's internal search so
 *      this gives us the correct restaurant page directly.
 *
 *   2. `scrapeTabelogDetailPage(timeoutMs)` runs on that detail page and
 *      reads the *actual* rating and review count off the page header
 *      (no list-view averages, no aggregate counts).
 *
 * Both functions are self-contained: only the body ships to the target
 * tab via `chrome.scripting.executeScript`, so all helpers live inside.
 */

export interface FindUrlOk {
  ok: true;
  url: string;
}
export interface FindUrlFail {
  ok: false;
  reason: 'captcha' | 'no-results' | 'crash';
  message?: string;
  pageUrl?: string;
}
export type FindUrlResult = FindUrlOk | FindUrlFail;

export interface TabelogScrapeOk {
  ok: true;
  name: string;
  rating: number | null;
  reviewCount: number | null;
  tabelogUrl: string;
  /** Diagnostic info — populated even on success so the orchestrator can log. */
  debug?: TabelogScrapeDebug;
}
export interface TabelogScrapeFail {
  ok: false;
  reason: 'no-data' | 'crash';
  message?: string;
  url?: string;
  debug?: TabelogScrapeDebug;
}
export interface TabelogScrapeDebug {
  /** Did we ever find an `.rdheader-rating` (or fallback) node? */
  sawHeader: boolean;
  /** Selectors that matched at least one element (good for diagnosing drift). */
  matchedSelectors: string[];
  /** First 80 chars of the page <title> — confirms we landed on a real page. */
  title: string;
  /** Final URL of the scraped page (may differ from request URL after redirects). */
  url: string;
}
export type TabelogScrapeResult = TabelogScrapeOk | TabelogScrapeFail;

/**
 * Pick the first Google SERP link that points to a Tabelog detail page.
 * Accepts bare detail URLs (`/{pref}/A\d+/A\d+/\d+/`) only — sub-pages
 * such as `/dtlmenu/` and `/dtlrvwlst/` are stripped to their parent.
 */
export async function findTabelogUrlOnGoogle(
  timeoutMs = 6000,
  // `targetName` is reserved for future re-ranking; Google's default
  // relevance ordering is good enough that we currently just take the
  // top match.
  _targetName = '',
): Promise<FindUrlResult> {
  try {
    // Consent / CAPTCHA gating — Google shows these on any redirected host.
    if (
      /consent\.google\./i.test(location.hostname) ||
      document.body?.innerHTML.includes('g-recaptcha') ||
      document.title.includes('問題が発生しました')
    ) {
      return { ok: false, reason: 'captcha' };
    }

    const DETAIL_RE = /^https:\/\/tabelog\.com\/[a-z-]+\/A\d+\/A\d+\/(\d+)\b/i;

    const unwrap = (raw: string): string => {
      // Modern SERP usually has direct URLs, but older / mobile flows still
      // wrap with `/url?q=...&...`. Handle both.
      if (raw.startsWith('https://www.google.com/url?') || raw.startsWith('/url?')) {
        try {
          const u = new URL(raw, location.href);
          return u.searchParams.get('q') ?? raw;
        } catch {
          return raw;
        }
      }
      return raw;
    };

    const collect = (): string[] => {
      const out: string[] = [];
      const seen = new Set<string>();
      const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'));
      for (const a of anchors) {
        const raw = a.href;
        if (!raw) continue;
        const href = unwrap(raw).split('#')[0]!.split('?')[0]!;
        const m = DETAIL_RE.exec(href);
        if (!m) continue;
        // Normalise to the bare detail URL (drop sub-paths like /dtlmenu/).
        const id = m[1]!;
        const prefix = href.match(/^https:\/\/tabelog\.com\/[a-z-]+\/A\d+\/A\d+\//i)?.[0];
        if (!prefix) continue;
        const canonical = `${prefix}${id}/`;
        if (seen.has(canonical)) continue;
        seen.add(canonical);
        out.push(canonical);
      }
      return out;
    };

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const matches = collect();
      if (matches.length > 0) {
        return { ok: true, url: matches[0]! };
      }
      await new Promise<void>((r) => setTimeout(r, 250));
    }
    return { ok: false, reason: 'no-results', pageUrl: location.href };
  } catch (err) {
    return {
      ok: false,
      reason: 'crash',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Read the headline rating + review count off a Tabelog restaurant detail
 * page. We anchor to `.rdheader-rating` and try several selectors for the
 * actual numbers — Tabelog has rotated class names a few times.
 */
export async function scrapeTabelogDetailPage(timeoutMs = 6000): Promise<TabelogScrapeResult> {
  try {
    const t = (el: Element | null | undefined): string => el?.textContent?.trim() ?? '';

    const parseRating = (text: string): number | null => {
      if (!text) return null;
      const m = text.trim().match(/^([1-5](?:\.\d+)?)/);
      if (!m || !m[1]) return null;
      const n = Number(m[1]);
      return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
    };

    const parseCount = (text: string): number | null => {
      if (!text) return null;
      const m = text.match(/([\d,]+)/);
      if (!m || !m[1]) return null;
      const n = Number(m[1].replace(/,/g, ''));
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const findRating = (): number | null => {
      const selectors = [
        '.rdheader-rating__score-val-num',
        '.rdheader-rating__score-val',
        '.rdheader-rating__score b',
        '.rdheader-rating .c-rating__val',
        '[class*="rdheader-rating"] [class*="score-val-num"]',
        '[class*="rdheader-rating"] b',
      ];
      for (const sel of selectors) {
        const v = parseRating(t(document.querySelector(sel)));
        if (v != null) return v;
      }
      return null;
    };

    const findCount = (): number | null => {
      const selectors = [
        '.rdheader-rating__review-target-num',
        '.rdheader-rating__rvw-target em',
        '.rdheader-rating__review-target em',
        '.rdheader-rating em',
        '[class*="rdheader-rating"] [class*="review-target-num"]',
        '[class*="rdheader-rating"] [class*="rvw-target"] em',
      ];
      for (const sel of selectors) {
        const v = parseCount(t(document.querySelector(sel)));
        if (v != null) return v;
      }
      return null;
    };

    const findName = (): string => {
      const selectors = [
        '.display-name',
        '.display-name span',
        'h1.display-name',
        'h2.display-name',
        '[class*="display-name"]',
        '.rstinfo-table__name',
        '.rd-header__rst-name',
      ];
      for (const sel of selectors) {
        const text = t(document.querySelector(sel));
        if (text) return text;
      }
      return '';
    };

    const PROBES = [
      '.rdheader-rating',
      '.rdheader-rating__score-val-num',
      '.rdheader-rating__score-val',
      '.rdheader-rating__review-target-num',
      '.display-name',
      '[class*="rdheader-rating"]',
      '[class*="display-name"]',
      '[class*="rstName"]',
    ];
    const collectDebug = (): TabelogScrapeDebug => ({
      sawHeader:
        !!document.querySelector('.rdheader-rating') ||
        !!document.querySelector('[class*="rdheader-rating"]'),
      matchedSelectors: PROBES.filter((sel) => !!document.querySelector(sel)),
      title: (document.title || '').slice(0, 80),
      url: location.href,
    });

    const deadline = Date.now() + timeoutMs;
    let lastName = '';
    let lastRating: number | null = null;
    let lastCount: number | null = null;
    while (Date.now() < deadline) {
      lastName = findName();
      lastRating = findRating();
      lastCount = findCount();
      if (lastName && (lastRating != null || lastCount != null)) {
        return {
          ok: true,
          name: lastName,
          rating: lastRating,
          reviewCount: lastCount,
          tabelogUrl: location.href,
          debug: collectDebug(),
        };
      }
      await new Promise<void>((r) => setTimeout(r, 250));
    }

    if (lastName) {
      // Page loaded but rating widget didn't render (closed restaurant,
      // pending publication, etc.). Surface that gracefully.
      return {
        ok: true,
        name: lastName,
        rating: lastRating,
        reviewCount: lastCount,
        tabelogUrl: location.href,
        debug: collectDebug(),
      };
    }
    return { ok: false, reason: 'no-data', url: location.href, debug: collectDebug() };
  } catch (err) {
    return {
      ok: false,
      reason: 'crash',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
