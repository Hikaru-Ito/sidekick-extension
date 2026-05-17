import { useEffect, useState } from 'react';
import { BookmarkPlus, ExternalLink, Github, Moon, Settings, Sparkles, Sun } from 'lucide-react';
import { Button, IconButton, cn } from '@sidekick/ui-kit';
import { ApiKeyInput } from '../../features/ai-summary/components/ApiKeyInput';
import { ChoiceGroup } from '../../features/ai-summary/components/ChoiceGroup';
import { ModelPicker } from '../../features/ai-summary/components/ModelPicker';
import { useAISummarySettings } from '../../features/ai-summary/hooks';
import { clearHistory, updateSettings } from '../../features/ai-summary/storage';
import type { AnthropicModelId, Lang, Length, Tone } from '../../features/ai-summary/types';
import { WebhookSettings } from '../../features/read-later/views/WebhookSettings';

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    void chrome.storage.sync
      .get('sidekick:theme')
      .then((res) => {
        const stored = res['sidekick:theme'];
        if (stored === 'light' || stored === 'dark') setTheme(stored);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    void chrome.storage.sync.set({ 'sidekick:theme': theme }).catch(() => {});
  }, [theme]);

  return { theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) };
}

export function OptionsApp() {
  const settings = useAISummarySettings();
  const { theme, toggle } = useTheme();
  const [keyDraft, setKeyDraft] = useState('');

  // Initialize draft when settings load.
  useEffect(() => {
    if (settings.anthropicApiKey) setKeyDraft(settings.anthropicApiKey);
  }, [settings.anthropicApiKey]);

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
    <div className="bg-surface min-h-screen">
      <header className="border-border bg-surface-elevated/80 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-5">
          <div className="bg-accent-500/12 text-accent-600 flex h-8 w-8 items-center justify-center rounded-md">
            <Settings className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-fg-default text-base font-semibold leading-none">Sidekick 設定</h1>
            <p className="text-fg-subtle mt-1 text-xs">AI 機能のキーと既定値</p>
          </div>
          <IconButton
            label={theme === 'dark' ? 'ライトモード' : 'ダークモード'}
            size="sm"
            onClick={toggle}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </IconButton>
          <IconButton
            label="GitHub"
            size="sm"
            onClick={() =>
              chrome.tabs.create({ url: 'https://github.com/Hikaru-Ito/sidekick-extension' })
            }
          >
            <Github className="h-4 w-4" />
          </IconButton>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-5 py-8">
        <Section
          number="1"
          title="ページAI要約 · Anthropic"
          description="ページ要約・要点抽出・チャットを動かす Anthropic API キーを設定します。キーは端末ローカル (chrome.storage.local) のみに保存され、Sidekick 自身のサーバーや同期領域には保存されません。"
          icon={<Sparkles className="h-4 w-4" />}
        >
          <ApiKeyInput value={keyDraft} onChange={setKeyDraft} onSave={saveKey} />
        </Section>

        <Section
          number="2"
          title="既定のモデル"
          description="新規セッションで使う Claude モデル。サイドパネル内でいつでも切り替え可能です。"
        >
          <ModelPicker value={settings.prefs.defaultModel} onChange={saveModel} />
        </Section>

        <Section
          number="3"
          title="既定の出力スタイル"
          description="長さ・トーン・言語のデフォルト。サイドパネルで個別に上書きできます。"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="長さ">
              <ChoiceGroup
                value={settings.prefs.length}
                onChange={saveLength}
                choices={[
                  { value: 'short', label: '短く' },
                  { value: 'standard', label: 'ふつう' },
                  { value: 'detailed', label: '詳しく' },
                ]}
              />
            </Field>
            <Field label="トーン">
              <ChoiceGroup
                value={settings.prefs.tone}
                onChange={saveTone}
                choices={[
                  { value: 'casual', label: '話し言葉' },
                  { value: 'neutral', label: '中立' },
                  { value: 'formal', label: '硬め' },
                ]}
              />
            </Field>
            <Field label="出力言語">
              <ChoiceGroup
                value={settings.prefs.lang}
                onChange={saveLang}
                choices={[
                  { value: 'ja', label: '日本語' },
                  { value: 'en', label: 'English' },
                ]}
              />
            </Field>
          </div>
        </Section>

        <Section
          number="4"
          title="履歴"
          description="保存された要約履歴 (URL × モード × モデル単位) は最新 20 件まで端末ローカルに保存されます。"
        >
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (confirm('履歴を全て削除しますか?')) void clearHistory();
              }}
            >
              履歴をすべて削除
            </Button>
          </div>
        </Section>

        <Section
          number="5"
          title="あとで読む · Webhook / 既定値"
          description="保存時に外部ツールへ通知する Webhook と、AI要約を既定でオンにするかを設定します。"
          icon={<BookmarkPlus className="h-4 w-4" />}
        >
          <WebhookSettings />
        </Section>

        <Section number="—" title="About" description="" dim>
          <div className="text-fg-muted space-y-2 text-sm">
            <p>
              Sidekick はオープンソースの Chrome
              拡張機能で、便利機能を1つの拡張にまとめる設計です。MIT License、 端末のみで動作。
            </p>
            <ul className="flex flex-wrap gap-3 text-xs">
              <li>
                <a
                  href="https://hikaru-ito.github.io/sidekick-extension/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-accent-600 inline-flex items-center gap-1 underline-offset-2 hover:underline"
                >
                  Landing page <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://hikaru-ito.github.io/sidekick-extension/docs/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-accent-600 inline-flex items-center gap-1 underline-offset-2 hover:underline"
                >
                  Documentation <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/Hikaru-Ito/sidekick-extension"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-accent-600 inline-flex items-center gap-1 underline-offset-2 hover:underline"
                >
                  GitHub <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            </ul>
          </div>
        </Section>
      </main>
    </div>
  );
}

function Section({
  number,
  title,
  description,
  icon,
  children,
  dim,
}: {
  number: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  dim?: boolean;
}) {
  return (
    <section className={cn('flex flex-col gap-3', dim && 'opacity-90')}>
      <div className="flex items-baseline gap-3">
        <span className="text-fg-subtle font-mono text-xs tabular-nums">
          {number.padStart(2, '0')}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {icon ? <span className="text-accent-600">{icon}</span> : null}
          <h2 className="text-fg-default text-base font-semibold">{title}</h2>
        </div>
      </div>
      {description ? (
        <p className="text-fg-muted ml-7 text-xs leading-relaxed">{description}</p>
      ) : null}
      <div className="ml-7">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-fg-subtle mb-1.5 text-[10px] font-semibold uppercase tracking-wider">
        {label}
      </h4>
      {children}
    </div>
  );
}
