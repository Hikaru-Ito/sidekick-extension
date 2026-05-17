/**
 * Tabelog × Google Maps — types.
 *
 * The feature attaches a small card under the rating section of every
 * Tabelog restaurant page, showing how the same restaurant is rated on
 * Google Maps. Data is fetched by opening a hidden Google Maps tab,
 * scraping the rating + review count via `chrome.scripting.executeScript`,
 * then closing it.
 */

/** Confidence tier for the Tabelog ↔ Maps match. */
export type MatchConfidence = 'high' | 'medium' | 'low' | 'unknown';

/** Persisted lookup result (IDB cache + cross-context message payload). */
export interface GmapLookup {
  /** Tabelog place id (the numeric segment in the URL). */
  tabelogId: string;
  /** Tabelog page URL, kept for debugging / link-back. */
  tabelogUrl: string;
  /** Store name as it appeared on Tabelog. */
  tabelogName: string;
  /** Best-effort station name from Tabelog. */
  station: string;
  /** Rating (1.0–5.0) — undefined if not extractable. */
  rating?: number;
  /** Review count — undefined if not extractable. */
  reviewCount?: number;
  /** Resolved Google Maps place name. */
  matchedName?: string;
  /** Direct Google Maps URL to the matched place. */
  mapsUrl?: string;
  /** Match quality. */
  confidence: MatchConfidence;
  /** Numeric similarity (0–1), Dice coefficient on tokenised names. */
  similarity: number;
  /** When the lookup ran (epoch ms). */
  fetchedAt: number;
  /** Set when scraping failed — surface a friendly fallback in the UI. */
  error?: string;
}

export interface TabelogGmapSettings {
  /** Master enable flag for the card injection. */
  enabled: boolean;
  /** Cache TTL in days. */
  cacheTtlDays: number;
  /**
   * Show a "search on Google Maps" button when scrape fails entirely.
   * The link uses the same {storeName} {station} query a manual search
   * would.
   */
  showFallbackLink: boolean;
}

export const DEFAULT_SETTINGS: TabelogGmapSettings = {
  enabled: true,
  cacheTtlDays: 7,
  showFallbackLink: true,
};

/** Confidence thresholds (Dice similarity). */
export const CONFIDENCE_THRESHOLDS = {
  /** >= 0.80 → high */
  high: 0.8,
  /** >= 0.60 → medium */
  medium: 0.6,
  // < 0.60 → low
} as const;

export const CONFIDENCE_LABEL: Record<MatchConfidence, string> = {
  high: '高確度',
  medium: '中確度',
  low: '要確認',
  unknown: '不明',
};

/** Hard upper bound on cache size (LRU eviction beyond this). */
export const MAX_CACHE_ENTRIES = 500;

/** Pause new lookups for this long after a CAPTCHA / rate-limit detection. */
export const CAPTCHA_COOLDOWN_MS = 30 * 60 * 1000;

/** Minimum time between two consecutive lookup tabs (rate limit). */
export const MIN_INTERVAL_MS = 2_000;

/** Hard timeout for a single scrape pass (tab open → close). */
export const SCRAPE_TIMEOUT_MS = 15_000;
