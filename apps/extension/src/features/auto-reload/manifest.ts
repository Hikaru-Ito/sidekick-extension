import { RefreshCw } from 'lucide-react';
import { defineFeature } from '../../lib/feature';
import { AutoReloadPanel } from './Panel';
import { AutoReloadSummary } from './Summary';

export default defineFeature({
  id: 'auto-reload',
  name: '定期リロード',
  description: '指定した間隔で開いているタブを自動リロードします。',
  icon: RefreshCw,
  iconTone: 'iris',
  category: 'automation',
  permissions: ['tabs', 'alarms', 'storage'],
  Panel: AutoReloadPanel,
  Summary: AutoReloadSummary,
});
