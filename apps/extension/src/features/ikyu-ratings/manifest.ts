import { Utensils } from 'lucide-react';
import { defineFeature } from '../../lib/feature';
import { IkyuRatingsPanel } from './Panel';

export default defineFeature({
  id: 'ikyu-ratings',
  name: '一休 × 食べログ + Maps',
  description:
    '一休レストランの店舗詳細ページに、その店の食べログ評価と Google Maps 評価を自動表示します。',
  icon: Utensils,
  iconTone: 'iris',
  category: 'lifestyle',
  permissions: ['storage', 'scripting', 'tabs'],
  Panel: IkyuRatingsPanel,
});
