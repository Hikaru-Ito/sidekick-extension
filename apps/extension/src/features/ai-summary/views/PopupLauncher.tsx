import { useEffect, useState } from 'react';
import {
  ExternalLink,
  FileText,
  Globe,
  Key,
  ListChecks,
  MessageSquareText,
  PanelRight,
  Settings,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { Button, Card, CardContent, cn } from '@sidekick/ui-kit';
import { useAISummarySettings } from '../hooks';
import { writeIntent } from '../storage';
import type { SummaryMode } from '../types';

const MODE_BUTTONS: { id: SummaryMode; label: string; icon: LucideIcon; blurb: string }[] = [
  { id: 'overview', label: '概要', icon: FileText, blurb: 'Markdownで要約' },
  { id: 'keypoints', label: '要点', icon: ListChecks, blurb: 'カードで3〜5点' },
  { id: 'chat', label: 'チャット', icon: MessageSquareText, blurb: '追加質問できる' },
];

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t ?? null;
}

function isScriptableUrl(url: string | undefined): boolean {
  if (!url) return false;
  return (
    !url.startsWith('chrome://') &&
    !url.startsWith('chrome-extension://') &&
    !url.startsWith('edge://') &&
    !url.startsWith('about:')
  );
}

export function PopupLauncher() {
  const settings = useAISummarySettings();
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getActiveTab().then((t) => {
      if (!cancelled) setTab(t);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const openOptions = () => {
    void chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    window.close();
  };

  const launchInSidePanel = async (mode: SummaryMode | null) => {
    if (!tab?.id) return;
    if (mode) {
      await writeIntent({
        mode,
        tabId: tab.id,
        autostart: true,
        createdAt: Date.now(),
      });
    }
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch (err) {
      console.warn('[ai-summary] sidePanel.open failed', err);
    }
    window.close();
  };

  if (!settings.anthropicApiKey) {
    return (
      <div className="flex flex-col gap-3">
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="bg-accent-500/12 text-accent-600 flex h-10 w-10 items-center justify-center rounded-lg">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="text-fg-default text-sm font-semibold">ページAI要約</h3>
            <p className="text-fg-muted text-xs leading-relaxed">
              開いているページを Claude に要約・要点抽出・追加質問してもらえます。 BYOK
              方式で、APIキーは端末ローカルにのみ保存されます。
            </p>
            <Button onClick={openOptions} variant="primary" size="md">
              <Key className="h-3.5 w-3.5" />
              設定ページを開く
            </Button>
          </CardContent>
        </Card>
        <p className="text-fg-subtle px-1 text-[11px] leading-relaxed">
          まだ Anthropic のキーをお持ちでない方は{' '}
          <a
            className="text-accent-600 underline"
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer noopener"
          >
            Anthropic Console
          </a>{' '}
          から無料で発行できます。
        </p>
      </div>
    );
  }

  const scriptable = isScriptableUrl(tab?.url);

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardContent className="flex items-start gap-3 p-3">
          <div className="bg-surface-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
            <Globe className="text-fg-muted h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            {tab ? (
              <>
                <div className="text-fg-default truncate text-sm font-semibold">{tab.title}</div>
                <div className="text-fg-subtle truncate text-[11px]">
                  {tab.url ? new URL(tab.url).hostname : ''}
                </div>
              </>
            ) : (
              <span className="text-fg-muted text-xs">タブを取得中…</span>
            )}
          </div>
          <button
            onClick={openOptions}
            aria-label="設定"
            className="text-fg-muted hover:bg-surface-muted hover:text-fg-default flex h-8 w-8 items-center justify-center rounded-md transition-colors"
          >
            <Settings className="h-4 w-4" />
          </button>
        </CardContent>
      </Card>

      {!scriptable ? (
        <div className="border-warning/30 bg-warning/8 text-warning rounded-md border px-3 py-2 text-xs">
          このページ ({tab?.url ? new URL(tab.url).protocol : '?'}) は Chrome
          の制約により読み取れません。
        </div>
      ) : null}

      <div>
        <p className="text-fg-subtle mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider">
          モードを選んで開く
        </p>
        <div className="flex flex-col gap-1.5">
          {MODE_BUTTONS.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => launchInSidePanel(m.id)}
                disabled={!scriptable}
                className={cn(
                  'duration-fast border-border bg-surface-elevated group flex items-center gap-3 rounded-md border px-3 py-2.5 transition-all',
                  scriptable
                    ? 'hover:bg-surface-muted hover:shadow-xs cursor-pointer'
                    : 'cursor-not-allowed opacity-50',
                )}
              >
                <span className="bg-accent-500/12 text-accent-600 flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="text-fg-default block text-sm font-medium leading-tight">
                    {m.label}
                  </span>
                  <span className="text-fg-muted block truncate text-[11px]">{m.blurb}</span>
                </span>
                <PanelRight className="text-fg-subtle group-hover:text-accent-600 h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => launchInSidePanel(null)}
        disabled={!scriptable}
        className={cn(
          'text-fg-muted hover:text-fg-default flex items-center justify-center gap-1.5 text-[11px] transition-colors',
          !scriptable && 'cursor-not-allowed opacity-50',
        )}
      >
        サイドパネルを開く (モード選択なし)
        <ExternalLink className="h-3 w-3" />
      </button>
    </div>
  );
}
