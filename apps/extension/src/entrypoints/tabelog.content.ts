import { defineContentScript } from 'wxt/sandbox';
import { mountTabelogGmap } from '../features/tabelog-gmap/content';

export default defineContentScript({
  // Restrict to the host so the script never loads on unrelated pages. The
  // store-detail URL pattern is enforced inside `main()` — Chrome's match
  // patterns don't support the `\d+` we need at the end of the URL.
  matches: ['https://tabelog.com/*'],
  runAt: 'document_idle',
  async main() {
    await mountTabelogGmap();
  },
});
