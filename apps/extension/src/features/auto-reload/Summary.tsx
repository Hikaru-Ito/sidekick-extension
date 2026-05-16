import { useAutoReloadConfig } from './hooks';
import { summarizeMode } from './types';

export function AutoReloadSummary() {
  const cfg = useAutoReloadConfig();
  const tabs = Object.values(cfg.tabs);
  if (!cfg.enabled || tabs.length === 0) {
    return <span className="text-fg-subtle text-xs">未設定</span>;
  }
  if (tabs.length === 1) {
    return <span className="text-fg-muted text-xs">{summarizeMode(tabs[0]!.mode)}</span>;
  }
  return <span className="text-fg-muted text-xs">{tabs.length}タブで実行中</span>;
}
