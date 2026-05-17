/**
 * The function below is serialised by `chrome.scripting.executeScript({ func })`
 * and executed inside the hidden Google Maps tab. Critically: only the body of
 * `scrapeGmaps` is shipped to the target tab — references to any helper
 * declared at module scope would be undefined and crash with ReferenceError.
 *
 * Therefore EVERY helper must be defined INSIDE `scrapeGmaps`.
 */

export interface ScrapeOk {
  ok: true;
  name: string;
  rating: number | null;
  reviewCount: number | null;
  mapsUrl: string;
  /** Diagnostic: which strategy fired (single place / list match / fallback). */
  source?: string;
  /** Diagnostic: name similarity to the target (0–1) when caller passed one. */
  similarity?: number;
}

export interface ScrapeCaptcha {
  ok: false;
  reason: 'captcha';
}

export interface ScrapeEmpty {
  ok: false;
  reason: 'no-result' | 'no-data';
  heading?: string;
  url?: string;
}

export interface ScrapeCrash {
  ok: false;
  reason: 'crash';
  message: string;
}

export type ScrapeResult = ScrapeOk | ScrapeCaptcha | ScrapeEmpty | ScrapeCrash;

/**
 * Self-contained scrape. All helpers are inner functions because this is
 * shipped to a remote tab via `chrome.scripting.executeScript`.
 *
 * @param timeoutMs Max wait for the DOM to settle before giving up.
 * @param targetName Tabelog store name. Used to score candidates in list views
 *                   so we don't pick "the most popular nearby restaurant".
 */
