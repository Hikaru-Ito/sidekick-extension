/**
 * Demo for the Read Later feature.
 *
 * Shows the popup save flow at a glance: page card, AI-summary opt-in,
 * primary save button. The save round-trip and side-panel hand-off are
 * stubbed so the recording stays offline.
 */

export const featureId = 'read-later';
export const title = 'Read Later';

/**
 * @param {object} ctx
 * @param {import('playwright').Page} ctx.popup
 * @param {() => number} ctx.getTargetTabId
 * @param {(ms: number) => Promise<void>} ctx.wait
 * @param {(msg: string) => void} ctx.log
 */
export async function runDemo({ popup, getTargetTabId, wait, log }) {
  await popup.evaluate(async (tabId) => {
    const origQuery = chrome.tabs.query.bind(chrome.tabs);
    // @ts-expect-error patch
    chrome.tabs.query = async (params) => {
      if (params && params.active) {
        const all = await origQuery({});
        const match = all.find((t) => t.id === tabId);
        return match ? [match] : [];
      }
      return origQuery(params);
    };
    // Stub side-effects so the recording stays deterministic and offline.
    // @ts-expect-error patch
    chrome.runtime.sendMessage = async () => ({ ok: true, itemId: 'demo' });
    // @ts-expect-error patch
    chrome.tabs.create = async () => ({ id: -1 });
    // @ts-expect-error patch
    chrome.sidePanel = chrome.sidePanel || {};
    // @ts-expect-error patch
    chrome.sidePanel.open = async () => undefined;
    // @ts-expect-error patch
    chrome.sidePanel.setOptions = async () => undefined;
    window.close = () => undefined;
  }, getTargetTabId());

  await wait(700);

  log('Open Read Later');
  await popup.locator('text=あとで読む').first().click();
  await wait(1500);

  log('Hover the AI-summary opt-in');
  await popup.locator('text=AI要約も同時に作成する').first().hover();
  await wait(1500);

  log('Hover the save button');
  await popup.locator('button:has-text("あとで読むに保存")').first().hover();
  await wait(1500);
}
