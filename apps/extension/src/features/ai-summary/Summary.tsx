import { useAISummarySettings } from './hooks';

export function AISummarySummary() {
  const settings = useAISummarySettings();
  if (!settings.anthropicApiKey) {
    return <span className="text-fg-subtle text-xs">未設定</span>;
  }
  return <span className="text-fg-muted text-xs">Anthropic 接続済</span>;
}