export async function scrapeGmaps(timeoutMs = 8000, targetName = ''): Promise<ScrapeResult> {
  // ---- helpers (must be defined inside) ----

  const parseRating = (text: string): number | null => {
    if (!text) return null;
    // Match at the start of the trimmed text only — otherwise the rating
    // regex would happily grab digits from a trailing "(123)" count.
    const m = text.trim().match(/^([1-5](?:[.,]\d+)?)\b/);
    if (!m || !m[1]) return null;
    const n = Number(m[1].replace(',', '.'));
    return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
  };

  /**
   * Strict count parser — ONLY accepts:
   *   - parens "(N)" / "（N）"
   *   - "N件のレビュー" / "N件の口コミ"
   *   - "N reviews" / "N review"
   * Bare "N件" is rejected on purpose — Google Maps uses 件 for photos
   * ("1,457 件の写真"), ratings histograms, etc.
   */
  const parseCount = (text: string): number | null => {
    if (!text) return null;
    let m = text.match(/[（(]\s*([\d,]+)\s*[）)]/);
    if (!m) m = text.match(/([\d,]+)\s*件\s*(?:のレビュー|の口コミ)/);
    if (!m) m = text.match(/([\d,]+)\s*reviews?\b/i);
    if (!m || !m[1]) return null;
    const n = Number(m[1].replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  /** Trimmed text content of `el` or empty string. */
  const t = (el: Element | null | undefined): string => el?.textContent?.trim() ?? '';

  /** Trimmed aria-label of `el` or empty string. */
  const a = (el: Element | null | undefined): string =>
    el?.getAttribute('aria-label')?.trim() ?? '';

  /**
   * Character-bigram Dice similarity, normalised (NFKC, lowercased, drop
   * common decorations / 店 suffix). Matches the scoring used in the
   * background module — kept in sync intentionally.
   */
  const similarity = (s1: string, s2: string): number => {
    const normalise = (s: string) =>
      s
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[（）()【】「」『』［］\[\]・･、。.,!！?？·]/g, '')
        .replace(/(本店|支店|店)$/, '')
        .replace(/\s+/g, '')
        .trim();
    const A = normalise(s1);
    const B = normalise(s2);
    if (!A || !B) return 0;
    if (A === B) return 1;
    const bigrams = (s: string) => {
      const out = new Set<string>();
      for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
      return out;
    };
    const ba = bigrams(A);
    const bb = bigrams(B);
    if (ba.size === 0 || bb.size === 0) {
      return A.includes(B) || B.includes(A) ? 0.8 : 0;
    }
    let overlap = 0;
    for (const bg of ba) if (bb.has(bg)) overlap++;
    return (2 * overlap) / (ba.size + bb.size);
  };

  /**
   * Extract rating+count from an element scope that we *trust* belongs to one
   * place (a single-place rating widget, or one list-view card).
   *
   * Strategy: walk the scope's descendants, looking for elements whose
   * aria-label or text content describes either a rating or a review count.
   */
  const extractScoped = (scope: Element): { rating: number | null; count: number | null } => {
    let rating: number | null = null;
    let count: number | null = null;

    // Pass 1: aria-labels that explicitly mention "件のレビュー / 口コミ / reviews".
    const countAriaSelectors = [
      '[aria-label*="件のレビュー"]',
      '[aria-label*="件の口コミ"]',
      '[aria-label*=" reviews"]',
      '[aria-label$=" review"]',
    ];
    for (const sel of countAriaSelectors) {
      const el = scope.querySelector(sel);
      if (!el) continue;
      const v = parseCount(a(el));
      if (v != null) {
        count = v;
        break;
      }
    }

    // Pass 2: aria-labels that explicitly mention "★ / 星 / stars".
    const ratingAriaSelectors = [
      '[role="img"][aria-label*="星"]',
      '[role="img"][aria-label*=" stars"]',
      '[role="img"][aria-label$=" star"]',
      '[aria-label*=" out of 5"]',
    ];
    for (const sel of ratingAriaSelectors) {
      const el = scope.querySelector(sel);
      if (!el) continue;
      const v = parseRating(a(el));
      if (v != null) {
        rating = v;
        break;
      }
    }

    // Pass 3: the F7nice container often has both rating and count as text
    // — use it ONLY to fill gaps left by passes 1 and 2.
    if (rating == null || count == null) {
      const blob = scope.querySelector('div.F7nice');
      if (blob) {
        const txt = t(blob);
        if (rating == null) rating = parseRating(txt);
        if (count == null) count = parseCount(txt);
      }
    }

    return { rating, count };
  };

  /**
   * Try the "single place" panel: there's an h1 with the name and a rating
   * widget right next to it. We anchor the count search to the h1's nearest
   * container so we never pick numbers from unrelated widgets on the page.
   */
  const extractFromSinglePlace = (): ScrapeOk | null => {
    const main = document.querySelector('div[role="main"]');
    if (!main) return null;
    const h1 = main.querySelector('h1');
    const name = t(h1);
    if (!name) return null;

    // The rating widget is a sibling or cousin of h1. Walk up the DOM
    // until we find a container that includes both h1 AND a known rating
    // marker, then extract within that scope only.
    let scope: Element | null = h1!.parentElement;
    for (let depth = 0; depth < 6 && scope; depth++) {
      const hasRating =
        scope.querySelector('div.F7nice') ||
        scope.querySelector('[role="img"][aria-label*="星"]') ||
        scope.querySelector('[aria-label*="件のレビュー"]') ||
        scope.querySelector('[aria-label*=" reviews"]');
      if (hasRating) break;
      scope = scope.parentElement;
    }
    if (!scope) scope = main;

    const { rating, count } = extractScoped(scope);
    if (rating == null && count == null) return null;
    return {
      ok: true,
      name,
      rating,
      reviewCount: count,
      mapsUrl: location.href,
      source: 'single-place',
      similarity: targetName ? similarity(targetName, name) : undefined,
    };
  };

  /**
   * List view — pick the card whose name has the highest similarity to the
   * target (or just the first one if no target name was supplied). This
   * avoids returning "the most prominent nearby restaurant" when our exact
   * match is buried lower in the list.
   */
  const extractFromResultsList = (): ScrapeOk | null => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>('[role="article"]'));
    if (cards.length === 0) return null;

    const candidates: Array<{
      name: string;
      rating: number | null;
      count: number | null;
      mapsUrl: string;
      sim: number;
    }> = [];

    for (const card of cards) {
      const nameEl =
        card.querySelector('.qBF1Pd') ??
        card.querySelector('.NrDZNb') ??
        card.querySelector('[role="heading"]') ??
        card.querySelector('h3');
      const name = t(nameEl);
      if (!name) continue;
      const { rating, count } = extractScoped(card);
      const link = card.querySelector<HTMLAnchorElement>('a[href*="/maps/place/"]');
      const sim = targetName ? similarity(targetName, name) : 0;
      candidates.push({
        name,
        rating,
        count,
        mapsUrl: link?.href ?? location.href,
        sim,
      });
    }
    if (candidates.length === 0) return null;

    // Prefer best name-similarity, breaking ties by review count presence.
    candidates.sort((x, y) => {
      if (y.sim !== x.sim) return y.sim - x.sim;
      const xHas = x.count != null ? 1 : 0;
      const yHas = y.count != null ? 1 : 0;
      return yHas - xHas;
    });
    const best = candidates[0];
    if (!best) return null;
    if (best.rating == null && best.count == null) return null;
    return {
      ok: true,
      name: best.name,
      rating: best.rating,
      reviewCount: best.count,
      mapsUrl: best.mapsUrl,
      source: 'list-best-match',
      similarity: targetName ? best.sim : undefined,
    };
  };

  // ---- main flow ----
  try {
    if (
      /consent\.google\./i.test(location.hostname) ||
      document.body?.innerHTML.includes('g-recaptcha') ||
      document.title.includes('問題が発生しました')
    ) {
      return { ok: false, reason: 'captcha' };
    }

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      // List view first: when the search resolves to multiple places we'd
      // rather pick the best name match than the most prominent panel.
      const fromList = extractFromResultsList();
      if (fromList) return fromList;
      const single = extractFromSinglePlace();
      if (single) return single;
      await new Promise<void>((r) => setTimeout(r, 250));
    }

    const heading = document.querySelector('h1')?.textContent?.trim();
    return heading
      ? { ok: false, reason: 'no-data', heading, url: location.href }
      : { ok: false, reason: 'no-result', url: location.href };
  } catch (err) {
    return {
      ok: false,
      reason: 'crash',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
