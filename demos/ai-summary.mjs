/**
 * Demo for AI Page Summary.
 *
 * Records the popup launcher. With an API key configured the popup
 * auto-redirects to the side panel; without one it surfaces a clear
 * "open the settings page" card. We record the latter flow because the
 * side panel runs in its own context and we never commit a working API
 * key.
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
    // Stub hand-off APIs so the demo recording is stable.
    // @ts-expect-error patch
    chrome.sidePanel = chrome.sidePanel || {};
    // @ts-expect-error patch
    chrome.sidePanel.open = async () => undefined;
    // @ts-expect-error patch
    chrome.tabs.create = async () => ({ id: -1 });
    window.close = () => undefined;
  }, getTargetTabId());

  await wait(800);

  log('Open AI Page Summary');
  await popup.locator('text=ページAI要約').first().click();
  await wait(1500);

  log('Empty-state card: prompt to open the settings page');
  await wait(2000);
}
