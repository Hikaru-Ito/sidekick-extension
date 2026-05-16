import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, RefreshCw, Timer, X, Zap } from 'lucide-react';
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
  DEFAULT_INTERVAL_MODE,
  DEFAULT_SCHEDULE_MODE,
  MAX_INTERVAL_SECONDS,
  MIN_INTERVAL_SECONDS,
  RELOAD_PRESETS,
  computeNextFire,
  formatInterval,
  formatTimeOfDay,
  isScheduleValid,
  sortTimes,
  summarizeMode,
  type DayOfWeek,
  type ReloadMode,
  type TimeOfDay,
} from './types';
import { ScheduleEditor } from './ScheduleEditor';

function Countdown({ nextReloadAt }: { nextReloadAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = Math.max(0, Math.ceil((nextReloadAt - now) / 1000));
  if (remaining >= 60) {
    const target = new Date(nextReloadAt);
    const sameDay = target.toDateString() === new Date(now).toDateString();
    const timeStr = formatTimeOfDay({
      hour: target.getHours(),
      minute: target.getMinutes(),
    });
    const prefix = sameDay ? '今日' : `${target.getMonth() + 1}/${target.getDate()}`;
    return <span className="tabular-nums">{`${prefix} ${timeStr}`}</span>;
  }
  return <span className="tabular-nums">あと {formatInterval(remaining)}</span>;
}

function ModeTabs({
  value,
  onChange,
}: {
  value: 'interval' | 'schedule';
  onChange: (next: 'interval' | 'schedule') => void;
}) {
  const tabs: { id: 'interval' | 'schedule'; label: string; icon: typeof Timer }[] = [
    { id: 'interval', label: '間隔で繰り返し', icon: Timer },
    { id: 'schedule', label: '時刻を指定', icon: CalendarClock },
  ];
  return (
    <div role="tablist" className="bg-surface-muted/70 border-border flex rounded-lg border p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = value === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'duration-fast flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all',
              isActive
                ? 'bg-surface-elevated text-fg-default shadow-xs'
                : 'text-fg-muted hover:text-fg-default',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function AutoReloadPanel() {
  const config = useAutoReloadConfig();
  const activeTab = useActiveTab();
  const [customInput, setCustomInput] = useState('');

  const activeState = activeTab?.id != null ? config.tabs[activeTab.id] : undefined;
  const runningMode = activeState?.mode;
  const isRunning = !!activeState && config.enabled;

  // Which tab is selected. Defaults to the running mode, or 'interval'.
  const [selectedTab, setSelectedTab] = useState<'interval' | 'schedule'>(
    runningMode?.kind ?? 'interval',
  );

  // Keep tab in sync when the running mode changes from outside.
  useEffect(() => {
    if (runningMode) setSelectedTab(runningMode.kind);
  }, [runningMode?.kind]);

  // Draft for schedule editor (only used when editing schedule).
  const [scheduleDraft, setScheduleDraft] = useState<{
    daysOfWeek: DayOfWeek[];
    times: TimeOfDay[];
  }>(() =>
    runningMode?.kind === 'schedule'
      ? { daysOfWeek: runningMode.daysOfWeek, times: runningMode.times }
      : { daysOfWeek: DEFAULT_SCHEDULE_MODE.daysOfWeek, times: DEFAULT_SCHEDULE_MODE.times },
  );

  // If running schedule changes (e.g. switching tabs), sync the draft.
  useEffect(() => {
    if (runningMode?.kind === 'schedule') {
      setScheduleDraft({
        daysOfWeek: runningMode.daysOfWeek,
        times: runningMode.times,
      });
    }
  }, [
    runningMode?.kind === 'schedule' ? runningMode.daysOfWeek.join(',') : null,
    runningMode?.kind === 'schedule'
      ? runningMode.times.map((t) => `${t.hour}:${t.minute}`).join(',')
      : null,
  ]);

  const otherTabs = useMemo(
    () => Object.values(config.tabs).filter((t) => t.tabId !== activeTab?.id),
    [config.tabs, activeTab?.id],
  );

  const applyMode = async (mode: ReloadMode) => {
    if (!activeTab?.id) return;
    const next = computeNextFire(mode, Date.now());
    if (next == null) return;
    await setTabReload({
      tabId: activeTab.id,
      url: activeTab.url ?? '',
      title: activeTab.title ?? 'Untitled',
      mode,
      startedAt: Date.now(),
      nextReloadAt: next,
    });
    await updateConfig((cfg) => ({ ...cfg, enabled: true, defaultMode: mode }));
  };

  const stopActive = async () => {
    if (!activeTab?.id) return;
    await clearTabReload(activeTab.id);
  };

  const applyInterval = (seconds: number) => {
    const safe = Math.min(
      MAX_INTERVAL_SECONDS,
      Math.max(MIN_INTERVAL_SECONDS, Math.floor(seconds)),
    );
    void applyMode({ kind: 'interval', intervalSeconds: safe });
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(customInput.trim());
    if (!Number.isFinite(n) || n <= 0) return;
    applyInterval(n);
    setCustomInput('');
  };

  const applySchedule = () => {
    const mode: ReloadMode = {
      kind: 'schedule',
      daysOfWeek: scheduleDraft.daysOfWeek,
      times: sortTimes(scheduleDraft.times),
    };
    if (!isScheduleValid(mode)) return;
    void applyMode(mode);
  };

  const activeIntervalSeconds =
    runningMode?.kind === 'interval' ? runningMode.intervalSeconds : null;

  const draftIsValid = isScheduleValid({
    kind: 'schedule',
    daysOfWeek: scheduleDraft.daysOfWeek,
    times: scheduleDraft.times,
  });

  // Has the user changed the schedule draft compared to the running one?
  const scheduleDraftDiffersFromRunning =
    runningMode?.kind === 'schedule'
      ? scheduleDraft.daysOfWeek.length !== runningMode.daysOfWeek.length ||
        scheduleDraft.times.length !== runningMode.times.length ||
        scheduleDraft.daysOfWeek.some((d) => !runningMode.daysOfWeek.includes(d)) ||
        scheduleDraft.times.some(
          (t) => !runningMode.times.some((rt) => rt.hour === t.hour && rt.minute === t.minute),
        )
      : true;

  return (
    <div className="flex flex-col gap-3">
      {/* Status card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex h-2 w-2 rounded-full',
                    isRunning ? 'bg-success animate-pulse' : 'bg-fg-subtle',
                  )}
                />
                <p className="text-fg-muted text-xs font-medium">
                  {isRunning
                    ? `実行中 · ${runningMode ? summarizeMode(runningMode) : ''}`
                    : '停止中'}
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
              checked={isRunning}
              onCheckedChange={(checked) => {
                if (checked) {
                  if (selectedTab === 'interval') {
                    applyInterval(activeIntervalSeconds ?? DEFAULT_INTERVAL_MODE.intervalSeconds);
                  } else if (draftIsValid) {
                    applySchedule();
                  }
                } else {
                  void stopActive();
                }
              }}
              aria-label="Auto reload toggle"
              disabled={selectedTab === 'schedule' && !draftIsValid}
            />
          </div>

          {isRunning && activeState ? (
            <div className="bg-surface-muted mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-xs">
              <Timer className="text-accent-600 h-3.5 w-3.5" />
              <span className="text-fg-muted">次のリロード</span>
              <span className="text-fg-default ml-auto font-semibold">
                <Countdown nextReloadAt={activeState.nextReloadAt} />
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Mode tabs */}
      <ModeTabs value={selectedTab} onChange={setSelectedTab} />

      {/* Mode body */}
      {selectedTab === 'interval' ? (
        <>
          <div>
            <SectionHeader title="プリセット" />
            <div className="grid grid-cols-4 gap-1.5">
              {RELOAD_PRESETS.map((preset) => {
                const isActive = isRunning && activeIntervalSeconds === preset.seconds;
                return (
                  <button
                    key={preset.seconds}
                    onClick={() => applyInterval(preset.seconds)}
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
              5秒〜24時間まで設定可。1分未満は setTimeout、それ以上は chrome.alarms を使用。
            </p>
          </div>
        </>
      ) : (
        <>
          <ScheduleEditor
            daysOfWeek={scheduleDraft.daysOfWeek}
            times={scheduleDraft.times}
            onChange={setScheduleDraft}
          />
          <Button
            onClick={applySchedule}
            disabled={!draftIsValid || !scheduleDraftDiffersFromRunning}
            variant="primary"
            size="md"
          >
            <Check className="h-3.5 w-3.5" />
            {runningMode?.kind === 'schedule' ? 'スケジュールを更新' : 'スケジュールを開始'}
          </Button>
          <p className="text-fg-subtle px-1 text-[11px]">
            選択した曜日の指定時刻にタブをリロードします (端末のタイムゾーン)。
          </p>
        </>
      )}

      {/* Other tabs */}
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
                  description={summarizeMode(tab.mode)}
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
