import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Timer, X, Zap } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  ListItem,
  SectionHeader,
  Switch,
  cn,
} from '@sidekick/ui-kit';
import { useActiveTab, useAutoReloadConfig } from './hooks';
import { clearTabReload, setTabReload, updateConfig } from './storage';
import {
  MAX_INTERVAL_SECONDS,
  MIN_INTERVAL_SECONDS,
  RELOAD_PRESETS,
  formatInterval,
} from './types';

function Countdown({ nextReloadAt }: { nextReloadAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = Math.max(0, Math.ceil((nextReloadAt - now) / 1000));
  return <span className="tabular-nums">{formatInterval(remaining)}</span>;
}

export function AutoReloadPanel() {
  const config = useAutoReloadConfig();
  const activeTab = useActiveTab();
  const [customInput, setCustomInput] = useState('');

  const activeState = activeTab?.id != null ? config.tabs[activeTab.id] : undefined;
  const isReloadingActive = !!activeState && config.enabled;
  const activeInterval = activeState?.intervalSeconds ?? config.intervalSeconds;

  const otherTabs = useMemo(
    () => Object.values(config.tabs).filter((t) => t.tabId !== activeTab?.id),
    [config.tabs, activeTab?.id],
  );

  const applyInterval = async (seconds: number) => {
    if (!activeTab?.id) return;
    const safe = Math.min(
      MAX_INTERVAL_SECONDS,
      Math.max(MIN_INTERVAL_SECONDS, Math.floor(seconds)),
    );
    await setTabReload({
      tabId: activeTab.id,
      url: activeTab.url ?? '',
      title: activeTab.title ?? 'Untitled',
      intervalSeconds: safe,
      startedAt: Date.now(),
      nextReloadAt: Date.now() + safe * 1000,
    });
    await updateConfig((cfg) => ({ ...cfg, enabled: true }));
  };

  const stopActive = async () => {
    if (!activeTab?.id) return;
    await clearTabReload(activeTab.id);
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed) return;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) return;
    await applyInterval(n);
    setCustomInput('');
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 現在タブの状態 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex h-2 w-2 rounded-full',
                    isReloadingActive ? 'bg-success animate-pulse' : 'bg-fg-subtle',
                  )}
                />
                <p className="text-fg-muted text-xs font-medium">
                  {isReloadingActive ? '実行中' : '停止中'}
                </p>
              </div>
              <h3 className="text-fg-default mt-1.5 truncate text-sm font-semibold">
                {activeTab?.title ?? 'タブが選択されていません'}
              </h3>
              {activeTab?.url ? (
                <p className="text-fg-subtle mt-0.5 truncate text-xs">{activeTab.url}</p>
              ) : null}
            </div>
            <Switch
              checked={isReloadingActive}
              onCheckedChange={(checked) => {
                if (checked) void applyInterval(activeInterval);
                else void stopActive();
              }}
              aria-label="Auto reload toggle"
            />
          </div>

          {isReloadingActive && activeState ? (
            <div className="bg-surface-muted mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-xs">
              <Timer className="text-accent-600 h-3.5 w-3.5" />
              <span className="text-fg-muted">次のリロードまで</span>
              <span className="text-fg-default ml-auto font-semibold">
                <Countdown nextReloadAt={activeState.nextReloadAt} />
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* プリセット */}
      <div>
        <SectionHeader title="プリセット" />
        <div className="grid grid-cols-4 gap-1.5">
          {RELOAD_PRESETS.map((preset) => {
            const isActive = isReloadingActive && activeInterval === preset.seconds;
            return (
              <button
                key={preset.seconds}
                onClick={() => void applyInterval(preset.seconds)}
                className={cn(
                  'duration-fast rounded-md border px-2 py-2 text-xs font-medium transition-all',
                  isActive
                    ? 'border-accent-500 bg-accent-500/10 text-accent-700 dark:text-accent-300 shadow-xs'
                    : 'border-border bg-surface-elevated text-fg-muted hover:bg-surface-muted hover:text-fg-default',
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* カスタム */}
      <div>
        <SectionHeader title="カスタム" />
        <form onSubmit={handleCustomSubmit} className="flex gap-1.5">
          <Input
            type="number"
            min={MIN_INTERVAL_SECONDS}
            max={MAX_INTERVAL_SECONDS}
            placeholder="秒数を入力 (例: 45)"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" variant="secondary" size="md">
            <Zap className="h-3.5 w-3.5" />
            適用
          </Button>
        </form>
        <p className="text-fg-subtle mt-1.5 px-1 text-[11px]">
          5秒〜24時間まで設定可。1分未満はsetTimeout、それ以上はchrome.alarmsを使用します。
        </p>
      </div>

      {/* 他のタブ */}
      {otherTabs.length > 0 ? (
        <div>
          <SectionHeader
            title={`他のタブ (${otherTabs.length})`}
            trailing={
              <Badge tone="iris">
                <RefreshCw className="h-2.5 w-2.5" />
                Active
              </Badge>
            }
          />
          <Card>
            <div className="divide-border divide-y">
              {otherTabs.map((tab) => (
                <ListItem
                  key={tab.tabId}
                  icon={<RefreshCw className="h-4 w-4" />}
                  iconTone="iris"
                  title={tab.title || 'Untitled'}
                  description={`${formatInterval(
                    tab.intervalSeconds ?? config.intervalSeconds,
                  )}毎 · 次回 `}
                  trailing={
                    <button
                      onClick={() => void clearTabReload(tab.tabId)}
                      className="text-fg-subtle hover:bg-surface-muted hover:text-danger flex h-7 w-7 items-center justify-center rounded-md transition-colors"
                      aria-label="停止"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  }
                  className="!rounded-none first:!rounded-t-lg last:!rounded-b-lg"
                />
              ))}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
