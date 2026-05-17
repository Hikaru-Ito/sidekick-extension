import { defineBackground } from 'wxt/sandbox';
import { registerAutoReloadBackground } from '../features/auto-reload/background';
import { registerReadLaterBackground } from '../features/read-later/background';

export default defineBackground(() => {
  registerAutoReloadBackground();
  registerReadLaterBackground();
});
