export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sun(0) .. Sat(6)

export interface TimeOfDay {
  hour: number; // 0-23
  minute: number; // 0-59
}

export type ReloadMode =
  | { kind: 'interval'; intervalSeconds: number }
  | { kind: 'schedule'; daysOfWeek: DayOfWeek[]; times: TimeOfDay[] };

export interface TabReloadState {
  tabId: number;
  url: string;
  title: string;
  mode: ReloadMode;
  startedAt: number;
  nextReloadAt: number;
}

export interface AutoReloadConfig {
  enabled: boolean;
  /** Default mode used when a tab is added without explicit config. */
  defaultMode: ReloadMode;
  tabs: Record<number, TabReloadState>;
}

export const DEFAULT_INTERVAL_MODE: Extract<ReloadMode, { kind: 'interval' }> = {
  kind: 'interval',
  intervalSeconds: 60,
};

export const DEFAULT_SCHEDULE_MODE: Extract<ReloadMode, { kind: 'schedule' }> = {
  kind: 'schedule',
  daysOfWeek: [1, 2, 3, 4, 5], // Mon..Fri
  times: [{ hour: 9, minute: 0 }],
};

export const DEFAULT_AUTO_RELOAD_CONFIG: AutoReloadConfig = {
  enabled: false,
  defaultMode: DEFAULT_INTERVAL_MODE,
  tabs: {},
};

/** Preset intervals (seconds). Labels are displayed to the user. */
export const RELOAD_PRESETS: { label: string; seconds: number }[] = [
  { label: '15秒', seconds: 15 },
  { label: '30秒', seconds: 30 },
  { label: '1分', seconds: 60 },
  { label: '3分', seconds: 180 },
  { label: '5分', seconds: 300 },
  { label: '10分', seconds: 600 },
  { label: '30分', seconds: 1800 },
  { label: '1時間', seconds: 3600 },
];

export const MIN_INTERVAL_SECONDS = 5;
export const MAX_INTERVAL_SECONDS = 86_400; // 24 hours

/** Day chips, presented Sun..Sat to match JavaScript's Date.getDay(). */
export const DAY_LABELS: { value: DayOfWeek; short: string; long: string }[] = [
  { value: 0, short: '日', long: '日曜' },
  { value: 1, short: '月', long: '月曜' },
  { value: 2, short: '火', long: '火曜' },
  { value: 3, short: '水', long: '水曜' },
  { value: 4, short: '木', long: '木曜' },
  { value: 5, short: '金', long: '金曜' },
  { value: 6, short: '土', long: '土曜' },
];

export const DAY_PRESETS: { label: string; days: DayOfWeek[] }[] = [
  { label: '毎日', days: [0, 1, 2, 3, 4, 5, 6] },
  { label: '平日', days: [1, 2, 3, 4, 5] },
  { label: '週末', days: [0, 6] },
];

export function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s === 0 ? `${m}分` : `${m}分${s}秒`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

export function formatTimeOfDay(t: TimeOfDay): string {
  return `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
}

export function parseTimeOfDay(value: string): TimeOfDay | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export function isScheduleValid(mode: Extract<ReloadMode, { kind: 'schedule' }>): boolean {
  return mode.daysOfWeek.length > 0 && mode.times.length > 0;
}

export function sortTimes(times: TimeOfDay[]): TimeOfDay[] {
  return [...times].sort((a, b) => a.hour - b.hour || a.minute - b.minute);
}

/**
 * Compute the next time the schedule should fire, relative to `from` (epoch ms).
 * Returns null when the schedule is empty/invalid.
 */
export function computeNextFire(mode: ReloadMode, from: number): number | null {
  if (mode.kind === 'interval') {
    const seconds = Math.max(MIN_INTERVAL_SECONDS, mode.intervalSeconds);
    return from + seconds * 1000;
  }
  if (!isScheduleValid(mode)) return null;
  const daySet = new Set(mode.daysOfWeek);
  const sorted = sortTimes(mode.times);
  // Look up to 8 days ahead to handle week-wraparound.
  for (let offset = 0; offset < 8; offset++) {
    const candidate = new Date(from);
    candidate.setDate(candidate.getDate() + offset);
    if (!daySet.has(candidate.getDay() as DayOfWeek)) continue;
    for (const t of sorted) {
      const fire = new Date(candidate);
      fire.setHours(t.hour, t.minute, 0, 0);
      if (fire.getTime() > from) return fire.getTime();
    }
  }
  return null;
}

export function summarizeMode(mode: ReloadMode): string {
  if (mode.kind === 'interval') {
    return `${formatInterval(mode.intervalSeconds)}毎`;
  }
  if (!isScheduleValid(mode)) return '未設定';
  const days = mode.daysOfWeek
    .slice()
    .sort()
    .map((d) => DAY_LABELS[d]?.short ?? '')
    .join('/');
  const times = sortTimes(mode.times).map(formatTimeOfDay).join(', ');
  return `${days} ${times}`;
}
