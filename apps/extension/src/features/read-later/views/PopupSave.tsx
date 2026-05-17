import { useEffect, useMemo, useState } from 'react';
import { BookmarkPlus, Check, ExternalLink, Globe, Sparkles, X } from 'lucide-react';
import { Button, Card, CardContent, Input, cn } from '@sidekick/ui-kit';
import { findByUrl } from '../lib/db';
import { useReadLaterSettings } from '../hooks';
import { useAISummarySettings } from '../../ai-summary/hooks';
import type { SaveMessage, SaveResponse } from '../background';

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t ?? null;
}

function looksScriptable(url: string | undefined): boolean {
  if (!url) return false;
  return (
    !url.startsWith('chrome://') &&
    !url.startsWith('chrome-extension://') &&
    !url.startsWith('edge://') &&
    !url.startsWith('about:')
  );
}

type Status = 'idle' | 'saving' | 'saved' | 'failed';

export function PopupSave() {
  const settings = useReadLaterSettings();
  const aiSettings = useAISummarySettings();
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);
  const [alreadySavedAt, setAlreadySavedAt] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [withSummary, setWithSummary] = useState(settings.prefs.summaryByDefault);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  // Sync default-summary preference once settings load.
  useEffect(() => {
    setWithSummary(settings.prefs.summaryByDefault);
  }, [settings.prefs.summaryByDefault]);

  // Resolve the current tab + check if URL already exists.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const t = await getActiveTab();
      if (cancelled) return;
      setTab(t);
      if (t?.url) {
        const existing = await findByUrl(t.url);
        if (!cancelled && existing) {
          setAlreadySavedAt(existing.savedAt);
          // Pre-populate tags from existing record so updates feel additive.
          setTags(existing.tags);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scriptable = looksScriptable(tab?.url);
  const summaryAvailable = Boolean(aiSettings.anthropicApiKey);
  const hostname = useMemo(() => {
    if (!tab?.url) return '';
    try {
      return new URL(tab.url).hostname;
    } catch {
      return '';
    }
  }, [tab?.url]);

  const enabledWebhooks = settings.webhooks.filter((w) => w.enabled);

  const addTag = (raw: string) => {
    const trimmed = raw.trim().replace(/^#/, '');
    if (!trimmed) return;
    if (tags.includes(trimmed)) return;
    setTags([...tags, trimmed]);
  };

  const handleTagKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
      setTagInput('');
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const handleSave = async () => {
    if (!tab?.id) return;
    setStatus('saving');
    setError(null);
    // Commit any tag still in the input box.
    const pendingTag = tagInput.trim().replace(/^#/, '');
    const finalTags = pendingTag && !tags.includes(pendingTag) ? [...tags, pendingTag] : tags;
    const message: SaveMessage = {
      type: 'read-later:save',
      tabId: tab.id,
      tags: finalTags,
      withSummary: withSummary && summaryAvailable,
    };
    try {
      const res = (await chrome.runtime.sendMessage(message)) as SaveResponse;
      if (!res?.ok) {
        setStatus('failed');
        setError(res?.error ?? '保存に失敗しました');
        return;
      }
      setStatus('saved');
      // Give the user a beat to read the confirmation, then close.
      setTimeout(() => window.close(), 700);
    } catch (err) {
      setStatus('failed');
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    }
  };

  const openList = async () => {
    if (!tab?.id) return;
    try {
      await chrome.sidePanel.setOptions({
        tabId: tab.id,
        path: 'sidepanel.html?view=read-later',
        enabled: true,
      });
      await chrome.sidePanel.open({ tabId: tab.id });
      setTimeout(() => window.close(), 100);
    } catch (err) {
      console.warn('[read-later] sidePanel.open failed', err);
    }
  };

  const openOptions = () => {
    void chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    window.close();
  };

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
                <div className="text-fg-subtle truncate text-[11px]">{hostname}</div>
              </>
            ) : (
              <span className="text-fg-muted text-xs">タブを取得中…</span>
            )}
          </div>
        </CardContent>
      </Card>

      {alreadySavedAt !== null ? (
        <div className="border-info/30 bg-info/8 text-info rounded-md border px-3 py-2 text-xs">
          このページは <strong>{new Date(alreadySavedAt).toLocaleString('ja-JP')}</strong>{' '}
          に保存済です。保存し直すと更新されます。
        </div>
      ) : null}

      {!scriptable ? (
        <div className="border-warning/30 bg-warning/8 text-warning rounded-md border px-3 py-2 text-xs">
          このページ ({tab?.url ? new URL(tab.url).protocol : '?'})
          は本文を取得できないため、タイトルとURLのみ保存されます。
        </div>
      ) : null}

      <div>
        <p className="text-fg-subtle mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider">
          タグ (任意)
        </p>
        <div className="border-border bg-surface-elevated flex flex-wrap items-center gap-1.5 rounded-md border p-2">
          {tags.map((t) => (
            <span
              key={t}
              className="bg-accent-500/12 text-accent-700 dark:text-accent-300 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
            >
              #{t}
              <button
                aria-label="削除"
                onClick={() => setTags(tags.filter((x) => x !== t))}
                className="hover:text-danger"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKey}
            placeholder={tags.length === 0 ? '#技術  Enterで追加' : ''}
            className="h-7 min-w-[80px] flex-1 border-0 px-1 text-sm focus-visible:ring-0"
          />
        </div>
      </div>

      <label
        className={cn(
          'border-border bg-surface-elevated flex items-start gap-3 rounded-md border p-3 transition-colors',
          summaryAvailable
            ? 'hover:bg-surface-muted cursor-pointer'
            : 'cursor-not-allowed opacity-60',
        )}
      >
        <input
          type="checkbox"
          checked={withSummary && summaryAvailable}
          disabled={!summaryAvailable}
          onChange={(e) => setWithSummary(e.target.checked)}
          className="accent-accent-600 mt-1 h-4 w-4 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="text-fg-default flex items-center gap-1.5 text-sm font-medium">
            <Sparkles className="text-accent-600 h-3.5 w-3.5" />
            AI要約も同時に作成する
          </div>
          {summaryAvailable ? (
            <p className="text-fg-subtle mt-0.5 text-[11px]">
              要点カード + 概要が裏で生成され、リストとWebhookに含まれます。
            </p>
          ) : (
            <p className="text-fg-subtle mt-0.5 text-[11px]">
              Anthropic API キーが必要です ·{' '}
              <button onClick={openOptions} className="text-accent-600 underline">
                設定する
              </button>
            </p>
          )}
        </div>
      </label>

      {enabledWebhooks.length > 0 ? (
        <p className="text-fg-subtle px-1 text-[11px]">
          保存後、 {enabledWebhooks.map((w) => w.name).join(' / ')} に送信されます。
        </p>
      ) : null}

      <Button
        onClick={handleSave}
        disabled={!tab?.id || status === 'saving' || status === 'saved'}
        variant="primary"
        size="lg"
      >
        {status === 'saved' ? (
          <>
            <Check className="h-4 w-4" />
            保存しました
          </>
        ) : status === 'saving' ? (
          <>保存中…</>
        ) : (
          <>
            <BookmarkPlus className="h-4 w-4" />
            {alreadySavedAt !== null ? '保存を更新' : 'あとで読むに保存'}
          </>
        )}
      </Button>

      {status === 'failed' && error ? <p className="text-danger px-1 text-xs">{error}</p> : null}

      <button
        onClick={openList}
        className="text-fg-muted hover:text-fg-default flex items-center justify-center gap-1.5 text-[11px] transition-colors"
      >
        📋 リストを開く
        <ExternalLink className="h-3 w-3" />
      </button>
    </div>
  );
}
