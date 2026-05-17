import { useState } from 'react';
import { Button, SectionHeader } from '@sidekick/ui-kit';
import { ApiKeyInput } from '../components/ApiKeyInput';
import { ChoiceGroup } from '../components/ChoiceGroup';
import { ModelPicker } from '../components/ModelPicker';
import { useAISummarySettings } from '../hooks';
import { clearHistory, updateSettings } from '../storage';
import type { AnthropicModelId, Lang, Length, Tone } from '../types';

interface Props {
  onClose: () => void;
}

export function SettingsView({ onClose }: Props) {
  const settings = useAISummarySettings();
  const [keyDraft, setKeyDraft] = useState(settings.anthropicApiKey ?? '');

  const saveModel = (id: AnthropicModelId) =>
    void updateSettings({ prefs: { ...settings.prefs, defaultModel: id } });
  const saveLength = (l: Length) =>
    void updateSettings({ prefs: { ...settings.prefs, length: l } });
  const saveTone = (t: Tone) => void updateSettings({ prefs: { ...settings.prefs, tone: t } });
  const saveLang = (l: Lang) => void updateSettings({ prefs: { ...settings.prefs, lang: l } });

  const saveKey = async () => {
    await updateSettings({ anthropicApiKey: keyDraft || null });
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionHeader title="APIキー · Anthropic" />
        <ApiKeyInput value={keyDraft} onChange={setKeyDraft} onSave={saveKey} />
      </div>

      <div>
        <SectionHeader title="既定モデル" />
        <ModelPicker value={settings.prefs.defaultModel} onChange={saveModel} />
      </div>

      <div>
        <SectionHeader title="既定の長さ" />
        <ChoiceGroup
          value={settings.prefs.length}
          onChange={saveLength}
          choices={[
            { value: 'short', label: '短く' },
            { value: 'standard', label: 'ふつう' },
            { value: 'detailed', label: '詳しく' },
          ]}
        />
      </div>

      <div>
        <SectionHeader title="既定のトーン" />
        <ChoiceGroup
          value={settings.prefs.tone}
          onChange={saveTone}
          choices={[
            { value: 'casual', label: '話し言葉' },
            { value: 'neutral', label: '中立' },
            { value: 'formal', label: '硬め' },
          ]}
        />
      </div>

      <div>
        <SectionHeader title="出力言語" />
        <ChoiceGroup
          value={settings.prefs.lang}
          onChange={saveLang}
          choices={[
            { value: 'ja', label: '日本語' },
            { value: 'en', label: 'English' },
          ]}
        />
      </div>

      <div className="border-border border-t pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm('履歴を全て削除しますか?')) {
              void clearHistory();
            }
          }}
        >
          履歴をすべて削除
        </Button>
      </div>

      <Button onClick={onClose} variant="secondary" size="md">
        戻る
      </Button>
    </div>
  );
}
