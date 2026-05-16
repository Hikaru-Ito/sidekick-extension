#!/usr/bin/env node
/**
 * Record per-feature demo videos.
 *
 * Discovers `demos/<feature-id>.mjs`, boots Chromium with the built
 * extension loaded, runs each scenario in a fresh context with Playwright's
 * video recording enabled, and writes the popup WebM to
 * `apps/landing/public/demos/<feature-id>.webm`.
 *
 * Usage:
 *   pnpm record:demos
 *   pnpm record:demos -- --only auto-reload
 */
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { setTimeout as wait } from 'node:timers/promises';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const extensionDir = resolve(repoRoot, 'apps/extension/.output/chrome-mv3');
const demosDir = resolve(repoRoot, 'demos');
const tmpRoot = resolve(repoRoot, '.tmp/demo-recording');
const outputDir = resolve(repoRoot, 'apps/landing/public/demos');

const onlyArgIndex = process.argv.indexOf('--only');
const only = onlyArgIndex >= 0 ? process.argv[onlyArgIndex + 1] : null;

function color(code, msg) {
  return `\x1b[${code}m${msg}\x1b[0m`;
}

function log(step, msg) {
  console.log(`${color(36, '[' + step + ']')} ${msg}`);
}

function ok(msg) {
  console.log(`${color(32, '✓')} ${msg}`);
}

async function recordOne(featureId, demoFile) {
  log('record', featureId);
  const featureUserDataDir = resolve(tmpRoot, `profile-${featureId}`);
  const videoDir = resolve(tmpRoot, `video-${featureId}`);
  rmSync(featureUserDataDir, { recursive: true, force: true });
  rmSync(videoDir, { recursive: true, force: true });
  mkdirSync(featureUserDataDir, { recursive: true });
  mkdirSync(videoDir, { recursive: true });

  const context = await chromium.launchPersistentContext(featureUserDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=420,720',
    ],
    viewport: { width: 380, height: 640 },
    recordVideo: { dir: videoDir, size: { width: 380, height: 640 } },
  });

  try {
    // Service worker.
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker', { timeout: 10_000 });
    }
    const extensionId = new URL(serviceWorker.url()).host;

    // Target tab so the feature panels have something to act on.
    const targetPage = await context.newPage();
    await targetPage.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    const targetTabId = await serviceWorker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: 'https://example.com/*' });
      return tab?.id ?? null;
    });
    if (!targetTabId) {
      throw new Error('Failed to locate target tab via chrome.tabs.query');
    }

    // Popup page that we'll actually record.
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 380, height: 640 });
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');
    await wait(500);

    const demo = await import(pathToFileURL(demoFile).href);
    if (typeof demo.runDemo !== 'function') {
      throw new Error(`demos/${featureId}.mjs must export runDemo()`);
    }

    const popupVideoPromise = popup.video()?.path();

    await demo.runDemo({
      context,
      popup,
      targetPage,
      serviceWorker,
      getTargetTabId: () => targetTabId,
      wait,
      log: (m) => console.log(`  ${color(90, '·')} ${m}`),
    });

    // Pause briefly so the final frame is visible.
    await wait(800);

    // The popup video is finalized when the context closes. Resolve its path
    // first so we know where to find it.
    const popupVideoPath = await popupVideoPromise;
    await context.close();

    if (!popupVideoPath || !existsSync(popupVideoPath)) {
      throw new Error(`Popup video not found at ${popupVideoPath}`);
    }

    mkdirSync(outputDir, { recursive: true });
    const dest = resolve(outputDir, `${featureId}.webm`);
    rmSync(dest, { force: true });
    renameSync(popupVideoPath, dest);
    const size = statSync(dest).size;
    ok(`Saved ${featureId}.webm (${(size / 1024).toFixed(1)} KiB)`);
  } catch (err) {
    await context.close().catch(() => {});
    throw err;
  }
}

async function main() {
  if (!existsSync(extensionDir)) {
    throw new Error(
      `Extension build not found at ${extensionDir}. Run \`pnpm --filter @sidekick/extension build\` first.`,
    );
  }
  rmSync(tmpRoot, { recursive: true, force: true });
  mkdirSync(tmpRoot, { recursive: true });

  const files = existsSync(demosDir)
    ? readdirSync(demosDir).filter((f) => f.endsWith('.mjs'))
    : [];
  if (files.length === 0) {
    console.log('No demo scenarios found in demos/.');
    return;
  }

  for (const file of files) {
    const id = file.replace(/\.mjs$/, '');
    if (only && id !== only) continue;
    await recordOne(id, resolve(demosDir, file));
  }
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(`${color(31, '✗')} ${err.stack ?? err}`);
  process.exit(1);
});
