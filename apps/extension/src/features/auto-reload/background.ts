import { clearTabReload, readConfig, setTabReload, subscribeConfig } from './storage';
import { MIN_INTERVAL_SECONDS } from './types';

const ALARM_PREFIX = 'sidekick:auto-reload:';

function alarmName(tabId: number): string {
  return `${ALARM_PREFIX}${tabId}`;
}

function parseTabIdFromAlarm(name: string): number | null {
  if (!name.startsWith(ALARM_PREFIX)) return null;
  const id = Number(name.slice(ALARM_PREFIX.length));
  return Number.isFinite(id) ? id : null;
}

async function ensureAlarmForTab(tabId: number, seconds: number) {
  const safeSeconds = Math.max(seconds, MIN_INTERVAL_SECONDS);
  // chrome.alarms enforces a 1-minute minimum on periodInMinutes (MV3).
  // For sub-minute intervals we fall back to setTimeout loops.
  if (safeSeconds >= 60) {
    chrome.alarms.create(alarmName(tabId), {
      periodInMinutes: safeSeconds / 60,
      delayInMinutes: safeSeconds / 60,
    });
  } else {
    chrome.alarms.clear(alarmName(tabId));
    scheduleShortInterval(tabId, safeSeconds);
  }
}

const shortIntervalTimers = new Map<number, ReturnType<typeof setTimeout>>();

function scheduleShortInterval(tabId: number, seconds: number) {
  const existing = shortIntervalTimers.get(tabId);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(async () => {
    await reloadTab(tabId);
    const cfg = await readConfig();
    const state = cfg.tabs[tabId];
    if (state && cfg.enabled) {
      const interval = state.intervalSeconds ?? cfg.intervalSeconds;
      scheduleShortInterval(tabId, interval);
    }
  }, seconds * 1000);
  shortIntervalTimers.set(tabId, timer);
}

async function reloadTab(tabId: number) {
  try {
    await chrome.tabs.reload(tabId, { bypassCache: false });
    const cfg = await readConfig();
    const state = cfg.tabs[tabId];
    if (state) {
      const interval = state.intervalSeconds ?? cfg.intervalSeconds;
      await setTabReload({
        ...state,
        nextReloadAt: Date.now() + interval * 1000,
      });
    }
  } catch (err) {
    // Tab is closed or otherwise unreachable; clean up state.
    await clearTabReload(tabId);
    chrome.alarms.clear(alarmName(tabId));
    const timer = shortIntervalTimers.get(tabId);
    if (timer) {
      clearTimeout(timer);
      shortIntervalTimers.delete(tabId);
    }
  }
}

async function reconcileAllAlarms() {
  const cfg = await readConfig();
  const allAlarms = await chrome.alarms.getAll();
  // Drop alarms for tabs that are no longer configured.
  for (const a of allAlarms) {
    const tabId = parseTabIdFromAlarm(a.name);
    if (tabId == null) continue;
    if (!cfg.enabled || !cfg.tabs[tabId]) {
      chrome.alarms.clear(a.name);
    }
  }
  // Same cleanup for in-process short-interval timers.
  for (const tabId of shortIntervalTimers.keys()) {
    if (!cfg.enabled || !cfg.tabs[tabId]) {
      clearTimeout(shortIntervalTimers.get(tabId));
      shortIntervalTimers.delete(tabId);
    }
  }
  // Schedule alarms for every tab still in the config.
  if (!cfg.enabled) return;
  for (const state of Object.values(cfg.tabs)) {
    const seconds = state.intervalSeconds ?? cfg.intervalSeconds;
    await ensureAlarmForTab(state.tabId, seconds);
  }
}

export function registerAutoReloadBackground() {
  chrome.alarms.onAlarm.addListener((alarm) => {
    const tabId = parseTabIdFromAlarm(alarm.name);
    if (tabId != null) void reloadTab(tabId);
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    void clearTabReload(tabId);
    chrome.alarms.clear(alarmName(tabId));
    const timer = shortIntervalTimers.get(tabId);
    if (timer) {
      clearTimeout(timer);
      shortIntervalTimers.delete(tabId);
    }
  });

  subscribeConfig(() => {
    void reconcileAllAlarms();
  });

  // Restore state on service-worker startup.
  void reconcileAllAlarms();
}
