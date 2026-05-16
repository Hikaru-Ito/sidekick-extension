import type { ComponentType, ReactNode } from 'react';

/**
 * FeatureManifest — each Sidekick feature default-exports an object of this shape.
 * `registry.ts` collects every manifest via `import.meta.glob`, so adding a new
 * feature directory is enough to register it in the popup.
 * Use `pnpm gen:feature <id>` to scaffold the boilerplate.
 */
export interface FeatureManifest {
  /** kebab-case id, also used as a storage-key prefix. */
  id: string;
  /** Display name shown in the popup. */
  name: string;
  /** Short (1–2 sentence) description. */
  description: string;
  /** lucide-react icon component. */
  icon: ComponentType<{ className?: string }>;
  /** Tone applied to the icon tile. */
  iconTone?: 'iris' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  /** Menu category. */
  category: 'productivity' | 'automation' | 'developer' | 'privacy' | 'lifestyle';
  /** Chrome permissions (informational; merged into the global manifest). */
  permissions?: chrome.runtime.ManifestPermissions[];
  /** Panel rendered when the user opens this feature. */
  Panel: ComponentType;
  /** Optional summary shown next to the feature in the home list. */
  Summary?: ComponentType;
  /** Storage key for the enable/disable flag (defaults to `id`). */
  enabledKey?: string;
  /** Status badge (e.g. "NEW", "BETA"). */
  badge?: ReactNode;
}

export function defineFeature(manifest: FeatureManifest): FeatureManifest {
  return manifest;
}
