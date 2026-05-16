# Contributing to Sidekick

Thanks for your interest in contributing to Sidekick! This document covers how to add features, the coding conventions, and how to submit pull requests.

## 🌐 Language policy

**All repository content must be in English**: commits, PR titles and descriptions, issue titles and bodies, code comments, console messages, error messages, and every file under `docs/`, `.github/`, and `README.md`.

The landing page (`apps/landing/`) is bilingual (English default, Japanese alternate). End-user UI strings in the extension popup are currently Japanese-first; full i18n is planned.

## 🚀 Development setup

- Node.js 20.10+
- pnpm 9+

```bash
git clone https://github.com/Hikaru-Ito/sidekick-extension.git
cd sidekick-extension
pnpm install
pnpm dev   # runs the extension and landing in parallel
```

## 🧩 Adding a new feature

Sidekick's design principle: **one feature = one directory**. Scaffold a new feature with:

```bash
pnpm gen:feature <feature-id>
# example
pnpm gen:feature word-counter
```

This creates:

```
apps/extension/src/features/word-counter/
├── manifest.ts     # feature declaration (defineFeature(...))
├── Panel.tsx       # UI rendered when the user opens the feature
└── Summary.tsx     # (optional) summary shown on the home screen

docs/features/word-counter.md     # user-facing reference
apps/landing/src/data/features.ts # (entry appended automatically)
```

### How auto-registration works

`features/registry.ts` collects every `manifest.ts` under `features/*/` via `import.meta.glob('./*/manifest.ts')`. Just adding a directory is enough; no manual imports needed.

### Feature manifest shape

```ts
import { Zap } from 'lucide-react';
import { defineFeature } from '../../lib/feature';
import { MyFeaturePanel } from './Panel';

export default defineFeature({
  id: 'my-feature',
  name: 'My feature',
  description: 'One or two sentences describing what it does.',
  icon: Zap,
  iconTone: 'iris',
  category: 'productivity',
  permissions: ['storage'],
  Panel: MyFeaturePanel,
});
```

### Background work

If a feature needs background processing (alarms, listeners, etc.), expose a `register<Feature>Background()` from `features/<id>/background.ts` and call it from `entrypoints/background.ts`.

### Storage

Use `featureStorage('<feature-id>')` from `lib/storage.ts`. Keys are automatically namespaced so different features can't clobber each other.

## 🎨 UI guidelines

- Styling is Tailwind-only. No inline `style` blocks or styled-components.
- Use tokens (`bg-accent-500`, `text-fg-muted`, etc.) — no raw hex.
- Prefer components from `@sidekick/ui-kit`. If something is missing, add it there in the same PR.
- Icons come from `lucide-react`.
- Motion: 120-240ms with `ease-out`. Avoid bouncy easings inside the popup.

## ✅ PR checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm format:check` passes
- [ ] When adding a feature: `docs/features/<id>.md` is filled in
- [ ] When adding a feature: `apps/landing/src/data/features.ts` has the entry
- [ ] `pnpm changeset` run to record the change

## 📝 Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/). All in English.

```
feat(extension): add word counter feature
fix(auto-reload): handle tab close gracefully
docs: update install instructions
chore: bump dependencies
```

## 💬 Questions

Open an issue or a discussion. We aim to reply within a few days.
