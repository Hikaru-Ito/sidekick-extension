import { Sparkles } from 'lucide-react';
import type { UsageInfo } from '../lib/anthropic';
import type { AnthropicModelId, Lang } from '../types';

interface Props {
  usage: UsageInfo;
  model: AnthropicModelId;
  lang?: Lang;
}

// Rough per-1M-token rates (USD) snapshotted from public pricing.
// Educational only — actual billing happens on Anthropic's side.
const MODEL_RATES: Record<AnthropicModelId, { in: number; out: number; cacheRead: number }> = {
  'claude-opus-4-7': { in: 15, out: 75, cacheRead: 1.5 },
  'claude-sonnet-4-6': { in: 3, out: 15, cacheRead: 0.3 },
};

/** Fixed conversion — pricing is in USD on Anthropic's side; we display a
 *  rough JPY approximation when the user's output language is Japanese. */
const USD_TO_JPY = 150;

function formatCost(usd: number, lang: Lang): string {
  if (lang === 'ja') {
    const jpy = usd * USD_TO_JPY;
    if (jpy < 1) return `≈ ¥${jpy.toFixed(2)}`;
    if (jpy < 10) return `≈ ¥${jpy.toFixed(1)}`;
    return `≈ ¥${Math.round(jpy).toLocaleString('ja-JP')}`;
  }
  return `≈ $${usd.toFixed(4)}`;
}

export function UsageBadge({ usage, model, lang = 'ja' }: Props) {
  const rate = MODEL_RATES[model];
  const cost =
    (usage.inputTokens * rate.in +
      usage.outputTokens * rate.out +
      usage.cacheReadTokens * rate.cacheRead +
      usage.cacheCreationTokens * rate.in * 1.25) /
    1_000_000;

  const total = usage.inputTokens + usage.cacheReadTokens + usage.cacheCreationTokens;
  return (
    <div className="text-fg-subtle flex items-center gap-2 text-xs">
      <Sparkles className="h-3.5 w-3.5" />
      <span className="tabular-nums">
        in {total.toLocaleString()} · out {usage.outputTokens.toLocaleString()}
      </span>
      {usage.cacheReadTokens > 0 ? (
        <span className="text-success">cache {usage.cacheReadTokens.toLocaleString()}</span>
      ) : null}
      <span className="ml-auto tabular-nums">{formatCost(cost, lang)}</span>
      {lang === 'ja' ? (
        <span className="text-fg-subtle text-[10px]" title="1ドル=150円で換算">
          (150¥/$)
        </span>
      ) : null}
    </div>
  );
}
