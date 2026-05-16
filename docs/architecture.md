# Architecture

## モノレポ概観

```
sidekick-extension/
├── apps/
│   ├── extension/      # Chrome MV3 拡張機能 (WXT + React)
│   └── landing/        # LP/Docs サイト (Astro)
├── packages/
│   ├── ui-kit/         # 共有Reactコンポーネント (Tailwind)
│   ├── config/         # デザイントークン + Tailwindプリセット
│   └── tsconfig/       # 共有tsconfig
├── docs/               # 仕様書 (このディレクトリ)
└── scripts/            # 機能scaffolder
```

- **pnpm workspaces** で依存関係を整理
- **Turborepo** でビルドキャッシュ + 並列実行
- 各ワークスペースは `@sidekick/*` という名前で他からimport

## 拡張機能 (apps/extension)

### ディレクトリ構造

```
src/
├── entrypoints/
│   ├── background.ts     # service worker
│   └── popup/
│       ├── index.html
│       ├── main.tsx      # createRoot
│       ├── App.tsx       # 全体シェル (ヘッダー + ルーター)
│       └── views/
│           ├── HomeView.tsx     # カテゴリ別機能一覧
│           └── FeatureView.tsx  # 個別機能パネルのコンテナ
├── features/
│   ├── registry.ts       # import.meta.glob による自動収集
│   └── <feature-id>/
│       ├── manifest.ts   # 機能宣言
│       ├── Panel.tsx     # ポップアップUI
│       ├── Summary.tsx?  # 一覧のサマリ
│       ├── background.ts?
│       └── storage.ts?
└── lib/
    ├── feature.ts        # FeatureManifest 型 / defineFeature
    └── storage.ts        # chrome.storage の薄いラッパ
```

### Feature Manifest Pattern

各機能は `FeatureManifest` を default export し、registry が自動的に集める設計。

```ts
import { Zap } from 'lucide-react';
import { defineFeature } from '../../lib/feature';
import { MyPanel } from './Panel';

export default defineFeature({
  id: 'my-feature',
  name: '私の機能',
  description: '...',
  icon: Zap,
  iconTone: 'iris',
  category: 'productivity',
  permissions: ['storage'],
  Panel: MyPanel,
});
```

これにより、新機能を追加する際に手動でimportを書く必要がなく、ディレクトリを作るだけで即UIに反映される。

### Background Service Worker

MV3のservice workerはアイドルでサスペンドされる。状態は以下を併用して保持:

- `chrome.alarms` — 1分以上の周期実行 (永続)
- `chrome.storage` — 設定/状態の永続化
- service worker内のメモリ — 短時間の処理のみ

機能がbackground処理を必要とする場合、`features/<id>/background.ts` に `registerXxxBackground()` を実装し、`entrypoints/background.ts` から呼び出す。

## LP / Docs (apps/landing)

- Astro 4 + Tailwind + MDX
- React は island としてのみ利用 (重いインタラクションだけ)
- `src/data/features.ts` がLP用の機能カタログ。`pnpm gen:feature` で自動追記
- 機能個別ページは `src/pages/docs/features/[id].astro` で動的生成

## デザインシステム (packages/ui-kit, packages/config)

- **トークン**: `packages/config/src/tokens.ts` で集中管理
- **Tailwindプリセット**: `packages/config/src/tailwind.preset.ts` を全アプリで継承
- **コンポーネント**: `packages/ui-kit/src/components/` 配下にReact化
- ベース: Radix UI primitives + class-variance-authority + Tailwind

詳細は [design-system.md](./design-system.md) を参照。
