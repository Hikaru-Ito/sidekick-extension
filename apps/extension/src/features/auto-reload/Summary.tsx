import { useAutoReloadConfig } from './hooks';
import { formatInterval } from './types';

export function AutoReloadSummary() {
  const cfg = useAutoReloadConfig();
  const count = Object.keys(cfg.tabs).length;
  if (!cfg.enabled || count === 0) {
    return <span className="text-fg-subtle text-xs">未設定</span>;
  }
  return (
    <span className="text-fg-muted text-xs">
      {count}タブ · {formatInterval(cfg.intervalSeconds)}
    </span>
  );
}
