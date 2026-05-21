import {
  CONFIDENCE_LABEL,
  SOURCE_LABEL,
  type IkyuLookup,
  type MatchConfidence,
  type SourceRating,
} from '../types';

/**
 * Two-row rating panel rendered inside a Shadow DOM on the Ikyu page.
 * Each row corresponds to one external source (Tabelog / Google Maps).
 */

type State =
  | { kind: 'loading' }
  | { kind: 'data'; lookup: IkyuLookup; fallback: { tabelog: string; gmaps: string } }
  | { kind: 'paused' }
  | { kind: 'error'; fallback: { tabelog: string; gmaps: string } };

export function RatingPanel({ state }: { state: State }) {
  if (state.kind === 'loading') {
    return (
      <div className="sk-card">
        <div className="sk-row sk-row-loading">
          <span className="sk-brand">他サイトの評価</span>
          <span className="sk-muted">取得中…</span>
          <span className="sk-spinner" aria-hidden />
        </div>
      </div>
    );
  }
  if (state.kind === 'paused') {
    return (
      <div className="sk-card">
        <div className="sk-row sk-row-loading">
          <span className="sk-brand">他サイトの評価</span>
          <span className="sk-muted">CAPTCHA — 30 分後に再開</span>
        </div>
      </div>
    );
  }
  if (state.kind === 'error') {
    return (
      <div className="sk-card">
        <Row source="tabelog" rating={null} fallbackUrl={state.fallback.tabelog} />
        <Row source="gmaps" rating={null} fallbackUrl={state.fallback.gmaps} />
      </div>
    );
  }

  return (
    <div className="sk-card">
      <Row source="tabelog" rating={state.lookup.tabelog} fallbackUrl={state.fallback.tabelog} />
      <Row source="gmaps" rating={state.lookup.gmaps} fallbackUrl={state.fallback.gmaps} />
    </div>
  );
}

function Row({
  source,
  rating,
  fallbackUrl,
}: {
  source: SourceRating['source'];
  rating: SourceRating | null;
  fallbackUrl: string;
}) {
  const label = SOURCE_LABEL[source];
  const hasData = !!rating && (rating.rating != null || rating.reviewCount != null);

  if (!hasData) {
    return (
      <div className="sk-row">
        <span className="sk-brand">{label}</span>
        <span className="sk-muted">該当なし</span>
        <a className="sk-link" href={fallbackUrl} target="_blank" rel="noreferrer noopener">
          検索 →
        </a>
      </div>
    );
  }

  return (
    <div className="sk-row">
      <span className="sk-brand">{label}</span>
      {rating!.rating != null ? (
        <span className="sk-rating">
          <span className="sk-star" aria-hidden>
            ★
          </span>
          {rating!.rating.toFixed(source === 'tabelog' ? 2 : 1)}
        </span>
      ) : null}
      {rating!.reviewCount != null ? (
        <span className="sk-count">口コミ {rating!.reviewCount.toLocaleString('ja-JP')}件</span>
      ) : null}
      <ConfidenceBadge
        confidence={rating!.confidence}
        similarity={rating!.similarity}
        matched={rating!.matchedName}
      />
      <a
        className="sk-link"
        href={rating!.sourceUrl || fallbackUrl}
        target="_blank"
        rel="noreferrer noopener"
      >
        {source === 'tabelog' ? '食べログ' : 'Maps'} →
      </a>
    </div>
  );
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

/** Light-only stylesheet matched to Ikyu's bright UI. */
export const RATING_PANEL_CSS = `
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
  margin: 8px 0;
  padding: 6px 10px;
  background: #ffffff;
  border: 1px solid #ebebeb;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
}

.sk-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 4px 0;
  border-bottom: 1px solid #f3f3f3;
}
.sk-row:last-child { border-bottom: none; }
.sk-row-loading { padding: 2px 0; }

.sk-brand {
  font-size: 10px;
  color: #8a8a8a;
  letter-spacing: 0.02em;
  font-weight: 600;
  white-space: nowrap;
  min-width: 86px;
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
.sk-badge-high { background: #f1f7ee; color: #4d7a1c; }
.sk-badge-medium { background: #fcf6e8; color: #95630a; }
.sk-badge-low { background: #fbeded; color: #b03030; }
.sk-badge-unknown { background: #f2f2f2; color: #6b6b6b; }
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
