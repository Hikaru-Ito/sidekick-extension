#!/usr/bin/env node
/**
 * Sidekick feature scaffolder.
 *
 * Usage:
 *   pnpm gen:feature <feature-id> [--category=productivity] [--name="Display Name"]
 *
 * What gets generated:
 *   apps/extension/src/features/<id>/manifest.ts
 *   apps/extension/src/features/<id>/Panel.tsx
 *   docs/features/<id>.md
 *   apps/landing/src/data/features.ts gets a new entry appended
 *
 * No changes are required to `registry.ts` — it picks up the new manifest via
 * `import.meta.glob`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = resolve(dirname(__filename), '..');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: pnpm gen:feature <feature-id> [--category=automation] [--name="Display Name"]');
  process.exit(1);
}

const id = args[0];
if (!/^[a-z][a-z0-9-]*$/.test(id)) {
  console.error('feature id must be kebab-case (lowercase letters, digits, and dashes only)');
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
  console.error(`category must be one of: ${validCategories.join(', ')}`);
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
  console.error(`feature '${id}' already exists at ${featureDir}`);
  process.exit(1);
}

mkdirSync(featureDir, { recursive: true });

const manifest = `import { Sparkles } from 'lucide-react';
import { defineFeature } from '../../lib/feature';
import { ${componentName} } from './Panel';

export default defineFeature({
  id: '${id}',
  name: '${name}',
  description: 'TODO: describe what this feature does in 1–2 sentences.',
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
          Implement the feature UI here.
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

> TODO: one-line description.

## Overview

TODO

## How to use

1. Click the Sidekick icon in the toolbar
2. Select "${name}" from the menu
3. ...

## Settings

TODO

## Implementation notes

- Category: ${category}
- Permissions: storage

## See also

- [Landing page](https://hikaru-ito.github.io/sidekick-extension/docs/features/${id})
- Source: \`apps/extension/src/features/${id}/\`
`;
writeFileSync(join(docDir, `${id}.md`), doc);

// Append an entry to apps/landing/src/data/features.ts
const dataFile = join(root, 'apps/landing/src/data/features.ts');
if (existsSync(dataFile)) {
  const content = readFileSync(dataFile, 'utf8');
  const insertion = `  {\n    id: '${id}',\n    name: '${name}',\n    description: 'TODO: describe what this feature does.',\n    category: '${category}',\n    status: 'beta',\n    highlights: [],\n  },\n`;
  const updated = content.replace(
    /(export const features: LandingFeature\[\] = \[)([\s\S]*?)(\];)/,
    (_match, head, body, tail) => `${head}${body}${insertion}${tail}`,
  );
  if (updated !== content) {
    writeFileSync(dataFile, updated);
  }
}

console.log(`\n✨ Scaffolded feature '${id}'\n`);
console.log(`  apps/extension/src/features/${id}/manifest.ts`);
console.log(`  apps/extension/src/features/${id}/Panel.tsx`);
console.log(`  docs/features/${id}.md`);
console.log(`  apps/landing/src/data/features.ts (entry appended)\n`);
console.log(`Next steps:`);
console.log(`  - Edit manifest.ts: update description, icon, and iconTone`);
console.log(`  - Implement the UI in Panel.tsx`);
console.log(`  - Add background.ts / storage.ts if needed`);
console.log(`  - Run pnpm --filter @sidekick/extension dev to try it out\n`);
