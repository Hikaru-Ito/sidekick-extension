# Sidekick Documentation

Sidekickの公式ドキュメント。LP上では [hikaru-ito.github.io/sidekick-extension/docs](https://hikaru-ito.github.io/sidekick-extension/docs) として配信されます。

## 構成

```
docs/
├── README.md              # このファイル
├── architecture.md        # システム設計
├── design-system.md       # デザイントークン/コンポーネント
├── contributing.md        # コントリビュータ向け (CONTRIBUTING.md の詳細版)
└── features/              # 各機能のリファレンス
    └── <feature-id>.md    # pnpm gen:feature で自動生成
```

## 機能ドキュメントの追加

新機能を `pnpm gen:feature <id>` で作成すると `docs/features/<id>.md` の雛形が自動生成されます。
このファイルを編集してリリースしてください。
