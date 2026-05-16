import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  outDir: '.output',
  // publicDir is resolved relative to srcDir, so '../public' = apps/extension/public.
  publicDir: '../public',
  manifest: {
    name: 'Sidekick',
    short_name: 'Sidekick',
    description:
      'Your everyday browser sidekick — productivity utilities packed into a single open-source extension.',
    version: '0.1.0',
    permissions: ['storage', 'alarms', 'tabs', 'scripting'],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'Sidekick',
      default_popup: 'popup.html',
    },
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      96: 'icon/96.png',
      128: 'icon/128.png',
    },
  },
  vite: () => ({
    css: { devSourcemap: true },
  }),
});
