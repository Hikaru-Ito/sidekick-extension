# CLAUDE.md

Engineering rules and conventions for this repository. These apply to every contributor — humans and AI assistants alike.

## Language policy

- All repository content is in **English**: commit messages, PR titles and descriptions, issue titles and bodies, code comments, console output, error messages, and every file under `docs/`, `.github/`, and the project root (README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY).
- The landing page (`apps/landing/`) is bilingual via Astro i18n. English is the default (`/`); Japanese lives under `/ja/...`. UI strings are centralized in `apps/landing/src/i18n/ui.ts`.
- Extension popup UI is Japanese-first today. Full i18n is planned.

## Mandatory feature workflow

When **adding** a new feature or **changing the UI** of an existing one, every PR must include all of the following:

1. **Scaffold (new features only)**: `pnpm gen:feature <id>`.
2. **Implementation** under `apps/extension/src/features/<id>/`:
   - `manifest.ts` (default-exports a `FeatureManifest`)
   - `Panel.tsx`
   - Optional: `Summary.tsx`, `background.ts`, `storage.ts`, `hooks.ts`, `types.ts`
3. **Documentation**:
   - `docs/features/<id>.md` (English reference; embeds the demo video)
   - Entry in `apps/landing/src/data/features.ts` with both `en` and `ja` strings
4. **Demo recording — REQUIRED**:
   - `demos/<id>.mjs` defining the Playwright scenario (created by the scaffolder)
   - Run `pnpm record:demos` (or `-- --only <id>`) to produce `apps/landing/public/demos/<id>.webm`
   - Commit the regenerated `.webm` alongside the code
   - The video must reflect the **current** UI; if any user-visible behaviour changes, re-record before merging.
5. **End-to-end smoke test**: `pnpm verify:extension` passes locally.
6. **Static checks**: `pnpm typecheck && pnpm format:check` pass.

A feature is **not complete** without an up-to-date demo video.

The demo video is embedded automatically:

- In `docs/features/<id>.md` (visible when browsing on GitHub).
- On the landing page at `/docs/features/<id>` (auto-detected from `apps/landing/public/demos/`).

## Architecture

- Monorepo: pnpm workspaces + Turborepo. Workspaces use the `@sidekick/*` namespace.
- Extension: WXT (Manifest V3) + React 18 + TypeScript.
- Landing: Astro 4 + React islands + MDX, bilingual.
- Shared design system: `@sidekick/ui-kit` + `@sidekick/config` (Tailwind preset + tokens).
- New features are auto-registered via Vite's `import.meta.glob` in `apps/extension/src/features/registry.ts`. Never wire imports manually.

## Style

- Styling is **Tailwind only**. No inline `style=`, no styled-components.
- Use design tokens: `bg-accent-500`, `text-fg-muted`, `border-border`, etc. No raw hex values in components.
- Icons come from `lucide-react`.
- Motion: 120-240 ms with `ease-out`. Avoid bouncy easings inside the popup.
- Light + dark surfaces use the CSS variables in `packages/ui-kit/src/styles.css`.

## Commit conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/) in English:

```
feat(<scope>): <summary>
fix(<scope>): <summary>
docs: <summary>
chore: <summary>
test: <summary>
```

Examples:

```
feat(auto-reload): add schedule mode (day-of-week × HH:MM)
fix(auto-reload): handle tab close during sub-minute setTimeout
docs(architecture): clarify FeatureManifest pattern
```

## Useful scripts

| Command                            | Purpose                                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| `pnpm dev`                         | Run extension + landing in parallel (HMR)                          |
| `pnpm gen:feature <id>`            | Scaffold a new feature (manifest + panel + demo + docs + LP entry) |
| `pnpm record:demos`                | Build the extension and re-record all demo videos                  |
| `pnpm record:demos -- --only <id>` | Re-record a single demo                                            |
| `pnpm verify:extension`            | End-to-end smoke test in Chromium                                  |
| `pnpm typecheck`                   | Project-wide `tsc` + `astro check`                                 |
| `pnpm format`                      | Apply Prettier                                                     |
| `pnpm build`                       | Build all apps (extension + landing)                               |

## When in doubt

Prefer to read these documents end-to-end before starting work:

- `README.md`
- `CONTRIBUTING.md`
- `docs/architecture.md`
- `docs/design-system.md`
