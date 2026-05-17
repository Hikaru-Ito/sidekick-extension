import { CONFIDENCE_LABEL, type GmapLookup, type MatchConfidence } from '../types';

/**
 * Compact, Tabelog-flavoured rating row.
 *
 * Tabelog's UI is bright, clean, and tight on spacing, so the card matches
 * that tone: white background, hairline border, no heavy accent stripe,
 * sub-13 px text everywhere, single-line layout when possible.
 */

type State =
  | { kind: 'loading' }
  | { kind: 'data'; lookup: GmapLookup; fallbackUrl: string }
  | { kind: 'paused' }
  | { kind: 'error'; fallbackUrl: string };

export function RatingCard({ state }: { state: State }) {
  return (
    <div className="sk-card">
      <Inline state={state} />
    </div>
  );
}

function Inline({ state }: { state: State }) {
  if (state.kind === 'loading') {
    return (
      <div className="sk-row">
        <Brand />
        <span className="sk-muted">取得中…</span>
        <span className="sk-spinner" aria-hidden />
      </div>
    );
  }

  if (state.kind === 'paused') {
    return (
      <div className="sk-row">
        <Brand />
        <span className="sk-muted">CAPTCHA — 30 分後に再開</span>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="sk-row">
        <Brand />
        <span className="sk-muted">取得失敗</span>
        <a className="sk-link" href={state.fallbackUrl} target="_blank" rel="noreferrer noopener">
          Maps で検索 →
        </a>
      </div>
    );
  }

  const { lookup, fallbackUrl } = state;
  const hasData = lookup.rating != null || lookup.reviewCount != null;

  if (!hasData) {
    return (
      <div className="sk-row">
        <Brand />
        <span className="sk-muted">該当なし</span>
        <a
          className="sk-link"
          href={lookup.mapsUrl || fallbackUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          Maps で検索 →
        </a>
      </div>
    );
  }

  return (
    <div className="sk-row">
      <Brand />
      {lookup.rating != null ? (
        <span className="sk-rating">
          <span className="sk-star" aria-hidden>
            ★
          </span>
          {lookup.rating.toFixed(1)}
        </span>
      ) : null}
      {lookup.reviewCount != null ? (
        <span className="sk-count">口コミ {lookup.reviewCount.toLocaleString('ja-JP')}件</span>
      ) : null}
      <ConfidenceBadge
        confidence={lookup.confidence}
        similarity={lookup.similarity}
        matched={lookup.matchedName}
      />
      <a
        className="sk-link"
        href={lookup.mapsUrl || fallbackUrl}
        target="_blank"
        rel="noreferrer noopener"
      >
        Maps →
      </a>
    </div>
  );
}

function Brand() {
  return <span className="sk-brand">Google Maps</span>;
}

function ConfidenceBadge({
  confidence,
  similarity,
  matched,
}: {
  confidence: MatchConfidence;
  similarity: number;
  matched?: string;
}) {
  const tooltip = matched
    ? `マッチ "${matched}" · 類似度 ${(similarity * 100).toFixed(0)}%`
    : `類似度 ${(similarity * 100).toFixed(0)}%`;
  return (
    <span className={`sk-badge sk-badge-${confidence}`} title={tooltip}>
      {CONFIDENCE_LABEL[confidence]}
    </span>
  );
}

/**
 * Light-only stylesheet. Tabelog's main UI is always white so we don't honour
 * `prefers-color-scheme: dark` here — the card should always sit gracefully
 * inside Tabelog's rating block rather than fighting it.
 */
export const RATING_CARD_CSS = `
:host {
  all: initial;
  display: block;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif;
  color: #2b2b2b;
  font-size: 12px;
  line-height: 1.35;
}
* { box-sizing: border-box; }

.sk-card {
  margin: 6px 0 4px;
  padding: 6px 10px;
  background: #ffffff;
  border: 1px solid #ebebeb;
  border-radius: 4px;
}

.sk-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.sk-brand {
  font-size: 10px;
  color: #8a8a8a;
  letter-spacing: 0.02em;
  font-weight: 500;
  white-space: nowrap;
}

.sk-rating {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  font-size: 13px;
  font-weight: 700;
  color: #2b2b2b;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.sk-star {
  color: #f0a000;
  font-size: 11px;
  position: relative;
  top: -1px;
}

.sk-count {
  font-size: 11px;
  color: #6b6b6b;
  white-space: nowrap;
}

.sk-muted {
  font-size: 11px;
  color: #8a8a8a;
}

.sk-link {
  margin-left: auto;
  font-size: 11px;
  color: #1a73e8;
  text-decoration: none;
  white-space: nowrap;
}
.sk-link:hover { text-decoration: underline; }

.sk-badge {
  display: inline-flex;
  align-items: center;
  font-size: 9px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  letter-spacing: 0.02em;
  line-height: 1.4;
}
.sk-badge-high {
  background: #f1f7ee;
  color: #4d7a1c;
}
.sk-badge-medium {
  background: #fcf6e8;
  color: #95630a;
}
.sk-badge-low {
  background: #fbeded;
  color: #b03030;
}
.sk-badge-unknown {
  background: #f2f2f2;
  color: #6b6b6b;
}

.sk-spinner {
  width: 10px;
  height: 10px;
  border: 1.5px solid #d8d8d8;
  border-top-color: #8a8a8a;
  border-radius: 50%;
  animation: sk-spin 0.8s linear infinite;
  flex-shrink: 0;
  margin-left: auto;
}
@keyframes sk-spin { to { transform: rotate(360deg); } }
`;
