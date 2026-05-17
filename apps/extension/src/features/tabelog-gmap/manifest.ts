import { MapPin } from 'lucide-react';
import { defineFeature } from '../../lib/feature';
import { TabelogGmapPanel } from './Panel';

export default defineFeature({
  id: 'tabelog-gmap',
  name: '食べログ × Google Maps',
  description: '食べログの店舗詳細ページに、その店の Google Maps 評価を自動で表示します。',
  icon: MapPin,
  iconTone: 'iris',
  category: 'lifestyle',
  permissions: ['storage', 'scripting', 'tabs'],
  Panel: TabelogGmapPanel,
});
