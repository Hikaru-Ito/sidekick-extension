import { Sparkles } from 'lucide-react';
import type { UsageInfo } from '../lib/anthropic';
import type { AnthropicModelId } from '../types';

interface Props {
  usage: UsageInfo;
  model: AnthropicModelId;
}

// Rough per-1M-token rates (USD) snapshotted from public pricing.
// Educational only — actual billing happens on Anthropic's side.
const MODEL_RATES: Record<AnthropicModelId, { in: number; out: number; cacheRead: number }> = {
  'claude-opus-4-7': { in: 15, out: 75, cacheRead: 1.5 },
  'claude-sonnet-4-6': { in: 3, out: 15, cacheRead: 0.3 },
  'claude-haiku-4-5': { in: 1, out: 5, cacheRead: 0.1 },
};

export function UsageBadge({ usage, model }: Props) {
  const rate = MODEL_RATES[model];
  const cost =
    (usage.inputTokens * rate.in +
      usage.outputTokens * rate.out +
      usage.cacheReadTokens * rate.cacheRead +
      usage.cacheCreationTokens * rate.in * 1.25) /
    1_000_000;

  const total = usage.inputTokens + usage.cacheReadTokens + usage.cacheCreationTokens;
  return (
    <div className="text-fg-subtle flex items-center gap-2 text-[10px]">
      <Sparkles className="h-3 w-3" />
      <span className="tabular-nums">
        in {total.toLocaleString()} · out {usage.outputTokens.toLocaleString()}
      </span>
      {usage.cacheReadTokens > 0 ? (
        <span className="text-success">cache {usage.cacheReadTokens.toLocaleString()}</span>
      ) : null}
      <span className="ml-auto tabular-nums">≈ ${cost.toFixed(4)}</span>
    </div>
  );
}
