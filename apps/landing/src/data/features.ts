// LP用の機能カタログ。新機能を追加したら拡張機能側の manifest と合わせてここにも追記する。
// (将来は build時に extension の manifest から自動生成可能)

export interface LandingFeature {
  id: string;
  name: string;
  description: string;
  category: 'automation' | 'productivity' | 'developer' | 'privacy' | 'lifestyle';
  status: 'stable' | 'beta' | 'planned';
  highlights: string[];
}

export const features: LandingFeature[] = [
  {
    id: 'auto-reload',
    name: '定期リロード',
    description: '指定した間隔でタブを自動リロード。ダッシュボード監視やライブビューに便利。',
    category: 'automation',
    status: 'stable',
    highlights: [
      '5秒〜24時間の任意の間隔を指定',
      'タブごとに個別設定可能',
      'バックグラウンドサービスワーカーで省リソース',
    ],
  },
  // 今後の機能はここに追記
];

export const plannedFeatures: LandingFeature[] = [
  {
    id: 'tab-suspender',
    name: 'タブサスペンダー',
    description: '使っていないタブを自動でスリープしてメモリ使用量を削減。',
    category: 'productivity',
    status: 'planned',
    highlights: [],
  },
  {
    id: 'screenshot',
    name: 'スクリーンショット',
    description: 'フルページや選択範囲のスクリーンショットを一発で。',
    category: 'productivity',
    status: 'planned',
    highlights: [],
  },
  {
    id: 'color-picker',
    name: 'カラーピッカー',
    description: 'ページ上の任意のピクセルからカラーを抽出。',
    category: 'developer',
    status: 'planned',
    highlights: [],
  },
  {
    id: 'json-viewer',
    name: 'JSONビューア',
    description: 'JSONレスポンスを整形して見やすく表示。',
    category: 'developer',
    status: 'planned',
    highlights: [],
  },
];
