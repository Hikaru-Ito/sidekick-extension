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
    version: '0.4.0',
    permissions: ['storage', 'alarms', 'tabs', 'scripting', 'sidePanel'],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'Sidekick',
      default_popup: 'popup.html',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
    options_ui: {
      page: 'options.html',
    },
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      96: 'icon/96.png',
      128: 'icon/128.png',
    },
  },
  hooks: {
    // WXT's `options_ui` type doesn't carry `open_in_tab`, but Chrome's
    // Manifest V3 supports it. Without it the options page opens as an
    // embedded dialog from chrome://extensions; with it Chrome opens it
    // in a real tab — which is what we want.
    'build:manifestGenerated': (_wxt, manifest) => {
      if (manifest.options_ui) {
        (manifest.options_ui as unknown as Record<string, unknown>).open_in_tab = true;
      }
    },
  },
  vite: () => ({
    css: { devSourcemap: true },
  }),
});
