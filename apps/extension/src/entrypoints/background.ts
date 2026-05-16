import { defineBackground } from 'wxt/sandbox';
import { registerAutoReloadBackground } from '../features/auto-reload/background';

export default defineBackground(() => {
  registerAutoReloadBackground();
});
