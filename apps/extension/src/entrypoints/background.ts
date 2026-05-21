import { defineBackground } from 'wxt/sandbox';
import { registerAutoReloadBackground } from '../features/auto-reload/background';
import { registerReadLaterBackground } from '../features/read-later/background';
import { registerTabelogGmapBackground } from '../features/tabelog-gmap/background';
import { registerIkyuRatingsBackground } from '../features/ikyu-ratings/background';

export default defineBackground(() => {
  registerAutoReloadBackground();
  registerReadLaterBackground();
  registerTabelogGmapBackground();
  registerIkyuRatingsBackground();
});
