# Sidekick Extension

> Your everyday browser sidekick.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Built with WXT](https://img.shields.io/badge/built%20with-WXT-7c3aed)](https://wxt.dev/)
[![Built with Astro](https://img.shields.io/badge/built%20with-Astro-ff5d01)](https://astro.build/)

**Sidekick** is an open-source Chrome extension that bundles many small productivity utilities into a single, modular extension. Instead of installing a dozen single-purpose extensions, install one Sidekick and pick the features you need.

## ✨ Features

| Feature       | Category     | Status  |
| ------------- | ------------ | ------- |
| Auto Reload   | Automation   | Stable  |
| Tab Suspender | Productivity | Planned |
| Screenshot    | Productivity | Planned |
| Color Picker  | Developer    | Planned |
| JSON Viewer   | Developer    | Planned |

See the [landing page](https://hikaru-ito.github.io/sidekick-extension/) or [docs/features/](./docs/features/) for details.

## 🚀 Quick start

### For users

See the [install guide](https://hikaru-ito.github.io/sidekick-extension/install).

### For developers

```bash
git clone https://github.com/Hikaru-Ito/sidekick-extension.git
cd sidekick-extension
pnpm install
pnpm dev          # runs the extension and landing in parallel
```

Extension only:

```bash
pnpm --filter @sidekick/extension dev
```

Load the build output (`apps/extension/.output/chrome-mv3/`) into Chrome via `chrome://extensions` → "Load unpacked".

## 📁 Repository layout

```
sidekick-extension/
├── apps/
│   ├── extension/      # Chrome MV3 extension (WXT + React)
│   └── landing/        # Landing page + docs (Astro, bilingual en/ja)
├── packages/
│   ├── ui-kit/         # Shared React components (Tailwind)
│   ├── config/         # Design tokens + Tailwind preset
│   └── tsconfig/       # Shared tsconfig
├── docs/               # Markdown reference docs
└── scripts/            # Feature scaffolder etc.
```

## 🧩 Adding a feature

```bash
pnpm gen:feature word-counter
```

This single command creates:

- `apps/extension/src/features/word-counter/manifest.ts`
- `apps/extension/src/features/word-counter/Panel.tsx`
- `docs/features/word-counter.md`
- An entry in `apps/landing/src/data/features.ts`

The new feature is auto-registered in the popup menu via Vite's `import.meta.glob`. See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## 🎨 Design system

Neutral zinc base + a single accent color (Iris). See [docs/design-system.md](./docs/design-system.md) or the [design system page](https://hikaru-ito.github.io/sidekick-extension/docs/design-system) for tokens and component documentation.

## 🛠️ Tech stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Extension**: WXT (Manifest V3) + React 18 + TypeScript
- **Landing**: Astro 4 + React islands + MDX (bilingual en/ja)
- **Styles**: Tailwind CSS + shared preset
- **UI primitives**: Radix UI + class-variance-authority
- **Icons**: lucide-react

## 🌐 Language policy

All repository content — commits, PRs, issues, code comments, docs — is written in **English**. The landing page is bilingual (English default, Japanese available). The extension popup UI is currently Japanese-first; English support is planned.

## 🤝 Contributing

PRs welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) first.

## 📄 License

[MIT](./LICENSE)

---

Sidekick is an OSS project maintained by [Hikaru Ito](https://github.com/Hikaru-Ito).
