/**
 * Demo scenario for the Auto Reload feature.
 *
 * Run via `pnpm record:demos`. The output WebM is saved to
 * `apps/landing/public/demos/auto-reload.webm` and embedded in both
 * docs/features/auto-reload.md and the LP feature page.
 *
 * Keep the scenario under ~30 seconds; aim for clarity over exhaustiveness.
 */

export const featureId = 'auto-reload';
export const title = 'Auto Reload';

/**
 * @param {object} ctx
 * @param {import('playwright').Page} ctx.popup       Popup page (380x640)
 * @param {import('playwright').Worker} ctx.serviceWorker
 * @param {() => number} ctx.getTargetTabId
 * @param {(ms: number) => Promise<void>} ctx.wait
 * @param {(msg: string) => void} ctx.log
 */
export async function runDemo({ popup, getTargetTabId, wait, log }) {
  // Make the popup believe `getTargetTabId()` is the active tab so the
  // panel renders as if the user had opened the popup on it.
  await popup.evaluate(async (tabId) => {
    const orig = chrome.tabs.query.bind(chrome.tabs);
    // @ts-expect-error patch
    chrome.tabs.query = async (params) => {
      if (params && params.active) {
        const all = await orig({});
        const match = all.find((t) => t.id === tabId);
        return match ? [match] : [];
      }
      return orig(params);
    };
  }, getTargetTabId());

  await wait(800);

  log('Open Auto Reload from the menu');
  await popup.locator('text=定期リロード').first().click();
  await wait(1100);

  log('Apply the 30-second preset (interval mode)');
  await popup.locator('button:has-text("30秒")').first().click();
  await wait(2000);

  log('Switch to the schedule tab');
  await popup.locator('button[role="tab"]:has-text("時刻を指定")').first().click();
  await wait(900);

  log('Pick the weekend preset');
  await popup.locator('button:has-text("週末")').first().click();
  await wait(700);

  log('Add a 21:30 time');
  await popup.locator('input[type="time"]').first().fill('21:30');
  await popup.locator('button:has-text("追加")').first().click();
  await wait(900);

  log('Start the schedule');
  await popup.locator('button:has-text("スケジュールを開始")').first().click();
  await wait(1800);

  log('Highlight the running status');
  await wait(1000);
}
