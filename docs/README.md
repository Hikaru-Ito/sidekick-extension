# Sidekick Documentation

Reference documentation for Sidekick. These markdown files are also rendered on the landing site at [hikaru-ito.github.io/sidekick-extension/docs](https://hikaru-ito.github.io/sidekick-extension/docs).

## Layout

```
docs/
├── README.md              # this file
├── architecture.md        # system design
├── design-system.md       # tokens and components
├── contributing.md        # contributor guide (extended version of /CONTRIBUTING.md)
└── features/              # per-feature reference
    └── <feature-id>.md    # auto-scaffolded by `pnpm gen:feature`
```

## Adding feature docs

`pnpm gen:feature <id>` scaffolds a starter `docs/features/<id>.md`. Fill it in before releasing the feature.
