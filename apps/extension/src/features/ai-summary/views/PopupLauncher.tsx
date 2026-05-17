import { useEffect, useState } from 'react';
import { Key, Loader2, PanelRight, Sparkles } from 'lucide-react';
import { Button, Card, CardContent } from '@sidekick/ui-kit';
import { useAISummarySettings } from '../hooks';
import { writeIntent } from '../storage';

async function getActiveTabId(): Promise<number | null> {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t?.id ?? null;
}

/**
 * The popup-side launcher for AI Summary. When the user has already set
 * an API key, this is just a fast hand-off: open the side panel and
 * close the popup. When the key is missing we surface a clear setup
 * card and don't auto-redirect.
 */
export function PopupLauncher() {
  const settings = useAISummarySettings();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings.anthropicApiKey) return;
    let cancelled = false;

    (async () => {
      const tabId = await getActiveTabId();
      if (cancelled) return;
      if (!tabId) {
        setError('アクティブなタブが取得できませんでした。');
        return;
      }
      // The side panel reads this intent on mount and auto-starts the run.
      await writeIntent({
        mode: 'overview',
        tabId,
        autostart: true,
        createdAt: Date.now(),
      });
      try {
        await chrome.sidePanel.open({ tabId });
        // Give Chrome a beat to actually open the panel before closing the
        // popup — closing too fast can race the open() call.
        setTimeout(() => window.close(), 200);
      } catch (err) {
        console.warn('[ai-summary] sidePanel.open failed', err);
        setError('サイドパネルを開けませんでした。Chrome のバージョンをご確認ください。');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [settings.anthropicApiKey]);

  const openOptions = () => {
    void chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    window.close();
  };

  // No API key yet → clear setup card.
  if (!settings.anthropicApiKey) {
    return (
      <div className="flex flex-col gap-3">
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="bg-accent-500/12 text-accent-600 flex h-10 w-10 items-center justify-center rounded-lg">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="text-fg-default text-base font-semibold">ページAI要約</h3>
            <p className="text-fg-muted text-sm leading-relaxed">
              開いているページを Claude が読んで、要約・要点・追加質問に答えます。 BYOK
              方式で、APIキーは端末ローカルにのみ保存されます。
            </p>
            <Button onClick={openOptions} variant="primary" size="md">
              <Key className="h-3.5 w-3.5" />
              設定ページを開く
            </Button>
          </CardContent>
        </Card>
        <p className="text-fg-subtle px-1 text-xs leading-relaxed">
          まだ Anthropic のキーをお持ちでない方は{' '}
          <a
            className="text-accent-600 underline"
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer noopener"
          >
            Anthropic Console
          </a>{' '}
          で発行できます。
        </p>
      </div>
    );
  }

  // API key present → we're handing off to the side panel.
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
        <PanelRight className="text-accent-600 h-8 w-8" />
        <div>
          <h3 className="text-fg-default text-base font-semibold">サイドパネルを開いています…</h3>
          <p className="text-fg-muted mt-1 text-sm">右側のパネルに切り替わります。</p>
        </div>
        <Loader2 className="text-fg-subtle h-4 w-4 animate-spin" />
        {error ? <p className="text-danger text-xs">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
