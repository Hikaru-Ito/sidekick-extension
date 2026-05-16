# Sidekick Extension

> 毎日のブラウザに、頼れる相棒を。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Built with WXT](https://img.shields.io/badge/built%20with-WXT-7c3aed)](https://wxt.dev/)
[![Built with Astro](https://img.shields.io/badge/built%20with-Astro-ff5d01)](https://astro.build/)

**Sidekick** はオープンソースのChrome拡張機能です。便利機能を一つの拡張にまとめ、単機能拡張を何個も入れる代わりにSidekick一つで生産性を底上げします。

## ✨ 機能

| 機能 | カテゴリ | 状態 |
| --- | --- | --- |
| 定期リロード | Automation | Stable |
| タブサスペンダー | Productivity | Planned |
| スクリーンショット | Productivity | Planned |
| カラーピッカー | Developer | Planned |
| JSONビューア | Developer | Planned |

詳細は [LP](https://hikaru-ito.github.io/sidekick-extension) または [docs/features/](./docs/features/) を参照。

## 🚀 クイックスタート

### ユーザー

[インストール手順](https://hikaru-ito.github.io/sidekick-extension/install) を参照してください。

### 開発者

```bash
git clone https://github.com/Hikaru-Ito/sidekick-extension.git
cd sidekick-extension
pnpm install
pnpm dev          # 拡張機能 + LP 並列起動
```

拡張機能のみ:
```bash
pnpm --filter @sidekick/extension dev
```
ビルド成果物 (`.output/chrome-mv3/`) を Chrome の `chrome://extensions` から「パッケージ化されていない拡張機能を読み込む」で読み込めます。

## 📁 リポジトリ構成

```
sidekick-extension/
├── apps/
│   ├── extension/      # WXT-based Chrome MV3 拡張機能
│   └── landing/        # Astro製LP + docs
├── packages/
│   ├── ui-kit/         # 共有Reactコンポーネント (Tailwind)
│   ├── config/         # デザイントークン + Tailwindプリセット
│   └── tsconfig/       # 共有tsconfig
├── docs/               # マークダウン仕様書
└── scripts/            # 機能scaffolder等
```

## 🧩 機能を追加する

```bash
pnpm gen:feature word-counter
```

これだけで以下が生成され、自動的にポップアップに登録されます:
- `apps/extension/src/features/word-counter/manifest.ts`
- `apps/extension/src/features/word-counter/Panel.tsx`
- `docs/features/word-counter.md`

詳細は [CONTRIBUTING.md](./CONTRIBUTING.md) を参照。

## 🎨 デザインシステム

ニュートラルzincベース + 単一アクセント (Iris) のミニマルなデザインシステム。
詳しくは [docs/design-system.md](./docs/design-system.md) または [LP のデザインシステムページ](https://hikaru-ito.github.io/sidekick-extension/docs/design-system) を参照。

## 🛠️ 技術スタック

- **Monorepo**: pnpm workspaces + Turborepo
- **Extension**: WXT (Manifest V3) + React 18 + TypeScript
- **Landing**: Astro 4 + React (islands) + MDX
- **Styles**: Tailwind CSS + shared preset
- **UI primitives**: Radix UI + class-variance-authority
- **Icons**: lucide-react

## 🤝 コントリビューション

PRを歓迎します！[CONTRIBUTING.md](./CONTRIBUTING.md) を読んでから始めてください。

## 📄 ライセンス

[MIT](./LICENSE)

---

Sidekick は [STRACT, Inc.](https://stract.co.jp) が後援するOSSプロジェクトです。
