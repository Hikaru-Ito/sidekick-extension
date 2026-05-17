# Changelog

All notable changes to **Sidekick Extension** are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.3.0] — 2026-05-17

### Added — Read Later feature

A new productivity feature for capturing the current tab to a local reading queue, with optional AI summary and webhook fan-out to your tools.

- **Popup save** — one-click capture from the toolbar with inline tag entry. AI-summary opt-in fires summary generation in the background; "Open list" hands off to the side panel.
- **Side panel list** — searchable, filterable (all / unread / read), with tag chips, OGP cover thumbnails, inline summary expansion, per-row read/delete actions, and live delivery status badges.
- **Webhook fan-out** — Slack (Incoming Webhook), Discord (Incoming Webhook), Linear (`issueCreate` via GraphQL with team-key → UUID resolution), or any custom HTTP endpoint. Each webhook has its own enable toggle, name, body template, and test-send button.
- **Template engine** — Mustache-style `{{variable}}` substitution with conditional `{{#section}}…{{/section}}` blocks. Variables: `{{title}} {{url}} {{hostname}} {{description}} {{image}} {{tags}} {{notes}} {{summary}} {{overview}} {{keypoints}} {{savedAt}}`.
- **OGP image extraction** — `og:image` / `twitter:image` / JSON-LD article image / `link rel="image_src"`, falling back to the largest visible `<img>` in the Readability-parsed article. Resolved to absolute URLs and surfaced both in the side panel thumbnail and webhook payloads (Slack `image_url` attachment / Discord embed). Templates can place the image explicitly via `{{image}}`; when absent, auto-attachment keeps older configs working.
- **Options page** — new "あとで読む · Webhook / 既定値" section hosting webhook config + "summary by default" toggle.

Architecture

- **IndexedDB local storage** (`idb`) — `readLater` object store keyed by item id, indexed by saved-at / URL / tags / read-at. No cloud sync.
- **`BroadcastChannel('sidekick:read-later')`** — cross-context change notification so popup, side panel, and options page all reflect the same state without polling.
- **MV3-aware side-effects pipeline** — save returns immediately while the background service worker runs AI summary + webhooks asynchronously.
- **chrome.alarms safety net** — every save schedules a retry alarm (`+1.5 min` with summary, `+0.5 min` without). Alarm wakes the SW even after termination and re-dispatches any deliveries left in `pending` state, so webhooks never disappear into a killed service worker.
- **SW-boot recovery** — on every SW startup, items saved in the last 24 h with `pending` deliveries are auto-retried.

### Fixed

- The popup gear icon now opens the options page via `chrome.tabs.create` instead of `chrome.runtime.openOptionsPage()`. The latter could reject with "Could not create an options page" in popup contexts when the popup closed before the call resolved.

## [0.2.0] — 2026-05-17

### Added — AI Page Summary feature

A new productivity feature that asks Claude to read the active tab and answer in three ways, all on one screen:

- **Key points cards** — 3 to 5 emoji-prefixed cards covering the most important takeaways.
- **Overview** — a streaming markdown summary with structure (TL;DR → details → why-it-matters), tuned to use plain language and inline glosses for jargon.
- **Follow-up chat** — once the summary is on screen, a sticky input bar at the bottom of the panel lets you ask anything. Answers stream into a "追加の質問" thread directly below the summary.

Architecture

