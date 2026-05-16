import { clearTabReload, readConfig, setTabReload, subscribeConfig } from './storage';
import { computeNextFire } from './types';

const ALARM_PREFIX = 'sidekick:auto-reload:';
/** chrome.alarms enforces a 1-minute minimum on `when`; anything sooner runs via setTimeout. */
const ALARM_MIN_DELAY_MS = 60_000;
/** Maximum delay we'll keep as an in-process setTimeout (5 minutes). */
const SHORT_TIMER_CEILING_MS = 5 * 60_000;
/** Smallest delay we ever schedule. Prevents tight reload loops if computeNextFire
 *  ever returns a value at-or-before Date.now() (which would otherwise trip
 *  chrome.alarms's "past `when` fires immediately" behavior). */
const MIN_SCHEDULE_DELAY_MS = 1_000;
/** Minimum time between two reloads for the same tab. A second reload arriving
 *  within this window is dropped — this is a hard backstop against pathological
 *  cascades caused by event re-entry or clock skew. */
const RELOAD_COOLDOWN_MS = 2_000;

function alarmName(tabId: number): string {
  return `${ALARM_PREFIX}${tabId}`;
}

function parseTabIdFromAlarm(name: string): number | null {
  if (!name.startsWith(ALARM_PREFIX)) return null;
  const id = Number(name.slice(ALARM_PREFIX.length));
  return Number.isFinite(id) ? id : null;
}

const shortIntervalTimers = new Map<number, ReturnType<typeof setTimeout>>();
const lastReloadAt = new Map<number, number>();

function clearShortTimer(tabId: number) {
  const t = shortIntervalTimers.get(tabId);
  if (t) {
    clearTimeout(t);
    shortIntervalTimers.delete(tabId);
  }
}

async function scheduleFire(tabId: number, fireAt: number) {
  let delay = fireAt - Date.now();
  if (delay < MIN_SCHEDULE_DELAY_MS) {
    if (delay < 0) {
      console.warn(
        `[auto-reload] fireAt for tab ${tabId} is ${-delay}ms in the past; clamping to ${MIN_SCHEDULE_DELAY_MS}ms`,
      );
    }
    delay = MIN_SCHEDULE_DELAY_MS;
  }
  const effectiveFireAt = Date.now() + delay;

  if (delay < ALARM_MIN_DELAY_MS) {
    // chrome.alarms can't reliably fire under 1 minute; use setTimeout for sub-minute fires.
    chrome.alarms.clear(alarmName(tabId));
    clearShortTimer(tabId);
    const timer = setTimeout(() => {
      void reloadTab(tabId);
    }, delay);
    shortIntervalTimers.set(tabId, timer);
  } else {
    clearShortTimer(tabId);
    chrome.alarms.create(alarmName(tabId), { when: effectiveFireAt });
  }
}

async function reloadTab(tabId: number) {
  const last = lastReloadAt.get(tabId) ?? 0;
  const now = Date.now();
  if (now - last < RELOAD_COOLDOWN_MS) {
    console.warn(
      `[auto-reload] Dropping reload for tab ${tabId} — last fire was ${now - last}ms ago (cooldown ${RELOAD_COOLDOWN_MS}ms).`,
    );
    return;
  }
  lastReloadAt.set(tabId, now);

  try {
    await chrome.tabs.reload(tabId, { bypassCache: false });
  } catch {
    // Tab is closed or otherwise unreachable; clean up state.
    await clearTabReload(tabId);
    chrome.alarms.clear(alarmName(tabId));
    clearShortTimer(tabId);
    lastReloadAt.delete(tabId);
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
  // Clean cooldown bookkeeping for removed tabs.
  for (const tabId of lastReloadAt.keys()) {
    if (!cfg.tabs[tabId]) lastReloadAt.delete(tabId);
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
    lastReloadAt.delete(tabId);
  });

  subscribeConfig(() => {
    void reconcileAllAlarms();
  });

  // Restore state on service-worker startup.
  void reconcileAllAlarms();
}
