/**
 * Demo scenario for AI Page Summary.
 *
 * The demo only exercises the local UI (empty state → settings → back) so it
 * stays fully offline and doesn't require a real API key. Calling the live
 * Anthropic API from a recorded demo would require committing a working key,
 * which we never want to do.
 */

export const featureId = 'ai-summary';
export const title = 'AI Page Summary';

/**
 * @param {object} ctx
 * @param {import('playwright').Page} ctx.popup
 * @param {() => number} ctx.getTargetTabId
 * @param {(ms: number) => Promise<void>} ctx.wait
 * @param {(msg: string) => void} ctx.log
 */
export async function runDemo({ popup, getTargetTabId, wait, log }) {
  // Patch chrome.tabs.query so the panel believes our target tab is active.
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

  log('Open the AI Page Summary feature');
  await popup.locator('text=ページAI要約').first().click();
  await wait(1200);

  log('Empty state: prompt to set an API key');
  await wait(1000);

  log('Open settings');
  await popup.locator('button:has-text("API キーを設定する")').first().click();
  await wait(900);

  log('Show model picker + preference toggles');
  await wait(2000);

  log('Back to main view');
  await popup.locator('button:has-text("戻る")').first().click();
  await wait(1200);
}
