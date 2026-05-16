# Changelog

All notable changes to **Sidekick Extension** are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

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

[0.1.0]: https://github.com/Hikaru-Ito/sidekick-extension/releases/tag/v0.1.0
