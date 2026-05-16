# Design System

Sidekick's design system. A neutral base with a single accent color, informed by research on modern productivity-tool UIs.

## Principles

1. **Neutral over decorative** — Don't fight the content. Accent is a single color.
2. **Visual hierarchy through density** — Icon tile (36px) + 14px title + 12px description guides the eye.
3. **Restrained motion** — 120-240ms with `ease-out`. No bouncy easings inside the popup.
4. **Accessibility** — Contrast ≥4.5:1, `focus-visible` rings everywhere.
5. **Light & dark** — All surfaces use CSS variables (`--sk-*`) and switch with the `dark` class / `[data-theme]`.

## Colors

### Accent — Iris (`#6366f1`)

An indigo-violet that reads as both intelligent and neutral. Tailwind exposes it as `accent-50` through `accent-950`.

### Neutral — Zinc

Matches Tailwind's `zinc-50` through `zinc-950`.

### Semantic

| Token     | Use                       | Color     |
| --------- | ------------------------- | --------- |
| `success` | Success, running state    | `#10b981` |
| `warning` | Caution                   | `#f59e0b` |
| `danger`  | Delete, stop, destructive | `#ef4444` |
| `info`    | Informational             | `#06b6d4` |

### Surface CSS variables

To enable automatic light/dark switching, surface tokens are CSS variables:

| Variable                | Purpose                       |
| ----------------------- | ----------------------------- |
| `--sk-surface`          | Base background               |
| `--sk-surface-muted`    | Hover row, subdued background |
| `--sk-surface-elevated` | Cards, popovers               |
| `--sk-border`           | Default border                |
| `--sk-border-strong`    | Strong border                 |
| `--sk-fg-default`       | Primary text                  |
| `--sk-fg-muted`         | Secondary text                |
| `--sk-fg-subtle`        | Hints, labels                 |

In Tailwind you write `bg-surface`, `bg-surface-muted`, `text-fg-default`, etc.

## Typography

- **Sans**: Inter Variable (loaded from rsms.me/inter CDN)
- **Mono**: JetBrains Mono → Fira Code → system mono
- **font-feature-settings**: `cv11`, `ss01`, `ss03` (Inter's modern glyph variants)

Scale: `xs`(11) / `sm`(13) / `base`(14) / `md`(15) / `lg`(16) / `xl`(18) / `2xl`(22) / `3xl`(28) / `4xl`(36) / `5xl`(48) / `6xl`(60)

## Border radius

| Token  | Value  | Use                      |
| ------ | ------ | ------------------------ |
| `sm`   | 4px    | Small indicators         |
| `md`   | 8px    | Buttons, inputs, chips   |
| `lg`   | 12px   | Cards                    |
| `xl`   | 16px   | Modals                   |
| `2xl`  | 20px   | Hero elements            |
| `full` | 9999px | Switches, avatars, pills |

## Shadows

| Token      | Use                                      |
| ---------- | ---------------------------------------- |
| `xs`       | Default card                             |
| `sm`       | Buttons                                  |
| `md`       | Card on hover                            |
| `lg`       | Dropdowns                                |
| `xl`/`2xl` | Modals                                   |
| `glow`     | Focus / accent ring (4px iris-500 @ 12%) |

## Components

Provided by `@sidekick/ui-kit`:

- `Button` — `primary` / `secondary` / `ghost` / `danger` / `link`, sizes `sm` / `md` / `lg` / `icon`
- `IconButton` — icon-only button with label tooltip
- `Switch` — iOS-style toggle (22×36)
- `Slider` — single-value Radix slider
- `Select` — Radix-based select
- `Input` — single-line text input
- `Card` / `CardHeader` / `CardTitle` / `CardDescription` / `CardContent`
- `ListItem` — icon + title + description + trailing slot + chevron
- `Badge` — `iris` / `neutral` / `success` / `warning` / `danger`
- `SectionHeader` — small uppercase header for grouped lists

## Motion

| Token  | Value | Use           |
| ------ | ----- | ------------- |
| `fast` | 120ms | Hover, fade   |
| `base` | 200ms | Toggle, slide |
| `slow` | 320ms | Modal         |

Easing: `out` = `cubic-bezier(0.16, 1, 0.3, 1)` is the default.

Predefined animations:

- `animate-fade-in` — opacity 0 → 1 over 200ms
- `animate-fade-in-up` — 4px from below with fade, 240ms
- `animate-shimmer` — skeleton placeholder

## Popup dimensions

`width: 380px, max-height: 600px` — matches the Chrome toolbar popup convention.