- **BYOK Anthropic key**, stored in `chrome.storage.local` only. Never synced, never sent anywhere except `api.anthropic.com`.
- Calls hit the Messages API from the side panel via `@anthropic-ai/sdk` with `dangerouslyAllowBrowser: true`.
- Page content is extracted with Mozilla [Readability](https://github.com/mozilla/readability) via `chrome.scripting.executeScript` (~50 KB cap).
- `cache_control: { type: 'ephemeral' }` on the page envelope so successive runs reuse Anthropic's prompt cache (~90% cheaper).
- Default model `claude-opus-4-7` with adaptive thinking; Sonnet 4.6 is the alternate.

Surfaces

- **Popup launcher** — clicking the toolbar icon → "ページAI要約" opens the side panel and auto-fires the summary in one click.
- **Side panel** — dedicated right-side surface with full-height room for the result. Render order: page card → key-point cards → overview → result footer (copy/regen, usage in JPY when output is Japanese) → chat thread (after the first question) → sticky chat input bar.
- **Options page** — full-tab settings page for API key (with ping test), default model / length / tone / output language, and history controls. Opens in a new tab whether triggered from the popup, from `chrome://extensions`, or from a right-click → Options.

### Fixed

- **Auto Reload schedule mode** could theoretically chain reloads in tight pathological cases; added a 2-second per-tab cooldown and a minimum 1-second scheduling delay, plus strict storage migration that drops malformed entries.
- Auto-scroll in the chat thread now actually reaches the bottom — it pins `scrollTop = scrollHeight` on the scrollable ancestor instead of `scrollIntoView` on a sentinel, so the sticky input bar doesn't cover the latest token.
- A stale Haiku 4.5 model id surviving from before we trimmed the model list was producing 400s on adaptive thinking. Stored preferences are now whitelist-validated on every read and the `thinking: { type: 'adaptive' }` parameter is gated to models that support it.

### Tooling

- New build hook injects `options_ui.open_in_tab = true` so the options page always opens as a real tab.
- `pnpm verify:extension` covers AI Summary's popup launcher in addition to the existing Auto Reload coverage.

## [0.1.0] — 2026-05-17

First public release.

### Added

#### Auto Reload feature

- **Interval mode** — reload the active tab every N seconds/minutes/hours.
  - Presets from 15 sec to 1 hour, plus a custom field accepting any value in `[5, 86400]` seconds.
  - Sub-minute intervals run via `setTimeout`; longer intervals use `chrome.alarms`.
- **Schedule mode** — pick days of the week and one or more `HH:MM` times.
  - Day-of-week chips (Sun – Sat) with quick presets (_Every day / Weekdays / Weekend_).
  - Native time picker; each entry displays both 24-hour and 12-hour forms.
  - Evaluated in the device's local time zone.
- Per-tab configuration. Settings are stored under `chrome.storage.local` and survive browser restarts.
- Status card with a live countdown and mode-aware summary (e.g. `5分毎` or `月/水/金 09:00, 18:00`).
- "Other tabs" list to inspect and stop schedules running in the background.

#### Platform

- Tabbed popup shell with category-grouped feature list (Automation / Productivity / Developer / Privacy / Lifestyle).
- Dark and light themes synced to system preference, persisted across sessions.
- Iris (indigo-violet) accent on a neutral zinc base, surface tokens via CSS variables.
- `@sidekick/ui-kit` — shared Radix-based components (Button, Switch, Slider, Select, Input, Card, ListItem, Badge, IconButton, SectionHeader) with Tailwind preset and design tokens.

#### Tooling and infrastructure

- pnpm workspaces + Turborepo monorepo.
- WXT (Manifest V3) for the extension; Astro 4 for the bilingual landing page.
- Feature manifest pattern (`apps/extension/src/features/<id>/manifest.ts`) auto-collected via `import.meta.glob`.
- `pnpm gen:feature <id>` scaffolder — generates manifest, panel, demo script, and docs in one command.
- `pnpm verify:extension` end-to-end Playwright smoke test (12 assertions across interval + schedule modes).
- `pnpm record:demos` records per-feature WebM demos that auto-embed in both `docs/features/*.md` and the landing site.
- GitHub Actions for CI (typecheck + format + build) and GitHub Pages deployment of the landing.

#### Documentation

- English-only repo (README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, docs, code comments, commits, PRs).
- Bilingual landing page (English default at `/`, Japanese under `/ja/`).
- Per-feature reference (`docs/features/<id>.md`) with embedded demo video.
- `CLAUDE.md` codifies the mandatory feature workflow (demo recording required for any UI change).

### Defensive measures

- Per-tab 2-second reload cooldown in the background scheduler.
- Minimum 1-second scheduling delay — `scheduleFire` never fires synchronously, even for past-due times.
- Strict storage migration that drops malformed entries instead of trusting them.

[0.3.0]: https://github.com/Hikaru-Ito/sidekick-extension/releases/tag/v0.3.0
[0.2.0]: https://github.com/Hikaru-Ito/sidekick-extension/releases/tag/v0.2.0
[0.1.0]: https://github.com/Hikaru-Ito/sidekick-extension/releases/tag/v0.1.0
