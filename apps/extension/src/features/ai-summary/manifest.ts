import { Sparkles } from 'lucide-react';
import { defineFeature } from '../../lib/feature';
import { PopupLauncher } from './views/PopupLauncher';
import { AISummarySummary } from './Summary';

export default defineFeature({
  id: 'ai-summary',
  name: 'ページAI要約',
  description: '開いているページを Claude が要約・要点抽出・追加質問に答えます (BYOK)。',
  icon: Sparkles,
  iconTone: 'iris',
  category: 'productivity',
  permissions: ['storage', 'scripting', 'tabs', 'sidePanel'],
  Panel: PopupLauncher,
  Summary: AISummarySummary,
});
