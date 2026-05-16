#!/usr/bin/env node
/**
 * Reproduce / investigate the schedule-mode rapid-reload bug.
 *
 * Boots Chromium with the extension loaded, configures a schedule that
 * targets the very next minute, and counts how many tab reloads happen
 * within 90 seconds. Prints service-worker console output to help locate
 * the source of the loop.
 *
 * Run: pnpm --filter @sidekick/extension build && node scripts/repro-schedule-bug.mjs
 */
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as wait } from 'node:timers/promises';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const extensionDir = resolve(repoRoot, 'apps/extension/.output/chrome-mv3');
const userDataDir = resolve(repoRoot, '.tmp/repro-profile');

rmSync(userDataDir, { recursive: true, force: true });
mkdirSync(userDataDir, { recursive: true });

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  args: [
    `--load-extension=${extensionDir}`,
    `--disable-extensions-except=${extensionDir}`,
    '--no-first-run',
    '--no-default-browser-check',
  ],
});

let [serviceWorker] = context.serviceWorkers();
if (!serviceWorker) {
  serviceWorker = await context.waitForEvent('serviceworker', { timeout: 10_000 });
}
const extensionId = new URL(serviceWorker.url()).host;
console.log(`[repro] Extension id: ${extensionId}`);

serviceWorker.on('console', (msg) => {
  console.log(`[SW ${msg.type()}]`, msg.text());
});

const target = await context.newPage();
await target.goto('https://example.com', { waitUntil: 'domcontentloaded' });
const tabId = await serviceWorker.evaluate(async () => {
  const [t] = await chrome.tabs.query({ url: 'https://example.com/*' });
  return t?.id ?? null;
});
console.log(`[repro] Target tab id: ${tabId}`);

let reloadCount = 0;
const reloadTimes = [];
target.on('framenavigated', (frame) => {
  if (frame !== target.mainFrame()) return;
  reloadCount += 1;
  const t = new Date().toISOString();
  reloadTimes.push(t);
  console.log(`[reload] #${reloadCount} at ${t}`);
});

const popup = await context.newPage();
await popup.setViewportSize({ width: 380, height: 640 });
await popup.goto(`chrome-extension://${extensionId}/popup.html`);
await popup.waitForLoadState('domcontentloaded');
await wait(500);

// Patch chrome.tabs.query so the panel treats `tabId` as the active tab.
await popup.evaluate(async (tabId) => {
  const orig = chrome.tabs.query.bind(chrome.tabs);
  // @ts-expect-error patch
  chrome.tabs.query = async (params) => {
    if (params && params.active) {
      const all = await orig({});
      const m = all.find((t) => t.id === tabId);
      return m ? [m] : [];
    }
    return orig(params);
  };
}, tabId);

await popup.locator('text=定期リロード').first().click();
await wait(600);
await popup.locator('button[role="tab"]:has-text("時刻を指定")').first().click();
await wait(400);

// Pick all days so today is included no matter what.
await popup.locator('button:has-text("毎日")').first().click();
await wait(300);

// SCENARIO env var picks the case being exercised.
//   future  (default): 60s in the future
//   current:           current HH:MM (likely past today already)
//   past:              1 minute ago
//   many:              the past+current+future minutes all at once
const scenario = process.env.SCENARIO ?? 'future';
const now = new Date();
const fmt = (d) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
let target_hhmm;
const extraTimes = [];
if (scenario === 'current') {
  target_hhmm = fmt(now);
} else if (scenario === 'past') {
  target_hhmm = fmt(new Date(now.getTime() - 60_000));
} else if (scenario === 'many') {
  target_hhmm = fmt(now);
  for (let i = -2; i <= 5; i++) {
    if (i === 0) continue;
    extraTimes.push(fmt(new Date(now.getTime() + i * 60_000)));
  }
} else {
  target_hhmm = fmt(new Date(now.getTime() + 60_000));
}
console.log(`[repro] Scenario: ${scenario}`);
console.log(`[repro] Primary time: ${target_hhmm}`);
if (extraTimes.length) console.log(`[repro] Extra times: ${extraTimes.join(', ')}`);

// Remove the default 9:00 so we only have one time.
const defaultRows = await popup.locator('ul li button[aria-label="削除"]').count();
for (let i = 0; i < defaultRows; i++) {
  await popup.locator('ul li button[aria-label="削除"]').first().click();
  await wait(120);
}

await popup.locator('input[type="time"]').first().fill(target_hhmm);
await popup.locator('button:has-text("追加")').first().click();
await wait(300);

for (const extra of extraTimes) {
  await popup.locator('input[type="time"]').first().fill(extra);
  await popup.locator('button:has-text("追加")').first().click();
  await wait(120);
}

await popup.locator('button:has-text("スケジュールを開始")').first().click();
console.log(`[repro] Started. Watching for reloads for 90 seconds…`);

const baseline = reloadCount;
await wait(90_000);
const observed = reloadCount - baseline;

console.log(`\n[repro] Reloads in 90 s: ${observed}`);
console.log(`[repro] Reload timestamps: ${reloadTimes.join(' | ')}`);

if (observed > 2) {
  console.error(`\x1b[31m✗ BUG REPRODUCED: ${observed} reloads in 90 seconds (expected ≤2)\x1b[0m`);
} else {
  console.log(`\x1b[32m✓ OK: ${observed} reload(s) within window\x1b[0m`);
}

const stored = await serviceWorker.evaluate(async () => {
  const res = await chrome.storage.local.get('feature:auto-reload:config');
  return res['feature:auto-reload:config'];
});
console.log(`[repro] Final storage:`, JSON.stringify(stored, null, 2));

const alarms = await serviceWorker.evaluate(async () => chrome.alarms.getAll());
console.log(`[repro] Active alarms:`, JSON.stringify(alarms, null, 2));

await context.close();
