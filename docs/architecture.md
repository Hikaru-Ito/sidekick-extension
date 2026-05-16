# Architecture

## Monorepo overview

```
sidekick-extension/
├── apps/
│   ├── extension/      # Chrome MV3 extension (WXT + React)
│   └── landing/        # Landing + docs site (Astro, bilingual)
├── packages/
│   ├── ui-kit/         # Shared React components (Tailwind)
│   ├── config/         # Design tokens + Tailwind preset
│   └── tsconfig/       # Shared tsconfig
├── docs/               # Reference documentation (this directory)
└── scripts/            # Feature scaffolder
```

- **pnpm workspaces** wire local packages together
- **Turborepo** provides build caching and parallelism
- Workspaces are referenced via `@sidekick/*` import paths

## Extension (apps/extension)

### Directory layout

```
src/
├── entrypoints/
│   ├── background.ts     # service worker
│   └── popup/
│       ├── index.html
│       ├── main.tsx      # createRoot
│       ├── App.tsx       # shell (header + view router)
│       └── views/
│           ├── HomeView.tsx     # category-grouped feature list
│           └── FeatureView.tsx  # individual feature container
├── features/
│   ├── registry.ts       # auto-collected via import.meta.glob
│   └── <feature-id>/
│       ├── manifest.ts   # feature declaration
│       ├── Panel.tsx     # popup UI
│       ├── Summary.tsx?  # home-screen summary
│       ├── background.ts?
│       └── storage.ts?
└── lib/
    ├── feature.ts        # FeatureManifest type + defineFeature
    └── storage.ts        # thin wrapper around chrome.storage
```

### Feature manifest pattern

Each feature default-exports a `FeatureManifest`; the registry collects them automatically.

```ts
import { Zap } from 'lucide-react';
import { defineFeature } from '../../lib/feature';
import { MyPanel } from './Panel';

export default defineFeature({
  id: 'my-feature',
  name: 'My feature',
  description: '...',
  icon: Zap,
  iconTone: 'iris',
  category: 'productivity',
  permissions: ['storage'],
  Panel: MyPanel,
});
```

You never wire up imports manually — drop a directory and the popup picks it up on next reload.

### Background service worker

MV3 service workers idle and get suspended. State is preserved via:

- `chrome.alarms` — for periodic tasks at ≥1-minute intervals (persistent)
- `chrome.storage` — for any configuration and runtime state
- In-memory state in the worker — only for short, transient handlers

When a feature needs background work, expose `registerXxxBackground()` in `features/<id>/background.ts` and call it from `entrypoints/background.ts`.

## Landing / Docs (apps/landing)

- Astro 4 + Tailwind + MDX
- React is used only as islands for heavier interactions
- Bilingual via Astro's built-in `i18n` config: English at `/`, Japanese at `/ja/`
- `src/data/features.ts` is the source of truth for the landing feature catalog; appended by `pnpm gen:feature`
- Per-feature pages are generated dynamically from the feature data

## Design system (packages/ui-kit, packages/config)

- **Tokens**: centralized in `packages/config/src/tokens.ts`
- **Tailwind preset**: `packages/config/src/tailwind.preset.ts` is inherited by every app
- **Components**: under `packages/ui-kit/src/components/`
- Built on Radix UI primitives + class-variance-authority + Tailwind

See [design-system.md](./design-system.md) for the full reference.
