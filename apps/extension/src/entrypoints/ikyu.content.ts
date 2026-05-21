import { defineContentScript } from 'wxt/sandbox';
import { mountIkyuRatings } from '../features/ikyu-ratings/content';

export default defineContentScript({
  // Restrict to the host so the script never loads on unrelated pages. The
  // store-detail URL pattern is enforced inside `main()` — Chrome's match
  // patterns don't support the `\d+` we need at the end of the URL.
  matches: ['https://restaurant.ikyu.com/*'],
  runAt: 'document_idle',
  async main() {
    await mountIkyuRatings();
  },
});
