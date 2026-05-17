/**
 * Demo for AI Page Summary.
 *
 * Records the popup launcher: page card + the three mode buttons that
 * hand off to the side panel. We deliberately stop at the launcher level
 * because the full summarizer flow needs a real API key (lives in the
 * side panel, not the popup) and we never commit live credentials.
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
    // Stub out the hand-off APIs so clicks don't tear the popup down mid-recording.
    // @ts-expect-error patch
    chrome.sidePanel = chrome.sidePanel || {};
    // @ts-expect-error patch
    chrome.sidePanel.open = async () => undefined;
    // @ts-expect-error patch
    chrome.tabs.create = async () => ({ id: -1 });
    window.close = () => undefined;
  }, getTargetTabId());

  await wait(800);

  log('Open the AI Page Summary feature');
  await popup.locator('text=ページAI要約').first().click();
  await wait(1300);

  log('Empty state: prompt to open the settings page');
  await wait(1500);
}
