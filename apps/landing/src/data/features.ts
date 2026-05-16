import type { Locale } from '../i18n/types';

// Feature catalog for the landing page. Each entry mirrors the extension's
// FeatureManifest and includes translations for every supported locale.
// Run `pnpm gen:feature <id>` to scaffold; the entry is appended automatically.

export type LandingFeatureCategory =
  | 'automation'
  | 'productivity'
  | 'developer'
  | 'privacy'
  | 'lifestyle';

export type LandingFeatureStatus = 'stable' | 'beta' | 'planned';

interface Localized {
  name: string;
  description: string;
  highlights: string[];
}

export interface LandingFeature {
  id: string;
  category: LandingFeatureCategory;
  status: LandingFeatureStatus;
  i18n: Record<Locale, Localized>;
}

export interface LocalizedFeature {
  id: string;
  name: string;
  description: string;
  category: LandingFeatureCategory;
  status: LandingFeatureStatus;
  highlights: string[];
}

export const features: LandingFeature[] = [
  {
    id: 'auto-reload',
    category: 'automation',
    status: 'stable',
    i18n: {
      en: {
        name: 'Auto Reload',
        description: 'Auto-reload tabs at a chosen interval. Great for dashboards and live views.',
        highlights: [
          'Any interval from 5 seconds to 24 hours',
          'Per-tab configuration',
          'Runs in the background service worker — low overhead',
        ],
      },
      ja: {
        name: '定期リロード',
        description: '指定した間隔でタブを自動リロード。ダッシュボード監視やライブビューに便利。',
        highlights: [
          '5秒〜24時間の任意の間隔を指定',
          'タブごとに個別設定可能',
          'バックグラウンドサービスワーカーで省リソース',
        ],
      },
    },
  },
];

export const plannedFeatures: LandingFeature[] = [
  {
    id: 'tab-suspender',
    category: 'productivity',
    status: 'planned',
    i18n: {
      en: {
        name: 'Tab Suspender',
        description: 'Automatically suspend idle tabs to free up memory.',
        highlights: [],
      },
      ja: {
        name: 'タブサスペンダー',
        description: '使っていないタブを自動でスリープしてメモリ使用量を削減。',
        highlights: [],
      },
    },
  },
  {
    id: 'screenshot',
    category: 'productivity',
    status: 'planned',
    i18n: {
      en: {
        name: 'Screenshot',
        description: 'Full-page or region screenshots, one click away.',
        highlights: [],
      },
      ja: {
        name: 'スクリーンショット',
        description: 'フルページや選択範囲のスクリーンショットを一発で。',
        highlights: [],
      },
    },
  },
  {
    id: 'color-picker',
    category: 'developer',
    status: 'planned',
    i18n: {
      en: {
        name: 'Color Picker',
        description: 'Sample any pixel on the page and copy the color value.',
        highlights: [],
      },
      ja: {
        name: 'カラーピッカー',
        description: 'ページ上の任意のピクセルからカラーを抽出。',
        highlights: [],
      },
    },
  },
  {
    id: 'json-viewer',
    category: 'developer',
    status: 'planned',
    i18n: {
      en: {
        name: 'JSON Viewer',
        description: 'Pretty-print and explore JSON responses in the browser.',
        highlights: [],
      },
      ja: {
        name: 'JSONビューア',
        description: 'JSONレスポンスを整形して見やすく表示。',
        highlights: [],
      },
    },
  },
];

export function localize(feature: LandingFeature, locale: Locale): LocalizedFeature {
  const tr = feature.i18n[locale] ?? feature.i18n.en;
  return {
    id: feature.id,
    category: feature.category,
    status: feature.status,
    name: tr.name,
    description: tr.description,
    highlights: tr.highlights,
  };
}
