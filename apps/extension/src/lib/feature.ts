import type { ComponentType, ReactNode } from 'react';

/**
 * FeatureManifest — Sidekickの各機能はこの形で宣言される。
 * registry.ts が import.meta.glob で自動読込し、ポップアップに表示される。
 * 新機能追加時は scripts/scaffold-feature.mjs を使うとこの雛形が自動生成される。
 */
export interface FeatureManifest {
  /** kebab-case ID. ストレージキー prefix にもなる */
  id: string;
  /** UI表示名 */
  name: string;
  /** 1〜2文の機能説明 */
  description: string;
  /** lucide-reactのアイコンコンポーネント */
  icon: ComponentType<{ className?: string }>;
  /** アイコンの色調 */
  iconTone?: 'iris' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  /** メニューカテゴリ */
  category: 'productivity' | 'automation' | 'developer' | 'privacy' | 'lifestyle';
  /** Chromeのpermissions (manifest.jsonにマージされる前提) */
  permissions?: chrome.runtime.ManifestPermissions[];
  /** ポップアップで開かれるパネル本体 */
  Panel: ComponentType;
  /** 一覧で右側に出すサマリ (例: "30s毎にリロード中") */
  Summary?: ComponentType;
  /** 機能の有効/無効を制御する場合のキー (デフォルトはid) */
  enabledKey?: string;
  /** ステータスバッジ (NEW, BETAなど) */
  badge?: ReactNode;
}

export function defineFeature(manifest: FeatureManifest): FeatureManifest {
  return manifest;
}
