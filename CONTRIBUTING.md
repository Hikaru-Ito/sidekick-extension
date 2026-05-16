# Contributing to Sidekick

Sidekickへのコントリビューションをありがとうございます！このドキュメントは新機能の追加方法、コーディング規約、PRの送り方を説明します。

## 🚀 開発環境

- Node.js 20.10+
- pnpm 9+

```bash
git clone https://github.com/Hikaru-Ito/sidekick-extension.git
cd sidekick-extension
pnpm install
pnpm dev   # 拡張機能 + LP を並列起動
```

## 🧩 新機能の追加 (重要)

Sidekickの設計思想は **「1機能 = 1ディレクトリ」** です。新機能はscaffolderで雛形を作成します:

```bash
pnpm gen:feature <feature-id>
# 例
pnpm gen:feature word-counter
```

これで以下のファイルが自動生成されます:

```
apps/extension/src/features/word-counter/
├── manifest.ts     # 機能宣言 (defineFeature(...))
├── Panel.tsx       # ポップアップで開かれるUI
└── Summary.tsx     # ホーム画面のサマリ(任意)

docs/features/word-counter.md  # ユーザー向け解説
apps/landing/src/data/features.ts  # 自動で行が追加される (CLIが追記)
```

### 自動登録の仕組み

`features/registry.ts` が `import.meta.glob('./*/manifest.ts')` で配下のすべてのmanifestを収集します。
新機能ディレクトリを追加するだけでポップアップに自動的に表示されます。手動でのインポート不要。

### Feature Manifest

```ts
import { Zap } from 'lucide-react';
import { defineFeature } from '../../lib/feature';
import { MyFeaturePanel } from './Panel';

export default defineFeature({
  id: 'my-feature',
  name: '私の機能',
  description: '1〜2文の説明',
  icon: Zap,
  iconTone: 'iris',
  category: 'productivity',
  permissions: ['storage'],
  Panel: MyFeaturePanel,
});
```

### Background処理が必要な場合

```ts
// features/my-feature/background.ts
export function registerMyFeatureBackground() {
  chrome.alarms.onAlarm.addListener(/* ... */);
}

// entrypoints/background.ts に追加
import { registerMyFeatureBackground } from '../features/my-feature/background';
registerMyFeatureBackground();
```

### Storage

`lib/storage.ts` の `featureStorage('<feature-id>')` を使ってください。キーが自動的にnamespace化されます。

## 🎨 UIガイドライン

- スタイルは **Tailwind CSS** のみ。インラインCSSやstyled-componentsは使わない。
- カラーは `bg-accent-500` のようにプリセットのトークンを使用。生のhexは禁止。
- コンポーネントは `@sidekick/ui-kit` から優先的に取る。なければ追加するPRをお願いします。
- アイコンは `lucide-react` から。
- 動きは 120-240ms / `ease-out`。バウンス系は避ける。

## ✅ PR前のチェックリスト

- [ ] `pnpm typecheck` 通過
- [ ] `pnpm format:check` 通過
- [ ] 機能追加時は `docs/features/<id>.md` を更新 (CLIで自動生成済み)
- [ ] 機能追加時は `apps/landing/src/data/features.ts` に追記
- [ ] `pnpm changeset` で変更点を記録

## 📝 コミットメッセージ

[Conventional Commits](https://www.conventionalcommits.org/) に従ってください:

```
feat(extension): add word counter feature
fix(auto-reload): handle tab close gracefully
docs: update install instructions
chore: bump dependencies
```

## 💬 質問

Issues や Discussions でお気軽にどうぞ。
