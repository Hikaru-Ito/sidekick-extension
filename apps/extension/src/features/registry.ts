import type { FeatureManifest } from '../lib/feature';

// Collect every `features/<id>/manifest.ts` automatically.
// To add a new feature, create the directory and default-export a FeatureManifest.
const modules = import.meta.glob<{ default: FeatureManifest }>('./*/manifest.ts', { eager: true });

export const features: FeatureManifest[] = Object.values(modules)
  .map((mod) => mod.default)
  .sort((a, b) => a.name.localeCompare(b.name));

export const featuresByCategory = features.reduce<
  Record<FeatureManifest['category'], FeatureManifest[]>
>(
  (acc, feature) => {
    (acc[feature.category] ||= []).push(feature);
    return acc;
  },
  {
    productivity: [],
    automation: [],
    developer: [],
    privacy: [],
    lifestyle: [],
  },
);

export const categoryLabels: Record<FeatureManifest['category'], string> = {
  productivity: 'Productivity',
  automation: 'Automation',
  developer: 'Developer',
  privacy: 'Privacy',
  lifestyle: 'Lifestyle',
};
