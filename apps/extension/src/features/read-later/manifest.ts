import { BookmarkPlus } from 'lucide-react';
import { defineFeature } from '../../lib/feature';
import { ReadLaterSummary } from './Summary';
import { PopupSave } from './views/PopupSave';

export default defineFeature({
  id: 'read-later',
  name: 'あとで読む',
  description: 'いま開いているページを保存。AI要約 + Webhook 連携も。',
  icon: BookmarkPlus,
  iconTone: 'iris',
  category: 'productivity',
  permissions: ['storage', 'scripting', 'tabs', 'sidePanel'],
  Panel: PopupSave,
  Summary: ReadLaterSummary,
});
