# Auto Reload

> Periodically refresh open tabs at a chosen interval.

## Overview

Useful for monitoring dashboards, live status pages, or any tab whose content changes on a regular cadence. Configure per-tab intervals; reloads run from the background service worker so they keep working when the popup is closed.

## How to use

1. Click the Sidekick icon in the toolbar.
2. Pick **Auto Reload** under the Automation section.
3. Choose a preset (15 s – 1 h) or enter a custom number of seconds.
4. Toggle on. The active tab starts auto-reloading.
5. The "Other tabs" section lists tabs reloading in the background; stop any of them with the × button.

## Settings

### Presets

| Label  | Seconds |
| ------ | ------- |
| 15 sec | 15      |
| 30 sec | 30      |
| 1 min  | 60      |
| 3 min  | 180     |
| 5 min  | 300     |
| 10 min | 600     |
| 30 min | 1800    |
| 1 hour | 3600    |

### Custom

Any value from `5` seconds to `86_400` seconds (24 hours).

## Implementation notes

| Field        | Value                                                     |
| ------------ | --------------------------------------------------------- |
| Category     | automation                                                |
| Permissions  | `tabs`, `alarms`, `storage`                               |
| Storage area | `chrome.storage.local` (key `feature:auto-reload:config`) |
| ≥ 1 min      | Scheduled via `chrome.alarms` (efficient)                 |
| < 1 min      | Scheduled via `setTimeout` in the service worker          |
| Tab close    | State is cleaned up automatically                         |

### Data model

```ts
interface AutoReloadConfig {
  enabled: boolean;
  intervalSeconds: number;
  tabs: Record<number, TabReloadState>;
}

interface TabReloadState {
  tabId: number;
  url: string;
  title: string;
  intervalSeconds?: number;
  startedAt: number;
  nextReloadAt: number;
}
```

## See also

- Source: `apps/extension/src/features/auto-reload/`
- Landing page: https://hikaru-ito.github.io/sidekick-extension/docs/features/auto-reload
