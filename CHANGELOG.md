# Changelog

All notable changes to **Sidekick Extension** are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.5.0] — 2026-05-21

### Added — Ikyu × Tabelog + Maps feature

A new lifestyle feature for restaurant browsing on Ikyu (一休レストラン).
When you open an Ikyu restaurant detail page, Sidekick automatically injects
a compact two-row panel showing the same restaurant scored on both Tabelog
and Google Maps.

- **Two-row card** — Tabelog row and Google Maps row, each with star
  rating, review count, confidence badge, and a direct link to the source.
  Rendered inside a Shadow DOM so it doesn't conflict with Ikyu's CSS.
- **Tabelog via Google site-search** — the orchestrator opens
  `google.com/search?q={name} {area} site:tabelog.com` in a hidden tab,
  picks the first SERP link matching Tabelog's detail-page pattern, then
  _navigates the same tab_ to that URL and reads the actual rating + review
  count off the detail-page header. Google's relevance ranking is
  significantly stronger than Tabelog's internal search, so the right
  restaurant is picked even for long fancy names — and the rating comes
  from the detail page itself, not a list-view average.
- **Google Maps** — reuses the `scrapeGmaps` self-contained function from
  the existing Tabelog × Google Maps feature.
- **Name-similarity gate** — each row carries a confidence badge
  (`高確度 ≥0.8` / `中確度 0.6–0.8` / `要確認 <0.6`) computed from the
  Dice-bigram similarity between the Ikyu store name and what the source
  page returned.
- **Settings panel** — enable/disable, cache TTL (1/7/30 days), cache size
  display + clear button, optional fallback search links.

Architecture

- IndexedDB store `ikyuRatings` added via a v3 schema migration. All three
  feature DB modules (read-later, tabelog-gmap, ikyu-ratings) now declare
  the same combined schema with matching `blocking()` callbacks so they
  can open the shared `sidekick` database concurrently.
- New `waitForTabHostComplete(tabId, hostFragment, timeoutMs)` helper that
  only resolves once the tab has committed to a URL on the expected host —
  avoids a race where a `tabs.update` could otherwise see a stale
  `status: "complete"` from the previous page.
- Two-step Tabelog scrape function pair (`findTabelogUrlOnGoogle` +
  `scrapeTabelogDetailPage`), both self-contained for
  `chrome.scripting.executeScript`. The detail scrape returns a `debug`
  payload (matched selectors, page title, final URL) so future drift is
  diagnosable from a single log line.
- Hard 45 s timeout on the background message handler (two sequential
  scrapes), with a 30-minute CAPTCHA cooldown shared between sources.

## [0.4.0] — 2026-05-18

### Added — Tabelog × Google Maps feature

A new lifestyle feature for restaurant browsing: when you open a Tabelog
restaurant page, Sidekick automatically injects a compact card under the
rating header showing the same restaurant's rating and review count from
Google Maps.

- **Auto-injected card** — single-line, Tabelog-flavoured white card with
  star rating, review count, confidence badge, and a deep link to Maps.
  Rendered inside a Shadow DOM so it never conflicts with Tabelog's own CSS.
- **Hidden-tab scrape** — no API key, no shared backend. The background
  service worker opens `https://www.google.com/maps/search/{store} {station}`
  in an inactive tab via `chrome.tabs.create({ active: false })`, runs a
  self-contained scrape via `chrome.scripting.executeScript`, and closes the
  tab. Typical round-trip is 2–4 seconds, after which the result is cached
  for 7 days.
- **Name-similarity gate** — list-view scrapes pick the candidate whose name
  has the highest Dice-bigram similarity to the Tabelog store, instead of
  defaulting to the most prominent panel. A confidence badge
  (`高確度 ≥0.8` / `中確度 0.6–0.8` / `要確認 <0.6`) makes match quality
  visible.
- **Settings panel** — enable/disable, cache TTL (1/7/30 days), cache size
  display + clear button, optional "Maps で検索" fallback link.

Architecture

- IndexedDB store `tabelogGmap` (LRU 500 entries, by-fetchedAt index) added
  via a v2 schema migration. The Read Later module was updated to declare
  the same combined schema and a `blocking()` callback so both features can
  open the shared `sidekick` database without deadlocking.
- Single-flight queue in the orchestrator: at most one hidden-tab scrape
  runs at a time, rate-limited to ≥2 s apart. CAPTCHA detection pauses
  further lookups for 30 minutes.
- Hard 30 s timeout on the background message handler so a content-script
  spinner never hangs indefinitely.
- The injected scrape function is fully self-contained — all helpers live
  inside `scrapeGmaps` because only the function body is serialised to the
  target tab (a closure over module-scope helpers would crash with
  ReferenceError).
- Permissions used: `storage`, `tabs`, `scripting`, plus the existing
  `<all_urls>` host permission.

### Fixed

- The Read Later background sometimes used a stale IndexedDB connection
  after schema upgrades — the new `blocking()` handler closes outgoing
  connections when another consumer requests an upgrade.

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

[0.5.0]: https://github.com/Hikaru-Ito/sidekick-extension/releases/tag/v0.5.0
[0.4.0]: https://github.com/Hikaru-Ito/sidekick-extension/releases/tag/v0.4.0
[0.3.0]: https://github.com/Hikaru-Ito/sidekick-extension/releases/tag/v0.3.0
[0.2.0]: https://github.com/Hikaru-Ito/sidekick-extension/releases/tag/v0.2.0
[0.1.0]: https://github.com/Hikaru-Ito/sidekick-extension/releases/tag/v0.1.0
