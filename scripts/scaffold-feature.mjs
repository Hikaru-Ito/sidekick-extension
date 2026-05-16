#!/usr/bin/env node
/**
 * Sidekick feature scaffolder
 *
 * Usage:
 *   pnpm gen:feature <feature-id> [--category=productivity] [--name="表示名"]
 *
 * 何が生成されるか:
 *   apps/extension/src/features/<id>/manifest.ts
 *   apps/extension/src/features/<id>/Panel.tsx
 *   docs/features/<id>.md
 *   apps/landing/src/data/features.ts に1行追記 (任意)
 *
 * registry.ts は import.meta.glob で自動収集するため変更不要。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = resolve(dirname(__filename), '..');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: pnpm gen:feature <feature-id> [--category=automation] [--name="表示名"]');
  process.exit(1);
}

const id = args[0];
if (!/^[a-z][a-z0-9-]*$/.test(id)) {
  console.error('feature id は kebab-case (英小文字+数字+ハイフン) で指定してください');
  process.exit(1);
}

function flag(name, defaultValue) {
  const m = args.find((a) => a.startsWith(`--${name}=`));
  return m ? m.split('=').slice(1).join('=') : defaultValue;
}

const name = flag('name', toTitleCase(id));
const category = flag('category', 'productivity');
const validCategories = ['productivity', 'automation', 'developer', 'privacy', 'lifestyle'];
if (!validCategories.includes(category)) {
  console.error(`category は次のいずれか: ${validCategories.join(', ')}`);
  process.exit(1);
}

const pascalName = toPascalCase(id);
const componentName = `${pascalName}Panel`;

function toTitleCase(s) {
  return s.replace(/(^|-)([a-z])/g, (_, sep, c) => (sep ? ' ' : '') + c.toUpperCase());
}
function toPascalCase(s) {
  return s.replace(/(^|-)([a-z])/g, (_, _sep, c) => c.toUpperCase());
}

const featureDir = join(root, 'apps/extension/src/features', id);
if (existsSync(featureDir)) {
  console.error(`feature '${id}' は既に存在します: ${featureDir}`);
  process.exit(1);
}

mkdirSync(featureDir, { recursive: true });

const manifest = `import { Sparkles } from 'lucide-react';
import { defineFeature } from '../../lib/feature';
import { ${componentName} } from './Panel';

export default defineFeature({
  id: '${id}',
  name: '${name}',
  description: 'TODO: 機能の説明を1-2文で書いてください。',
  icon: Sparkles,
  iconTone: 'iris',
  category: '${category}',
  permissions: ['storage'],
  Panel: ${componentName},
});
`;

const panel = `import { Card, CardContent } from '@sidekick/ui-kit';

export function ${componentName}() {
  return (
    <Card>
      <CardContent>
        <h3 className="text-sm font-semibold">${name}</h3>
        <p className="mt-2 text-xs text-fg-muted">
          ここに UI を実装してください。
        </p>
      </CardContent>
    </Card>
  );
}
`;

writeFileSync(join(featureDir, 'manifest.ts'), manifest);
writeFileSync(join(featureDir, 'Panel.tsx'), panel);

// docs/features/<id>.md
const docDir = join(root, 'docs/features');
mkdirSync(docDir, { recursive: true });
const doc = `# ${name}

> TODO: 機能の説明を書いてください。

## 概要

TODO

## 使い方

1. ツールバーのSidekickアイコンをクリック
2. メニューから「${name}」を選択
3. ...

## 設定

TODO

## 技術的な詳細

- カテゴリ: ${category}
- Permissions: storage

## 関連

- [LP feature page](https://sidekick.stract.dev/docs/features/${id})
- ソース: \`apps/extension/src/features/${id}/\`
`;
writeFileSync(join(docDir, `${id}.md`), doc);

// apps/landing/src/data/features.ts に1行追記
const dataFile = join(root, 'apps/landing/src/data/features.ts');
if (existsSync(dataFile)) {
  const content = readFileSync(dataFile, 'utf8');
  const insertion = `  {\n    id: '${id}',\n    name: '${name}',\n    description: 'TODO: 機能の説明を書いてください。',\n    category: '${category}',\n    status: 'beta',\n    highlights: [],\n  },\n`;
  // features 配列に挿入
  const updated = content.replace(
    /(export const features: LandingFeature\[\] = \[)([\s\S]*?)(\];)/,
    (_match, head, body, tail) => `${head}${body}${insertion}${tail}`,
  );
  if (updated !== content) {
    writeFileSync(dataFile, updated);
  }
}

console.log(`\n✨ Feature '${id}' を作成しました\n`);
console.log(`  apps/extension/src/features/${id}/manifest.ts`);
console.log(`  apps/extension/src/features/${id}/Panel.tsx`);
console.log(`  docs/features/${id}.md`);
console.log(`  apps/landing/src/data/features.ts (1行追記)\n`);
console.log(`次のステップ:`);
console.log(`  - manifest.ts の description / icon / iconTone を書き換え`);
console.log(`  - Panel.tsx に UI を実装`);
console.log(`  - 必要なら background.ts や storage.ts を追加`);
console.log(`  - pnpm --filter @sidekick/extension dev で確認\n`);
