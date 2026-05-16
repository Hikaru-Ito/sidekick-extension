#!/usr/bin/env node
/**
 * Automated smoke test for the Sidekick extension.
 *
 * Boots a clean Chromium with the built extension loaded, opens the popup,
 * exercises the auto-reload feature, and captures screenshots.
 *
 * Requires `playwright` (resolved via npx). Designed for local + CI use; never
 * required by the regular dev flow.
 *
 * Usage:
 *   node scripts/verify-extension.mjs [--keep-open]
 */
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as wait } from 'node:timers/promises';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const extensionDir = resolve(repoRoot, 'apps/extension/.output/chrome-mv3');
const userDataDir = resolve(repoRoot, '.tmp/chrome-profile');
const screenshotDir = resolve(repoRoot, '.tmp/verify-screenshots');

const keepOpen = process.argv.includes('--keep-open');

function log(step, msg) {
  console.log(`\x1b[36m[${step}]\x1b[0m ${msg}`);
}
function ok(msg) {
  console.log(`\x1b[32m✓\x1b[0m ${msg}`);
}
function fail(msg) {
  console.error(`\x1b[31m✗\x1b[0m ${msg}`);
}

async function main() {
  log('setup', `Extension: ${extensionDir}`);
  rmSync(userDataDir, { recursive: true, force: true });
  mkdirSync(userDataDir, { recursive: true });
  mkdirSync(screenshotDir, { recursive: true });

  log('launch', 'Starting Chromium with the extension loaded');
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chromium',
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  // 1. Discover the service worker → derive the extension id.
  log('discover', 'Locating the service worker');
  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker', { timeout: 10_000 });
  }
  const extensionId = new URL(serviceWorker.url()).host;
  ok(`Extension id: ${extensionId}`);

  // 2. Open a target page so chrome.tabs.query has something to grab.
  log('target', 'Opening example.com as the target tab');
  const targetPage = await context.newPage();
  await targetPage.goto('https://example.com', { waitUntil: 'domcontentloaded' });
  const targetTabId = await serviceWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: 'https://example.com/*' });
    return tab?.id ?? null;
  });
  if (!targetTabId) {
    throw new Error('Target tab not found via chrome.tabs.query');
  }
  ok(`Target tab id: ${targetTabId}`);

  // 3. Open the popup.
  log('popup', 'Opening the popup');
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 400, height: 640 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.waitForLoadState('networkidle');
  await wait(500);

  // The popup expects an "active tab" — populate the cached one for the panel.
  await popup.evaluate(async (tabId) => {
    const orig = chrome.tabs.query.bind(chrome.tabs);
    // @ts-expect-error patch for test
    chrome.tabs.query = async (params) => {
      if (params && params.active) {
        const t = await orig({});
        const match = t.find((tab) => tab.id === tabId);
        return match ? [match] : [];
      }
      return orig(params);
    };
  }, targetTabId);

  await popup.screenshot({ path: resolve(screenshotDir, '01-home.png') });
  ok('Captured 01-home.png (home view with category-grouped features)');

  // 4. Sanity: feature list should mention Auto Reload (English UI strings).
  const homeTitleVisible = await popup.locator('text=/自動|Auto|定期/').first().isVisible();
  if (!homeTitleVisible) {
    throw new Error('Feature menu did not render');
  }
  ok('Feature menu rendered');

  // 5. Click into Auto Reload.
  log('feature', 'Opening the Auto Reload panel');
  await popup.locator('text=定期リロード').first().click();
  await wait(300);
  await popup.screenshot({ path: resolve(screenshotDir, '02-auto-reload-panel.png') });
  ok('Captured 02-auto-reload-panel.png');

  // 6. Click the 15-second preset to trigger setTabReload via the popup.
  log('feature', 'Applying the 15-second preset');
  await popup.locator('button:has-text("15秒")').first().click();
  await wait(500);
  await popup.screenshot({ path: resolve(screenshotDir, '03-after-preset.png') });
  ok('Captured 03-after-preset.png');

  // 7. Verify storage state via the service worker.
  log('verify', 'Inspecting chrome.storage.local');
  const stored = await serviceWorker.evaluate(async () => {
    const k = 'feature:auto-reload:config';
    const res = await chrome.storage.local.get(k);
    return res[k] ?? null;
  });

  if (!stored) {
    throw new Error('Expected feature:auto-reload:config to be present');
  }
  if (!stored.enabled) {
    throw new Error('Expected enabled=true after preset click');
  }
  const tabEntry = stored.tabs?.[targetTabId];
  if (!tabEntry) {
    throw new Error(`Expected tabs[${targetTabId}] to be set`);
  }
  if (tabEntry.mode?.kind !== 'interval' || tabEntry.mode.intervalSeconds !== 15) {
    throw new Error(
      `Expected interval mode with 15s, got ${JSON.stringify(tabEntry.mode)}`,
    );
  }
  ok('Storage holds enabled=true, interval mode @ 15s for the target tab');

  // 8. Confirm an alarm or short-interval timer was scheduled.
  //    15 sec is below the chrome.alarms 1-minute floor, so the codebase uses
  //    setTimeout instead. We rely on a forced reload trigger to keep the test
  //    deterministic: wait long enough for at least one reload to happen.
  log('verify', 'Waiting for the first reload (≤ 20 s)');
  const initialUrlChange = targetPage.waitForEvent('framenavigated', {
    predicate: (f) => f === targetPage.mainFrame() && f.url().includes('example.com'),
    timeout: 25_000,
  });
  await initialUrlChange;
  ok('Target tab reloaded');

  // 9. Confirm nextReloadAt advanced.
  const updated = await serviceWorker.evaluate(async () => {
    const k = 'feature:auto-reload:config';
    const res = await chrome.storage.local.get(k);
    return res[k] ?? null;
  });
  const advanced = updated.tabs?.[targetTabId]?.nextReloadAt;
  if (!advanced || advanced <= stored.tabs[targetTabId].nextReloadAt) {
    throw new Error('nextReloadAt did not advance after the reload');
  }
  ok('nextReloadAt advanced after the reload');

  // 10. Stop the schedule by clicking the toggle.
  log('feature', 'Stopping the schedule');
  await popup.locator('[role="switch"]').first().click();
  await wait(300);
  await popup.screenshot({ path: resolve(screenshotDir, '04-after-stop.png') });

  const final = await serviceWorker.evaluate(async () => {
    const res = await chrome.storage.local.get('feature:auto-reload:config');
    return res['feature:auto-reload:config'] ?? null;
  });
  const stillThere = final?.tabs?.[targetTabId];
  if (stillThere) {
    throw new Error('Tab entry was expected to be cleared after toggle off');
  }
  ok('Tab entry cleared from storage');

  // 11. Switch to schedule mode and apply a mock schedule (Tue, Thu @ 09:00).
  log('feature', 'Switching to schedule mode');
  await popup.locator('button[role="tab"]:has-text("時刻を指定")').first().click();
  await wait(200);
  await popup.screenshot({ path: resolve(screenshotDir, '05-schedule-default.png') });

  log('feature', 'Editing days and times');
  // Clear default (weekday) selection by tapping the "毎日" preset then "週末"? Simpler:
  // explicitly apply the "週末" preset.
  await popup.locator('button:has-text("週末")').first().click();
  await wait(150);
  // Add a 21:30 time.
  await popup.locator('input[type="time"]').first().fill('21:30');
  await popup.locator('button:has-text("追加")').first().click();
  await wait(200);
  await popup.screenshot({ path: resolve(screenshotDir, '06-schedule-edited.png') });

  log('feature', 'Starting the schedule');
  await popup.locator('button:has-text("スケジュールを開始")').first().click();
  await wait(500);
  await popup.screenshot({ path: resolve(screenshotDir, '07-schedule-running.png') });

  const scheduled = await serviceWorker.evaluate(async () => {
    const res = await chrome.storage.local.get('feature:auto-reload:config');
    return res['feature:auto-reload:config'] ?? null;
  });
  const schedEntry = scheduled?.tabs?.[targetTabId];
  if (!schedEntry || schedEntry.mode?.kind !== 'schedule') {
    throw new Error(`Expected schedule mode, got ${JSON.stringify(schedEntry?.mode)}`);
  }
  const dayList = (schedEntry.mode.daysOfWeek || []).slice().sort();
  if (JSON.stringify(dayList) !== JSON.stringify([0, 6])) {
    throw new Error(`Expected daysOfWeek=[0,6] (weekend), got ${JSON.stringify(dayList)}`);
  }
  const hasTime = (schedEntry.mode.times || []).some(
    (t) => t.hour === 21 && t.minute === 30,
  );
  if (!hasTime) {
    throw new Error(
      `Expected 21:30 in times list, got ${JSON.stringify(schedEntry.mode.times)}`,
    );
  }
  if (!Number.isFinite(schedEntry.nextReloadAt) || schedEntry.nextReloadAt <= Date.now()) {
    throw new Error(`Expected nextReloadAt in the future, got ${schedEntry.nextReloadAt}`);
  }
  ok(`Schedule mode persisted (Sat/Sun @ 21:30, nextReloadAt=${new Date(schedEntry.nextReloadAt).toLocaleString()})`);

  // 12. Stop the schedule.
  log('feature', 'Stopping the schedule');
  await popup.locator('[role="switch"]').first().click();
  await wait(300);
  const cleared = await serviceWorker.evaluate(async () => {
    const res = await chrome.storage.local.get('feature:auto-reload:config');
    return res['feature:auto-reload:config'] ?? null;
  });
  if (cleared?.tabs?.[targetTabId]) {
    throw new Error('Schedule entry should be cleared after toggle off');
  }
  ok('Schedule cleared');

  if (keepOpen) {
    log('done', 'All checks passed. Leaving Chromium open (--keep-open).');
  } else {
    await context.close();
    log('done', 'All checks passed. Chromium closed.');
  }
}

main().catch(async (err) => {
  fail(err?.stack ?? String(err));
  process.exit(1);
});
