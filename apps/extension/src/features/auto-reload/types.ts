export interface AutoReloadConfig {
  /** 全体ON/OFF */
  enabled: boolean;
  /** リロード間隔 (秒) */
  intervalSeconds: number;
  /** タブごとの設定 (tabIdをキーに) */
  tabs: Record<number, TabReloadState>;
}

export interface TabReloadState {
  tabId: number;
  url: string;
  title: string;
  /** このタブのリロード間隔 (秒) — 未指定なら global を使う */
  intervalSeconds?: number;
  /** いつ開始したか (epoch ms) */
  startedAt: number;
  /** 次のリロード予定時刻 (epoch ms) */
  nextReloadAt: number;
}

export const DEFAULT_AUTO_RELOAD_CONFIG: AutoReloadConfig = {
  enabled: false,
  intervalSeconds: 60,
  tabs: {},
};

/** プリセット間隔 (秒) */
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
export const MAX_INTERVAL_SECONDS = 86_400; // 24h

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
