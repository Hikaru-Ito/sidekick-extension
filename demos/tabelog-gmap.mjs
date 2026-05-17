/**
 * Demo scenario for 食べログ × Google Maps.
 *
 * The feature primarily acts on tabelog.com via a content script — we can't
 * load real Tabelog inside the demo recorder, so this video focuses on the
 * popup settings panel: toggle, cache section, TTL presets, fallback link.
 */

export const featureId = 'tabelog-gmap';
export const title = '食べログ × Google Maps';

/**
 * @param {object} ctx
 * @param {import('playwright').Page} ctx.popup
 * @param {() => number} ctx.getTargetTabId
 * @param {(ms: number) => Promise<void>} ctx.wait
 * @param {(msg: string) => void} ctx.log
 */
export async function runDemo({ popup, getTargetTabId, wait, log }) {
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

  await wait(700);

  log('Open the feature from the menu');
  await popup.locator('text=食べログ × Google Maps').first().click();
  await wait(1500);

  log('Hover the enable toggle');
  await popup.locator('text=この機能を有効化').first().hover();
  await wait(1500);

  log('Switch cache TTL to 30 days');
  await popup.locator('button:has-text("30")').first().click();
  await wait(1200);

  log('Switch cache TTL back to 7 days');
  await popup.locator('button:has-text("7")').first().click();
  await wait(1200);

  log('Hover the fallback-link option');
  await popup.locator('text=取得失敗時').first().hover();
  await wait(1500);
}
