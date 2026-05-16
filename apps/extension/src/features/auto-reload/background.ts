import { clearTabReload, readConfig, setTabReload, subscribeConfig } from './storage';
import { computeNextFire } from './types';

const ALARM_PREFIX = 'sidekick:auto-reload:';
/** chrome.alarms enforces a 1-minute minimum on `when`; anything sooner runs via setTimeout. */
const ALARM_MIN_DELAY_MS = 60_000;
/** Maximum delay we'll keep as an in-process setTimeout (5 minutes). */
const SHORT_TIMER_CEILING_MS = 5 * 60_000;

function alarmName(tabId: number): string {
  return `${ALARM_PREFIX}${tabId}`;
}

function parseTabIdFromAlarm(name: string): number | null {
  if (!name.startsWith(ALARM_PREFIX)) return null;
  const id = Number(name.slice(ALARM_PREFIX.length));
  return Number.isFinite(id) ? id : null;
}

const shortIntervalTimers = new Map<number, ReturnType<typeof setTimeout>>();

function clearShortTimer(tabId: number) {
  const t = shortIntervalTimers.get(tabId);
  if (t) {
    clearTimeout(t);
    shortIntervalTimers.delete(tabId);
  }
}

async function scheduleFire(tabId: number, fireAt: number) {
  const delay = fireAt - Date.now();
  if (delay <= 0) {
    // Past due — fire immediately.
    await reloadTab(tabId);
    return;
  }
  if (delay < ALARM_MIN_DELAY_MS && delay <= SHORT_TIMER_CEILING_MS) {
    // chrome.alarms can't go below 1 minute; use setTimeout for sub-minute fires.
    chrome.alarms.clear(alarmName(tabId));
    clearShortTimer(tabId);
    const timer = setTimeout(() => {
      void reloadTab(tabId);
    }, delay);
    shortIntervalTimers.set(tabId, timer);
  } else {
    clearShortTimer(tabId);
    chrome.alarms.create(alarmName(tabId), { when: fireAt });
  }
}

async function reloadTab(tabId: number) {
  try {
    await chrome.tabs.reload(tabId, { bypassCache: false });
  } catch {
    // Tab is closed or otherwise unreachable; clean up state.
    await clearTabReload(tabId);
    chrome.alarms.clear(alarmName(tabId));
    clearShortTimer(tabId);
    return;
  }
  // After reloading, compute the next fire time and reschedule.
  const cfg = await readConfig();
  const state = cfg.tabs[tabId];
  if (!cfg.enabled || !state) return;
  const next = computeNextFire(state.mode, Date.now());
  if (next == null) {
    // Schedule became invalid (e.g. all times removed); leave it idle.
    return;
  }
  await setTabReload({ ...state, nextReloadAt: next });
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
    if (!cfg.enabled || !cfg.tabs[tabId]) clearShortTimer(tabId);
  }
  if (!cfg.enabled) return;
  for (const state of Object.values(cfg.tabs)) {
    const next = computeNextFire(state.mode, Date.now());
    if (next != null) {
      await scheduleFire(state.tabId, next);
    } else {
      chrome.alarms.clear(alarmName(state.tabId));
      clearShortTimer(state.tabId);
    }
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
    clearShortTimer(tabId);
  });

  subscribeConfig(() => {
    void reconcileAllAlarms();
  });

  // Restore state on service-worker startup.
  void reconcileAllAlarms();
}
