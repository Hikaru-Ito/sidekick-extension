# Auto Reload

> Periodically refresh open tabs — either at a fixed interval or at specific times of day.

## Overview

Useful for monitoring dashboards, live status pages, recurring reports, or any tab whose content changes on a regular cadence. Two scheduling modes are available:

- **Interval** — reload every N seconds/minutes/hours.
- **Schedule** — reload on selected days of the week at specific HH:MM times.

Reloads run from the background service worker, so they keep working when the popup is closed. State is per-tab; closing the tab cleans everything up.

## How to use

### Interval mode

1. Click the Sidekick icon in the toolbar.
2. Pick **Auto Reload** under Automation.
3. Select the **間隔で繰り返し** tab (default).
4. Pick a preset (15 sec – 1 hour) or enter any value from 5 seconds to 24 hours.
5. The active tab starts auto-reloading.

### Schedule mode

1. Open the Auto Reload panel and switch to the **時刻を指定** tab.
2. Toggle the day-of-week chips you want (Sun – Sat). Quick presets: _Every day / Weekdays / Weekend_.
3. Add one or more times via the time picker, then click **+ 追加**.
4. Click **スケジュールを開始**.

Days and times are evaluated in the device's local time zone.

## Settings

### Interval presets

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

Custom intervals accept anything in `[5, 86_400]` seconds (24 hours).

### Schedule format

- Days: zero or more of `Sun(0)` – `Sat(6)`. Must contain at least one entry to run.
- Times: one or more `HH:MM` entries. Must contain at least one entry to run.

The next fire time is computed as the earliest `(active day) × (configured time)` strictly in the future.

## Implementation notes

| Field        | Value                                                     |
| ------------ | --------------------------------------------------------- |
| Category     | automation                                                |
| Permissions  | `tabs`, `alarms`, `storage`                               |
| Storage area | `chrome.storage.local` (key `feature:auto-reload:config`) |
| Scheduling   | Always via `chrome.alarms.create({ when })` ≥ 60 s away   |
| Sub-minute   | Falls back to `setTimeout` inside the service worker      |
| Tab close    | State is cleaned up automatically                         |

### Data model

```ts
type ReloadMode =
  | { kind: 'interval'; intervalSeconds: number }
  | {
      kind: 'schedule';
      daysOfWeek: Array<0 | 1 | 2 | 3 | 4 | 5 | 6>;
      times: Array<{ hour: number; minute: number }>;
    };

interface TabReloadState {
  tabId: number;
  url: string;
  title: string;
  mode: ReloadMode;
  startedAt: number;
  nextReloadAt: number;
}

interface AutoReloadConfig {
  enabled: boolean;
  defaultMode: ReloadMode;
  tabs: Record<number, TabReloadState>;
}
```

`computeNextFire(mode, fromMs)` returns the next epoch-ms to fire. For schedule mode it scans up to 8 days ahead to cover week wrap-around.

## See also

- Source: `apps/extension/src/features/auto-reload/`
- Landing page: https://hikaru-ito.github.io/sidekick-extension/docs/features/auto-reload
