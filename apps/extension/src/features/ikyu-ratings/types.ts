/**
 * Ikyu (一休レストラン) × Tabelog + Google Maps — types.
 *
 * On an Ikyu restaurant detail page we want to surface the same restaurant's
 * rating + review count from BOTH Tabelog and Google Maps. The orchestrator
 * opens hidden tabs to each source, scrapes the relevant card, and caches
 * the result keyed by Ikyu's numeric restaurant id.
 */

export type MatchConfidence = 'high' | 'medium' | 'low' | 'unknown';

/** A single rating from one source. */
export interface SourceRating {
  source: 'tabelog' | 'gmaps';
  rating?: number;
  reviewCount?: number;
  /** Name as it appeared on the source — used to surface match quality. */
  matchedName?: string;
  /** Direct link to the source page. */
  sourceUrl?: string;
  /** Dice similarity to the Ikyu name (0–1). */
  similarity: number;
  confidence: MatchConfidence;
  /** Set when scraping failed — UI will show a fallback search link. */
  error?: string;
}

/** Persisted aggregate lookup result. */
export interface IkyuLookup {
  ikyuId: string;
  ikyuUrl: string;
  ikyuName: string;
  /** Optional area / station hint extracted from the Ikyu page. */
  area: string;
  tabelog: SourceRating;
  gmaps: SourceRating;
  fetchedAt: number;
}

export interface IkyuRatingsSettings {
  enabled: boolean;
  cacheTtlDays: number;
  /** Render a fallback search link when scraping fails entirely. */
  showFallbackLink: boolean;
}

export const DEFAULT_SETTINGS: IkyuRatingsSettings = {
  enabled: true,
  cacheTtlDays: 7,
  showFallbackLink: true,
};

/** Confidence thresholds (Dice similarity). */
export const CONFIDENCE_THRESHOLDS = {
  high: 0.8,
  medium: 0.6,
} as const;

export const CONFIDENCE_LABEL: Record<MatchConfidence, string> = {
  high: '高確度',
  medium: '中確度',
  low: '要確認',
  unknown: '不明',
};

export const SOURCE_LABEL: Record<SourceRating['source'], string> = {
  tabelog: '食べログ',
  gmaps: 'Google Maps',
};

/** LRU upper bound. */
export const MAX_CACHE_ENTRIES = 500;

/** Pause both lookups after a CAPTCHA / rate-limit signal. */
export const CAPTCHA_COOLDOWN_MS = 30 * 60 * 1000;

/** Minimum gap between two scrapes (rate limit). */
export const MIN_INTERVAL_MS = 2_000;

/** Per-scrape hard timeout. */
export const SCRAPE_TIMEOUT_MS = 15_000;
