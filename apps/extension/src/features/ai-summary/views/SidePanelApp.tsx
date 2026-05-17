import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Copy, Globe, Loader2, RefreshCw, Settings, Sparkles } from 'lucide-react';
import { Button, Card, CardContent } from '@sidekick/ui-kit';
import { ChatInputBar, ChatThread } from '../components/ChatView';
import { KeyPointCards } from '../components/KeyPointCards';
import { StreamingMarkdown } from '../components/StreamingMarkdown';
import { UsageBadge } from '../components/UsageBadge';
import { useAISummarySettings } from '../hooks';
import { generateKeyPoints, streamChat, streamOverview, type UsageInfo } from '../lib/anthropic';
import { extractActiveTab, hashContent } from '../lib/extract';
import { appendHistory, clearIntent, readIntent } from '../storage';
import {
  type AnthropicModelId,
  type ChatTurn,
  type ExtractedPage,
  type HistoryEntry,
  type KeyPoint,
  type Lang,
  type SummaryMode,
} from '../types';

interface ModeRunState {
  loading: boolean;
  error: string | null;
  usage: UsageInfo | null;
}

const INITIAL_RUN_STATE: ModeRunState = { loading: false, error: null, usage: null };

export function SidePanelApp() {
  const settings = useAISummarySettings();
  const [page, setPage] = useState<ExtractedPage | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [overview, setOverview] = useState<string>('');
  const [keypoints, setKeypoints] = useState<KeyPoint[]>([]);
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [chatPending, setChatPending] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [runState, setRunState] = useState<Record<SummaryMode, ModeRunState>>({
    overview: INITIAL_RUN_STATE,
    keypoints: INITIAL_RUN_STATE,
    chat: INITIAL_RUN_STATE,
  });
  const abortRefs = useRef<Record<SummaryMode, AbortController | null>>({
    overview: null,
    keypoints: null,
    chat: null,
  });

  // All output preferences come from the options page now — no inline
  // pickers in the side panel.
  const model = settings.prefs.defaultModel;
  const length = settings.prefs.length;
  const tone = settings.prefs.tone;
  const lang = settings.prefs.lang;

  // Extract the active tab once on mount.
  useEffect(() => {
    let cancelled = false;
    void extractActiveTab()
      .then((p) => {
        if (cancelled) return;
        setPage(p);
        if (!p) setPageError('このページは読み取れません (chrome:// や 拡張機能ページなど)');
      })
      .catch((err) => {
        if (cancelled) return;
        setPageError(err instanceof Error ? err.message : 'ページ取得に失敗しました');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateMode = useCallback((m: SummaryMode, patch: Partial<ModeRunState>) => {
    setRunState((cur) => ({ ...cur, [m]: { ...cur[m], ...patch } }));
  }, []);

  const persistHistory = useCallback(async (entry: HistoryEntry) => {
    try {
      await appendHistory(entry);
    } catch (err) {
      console.warn('[ai-summary] history save failed', err);
    }
  }, []);

  const runOverview = useCallback(async () => {
    if (!settings.anthropicApiKey || !page) return;
    abortRefs.current.overview?.abort();
    const controller = new AbortController();
    abortRefs.current.overview = controller;
    setOverview('');
    updateMode('overview', { loading: true, error: null });
    try {
      const result = await streamOverview({
        apiKey: settings.anthropicApiKey,
        model,
        page,
        length,
        tone,
        lang,
        signal: controller.signal,
        onDelta: (chunk) => setOverview((cur) => cur + chunk),
      });
      updateMode('overview', { loading: false, usage: result.usage });
      const id = `${page.url}|overview|${model}|${await hashContent(page.content)}`;
      await persistHistory({
        id,
        url: page.url,
        title: page.title,
        mode: 'overview',
        model,
        createdAt: Date.now(),
        payload: result.text,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        cacheReadTokens: result.usage.cacheReadTokens,
        cacheCreationTokens: result.usage.cacheCreationTokens,
      });
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return;
      updateMode('overview', {
        loading: false,
        error: err instanceof Error ? err.message : '要約に失敗しました',
      });
    }
  }, [settings.anthropicApiKey, page, model, length, tone, lang, updateMode, persistHistory]);

  const runKeyPoints = useCallback(async () => {
    if (!settings.anthropicApiKey || !page) return;
    abortRefs.current.keypoints?.abort();
    const controller = new AbortController();
    abortRefs.current.keypoints = controller;
    setKeypoints([]);
    updateMode('keypoints', { loading: true, error: null });
    try {
      const result = await generateKeyPoints({
        apiKey: settings.anthropicApiKey,
        model,
        page,
        length,
        tone,
        lang,
        signal: controller.signal,
      });
      setKeypoints(result.points);
      updateMode('keypoints', { loading: false, usage: result.usage });
      const id = `${page.url}|keypoints|${model}|${await hashContent(page.content)}`;
      await persistHistory({
        id,
        url: page.url,
        title: page.title,
        mode: 'keypoints',
        model,
        createdAt: Date.now(),
        payload: JSON.stringify(result.points),
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        cacheReadTokens: result.usage.cacheReadTokens,
        cacheCreationTokens: result.usage.cacheCreationTokens,
      });
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return;
      updateMode('keypoints', {
        loading: false,
        error: err instanceof Error ? err.message : '要点抽出に失敗しました',
      });
    }
  }, [settings.anthropicApiKey, page, model, length, tone, lang, updateMode, persistHistory]);

  const runSummary = useCallback(() => {
    void runOverview();
    void runKeyPoints();
  }, [runOverview, runKeyPoints]);

  const sendChatMessage = useCallback(async () => {
    if (!settings.anthropicApiKey || !page) return;
    const userMessage = chatInput.trim();
    if (!userMessage) return;
    abortRefs.current.chat?.abort();
    const controller = new AbortController();
    abortRefs.current.chat = controller;
    const nextTurns: ChatTurn[] = [...chatTurns, { role: 'user', text: userMessage }];
    setChatTurns(nextTurns);
    setChatInput('');
    setChatPending('');
    updateMode('chat', { loading: true, error: null });
    try {
      const result = await streamChat({
        apiKey: settings.anthropicApiKey,
        model,
        page,
        history: chatTurns,
        newUserMessage: userMessage,
        lang,
        signal: controller.signal,
        onDelta: (chunk) => setChatPending((cur) => (cur ?? '') + chunk),
      });
      setChatTurns([...nextTurns, { role: 'assistant', text: result.text }]);
      setChatPending(null);
      updateMode('chat', { loading: false, usage: result.usage });
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return;
      setChatPending(null);
      updateMode('chat', {
        loading: false,
        error: err instanceof Error ? err.message : 'チャットに失敗しました',
      });
    }
  }, [settings.anthropicApiKey, page, chatInput, chatTurns, model, lang, updateMode]);

  // Auto-fire summary on side-panel open. An absent intent also triggers
  // it so opening the panel via Chrome's panel UI still works.
  const intentHandledRef = useRef(false);
  useEffect(() => {
    if (intentHandledRef.current) return;
    if (!settings.anthropicApiKey || !page) return;
    intentHandledRef.current = true;
    void (async () => {
      const intent = await readIntent();
      const autostart = intent ? intent.autostart : true;
      if (intent) await clearIntent();
      if (autostart) {
        // Defer to next tick so the page card renders first.
        setTimeout(() => runSummary(), 0);
      }
    })();
  }, [page, settings.anthropicApiKey, runSummary]);

  const openOptions = () => {
    void chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
  };

  // First-time empty state
  if (!settings.anthropicApiKey) {
    return (
      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="bg-accent-500/12 text-accent-600 flex h-12 w-12 items-center justify-center rounded-lg">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-fg-default text-lg font-semibold">ページを要約</h3>
            <p className="text-fg-muted text-base leading-relaxed">
              開いているページを Claude に読んでもらい、要点と概要・追加質問へ答えてもらえます。
              最初に Anthropic の API キーを設定してください。
            </p>
            <Button onClick={openOptions} variant="primary" size="md">
              <Settings className="h-3.5 w-3.5" />
              設定ページを開く
            </Button>
          </CardContent>
        </Card>
        <p className="text-fg-subtle px-1 text-sm leading-relaxed">
          鍵は端末ローカル (chrome.storage.local) のみに保存され、 Anthropic
          以外には送信されません。
        </p>
      </div>
    );
  }

  const overviewRun = runState.overview;
  const keypointsRun = runState.keypoints;
  const chatRun = runState.chat;
  const summaryAnyLoading = overviewRun.loading || keypointsRun.loading;
  const summaryHasContent = overview.length > 0 || keypoints.length > 0;
  const summaryUsage = mergeUsage(overviewRun.usage, keypointsRun.usage);

  return (
    <div className="flex flex-col gap-4">
      <PageCard page={page} pageError={pageError} onSettings={openOptions} />

      {/* Summary errors */}
      {(overviewRun.error || keypointsRun.error) && !summaryAnyLoading ? (
        <ErrorBanner message={overviewRun.error ?? keypointsRun.error ?? ''} />
      ) : null}

      {/* Running indicator */}
      {summaryAnyLoading ? (
        <RunningBanner
          label={
            overviewRun.loading && keypointsRun.loading
              ? '要点と概要を生成中…'
              : overviewRun.loading
                ? '概要を生成中…'
                : '要点を生成中…'
          }
          onCancel={() => {
            abortRefs.current.overview?.abort();
            abortRefs.current.keypoints?.abort();
          }}
        />
      ) : null}

      {/* Empty state if nothing has fired yet (rare; auto-fires on mount) */}
      {!summaryHasContent && !summaryAnyLoading && page ? (
        <Button onClick={runSummary} variant="primary" size="lg">
          <Sparkles className="h-4 w-4" />
          要点と概要を生成する
        </Button>
      ) : null}

      {/* Key points — render skeleton while loading */}
      {keypoints.length > 0 ? <KeyPointCards points={keypoints} /> : null}
      {keypointsRun.loading && keypoints.length === 0 ? <KeyPointsSkeleton /> : null}

      {/* Overview */}
      {overview ? (
        <Card>
          <CardContent className="p-4">
            <StreamingMarkdown text={overview} />
          </CardContent>
        </Card>
      ) : null}

      {/* Summary footer — copy + regen + usage. Not sticky. */}
      {summaryHasContent ? (
        <SummaryFooter
          keypoints={keypoints}
          overview={overview}
          usage={summaryUsage}
          model={model}
          lang={lang}
          onRegen={runSummary}
          regenDisabled={summaryAnyLoading}
        />
      ) : null}

      {/* Chat thread (only renders once the user has asked something) */}
      <ChatThread turns={chatTurns} pending={chatPending} isStreaming={chatRun.loading} />

      {/* Chat errors */}
      {chatRun.error && !chatRun.loading ? <ErrorBanner message={chatRun.error} /> : null}

      {/* Chat usage badge (after at least one chat turn completes) */}
      {chatTurns.length > 0 && chatRun.usage ? (
        <div className="border-border bg-surface-muted/40 rounded-lg border p-3">
          <UsageBadge usage={chatRun.usage} model={model} lang={lang} />
        </div>
      ) : null}

      {/* Chat input — sticky at the bottom of the panel, always available. */}
      <ChatInputBar
        value={chatInput}
        onChange={setChatInput}
        onSubmit={sendChatMessage}
        isStreaming={chatRun.loading}
        disabled={!page || chatRun.loading}
      />
    </div>
  );
}

function PageCard({
  page,
  pageError,
  onSettings,
}: {
  page: ExtractedPage | null;
  pageError: string | null;
  onSettings: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="bg-surface-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
          <Globe className="text-fg-muted h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          {page ? (
            <>
              <div className="text-fg-default truncate text-base font-semibold">{page.title}</div>
              <div className="text-fg-subtle truncate text-xs">
                {page.siteName || new URL(page.url).hostname} ·{' '}
                <span className="tabular-nums">{Math.round(page.length / 100) / 10}k chars</span>
                {page.fallback ? ' · fallback' : ''}
              </div>
            </>
          ) : pageError ? (
            <span className="text-fg-muted text-sm">{pageError}</span>
          ) : (
            <span className="text-fg-muted text-sm">ページ取得中…</span>
          )}
        </div>
        <button
          onClick={onSettings}
          aria-label="設定"
          className="text-fg-muted hover:bg-surface-muted hover:text-fg-default flex h-9 w-9 items-center justify-center rounded-md transition-colors"
        >
          <Settings className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="border-danger/30 bg-danger/8 text-danger flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function RunningBanner({ label, onCancel }: { label: string; onCancel: () => void }) {
  return (
    <div className="text-fg-muted flex items-center gap-2 text-sm">
      <Loader2 className="text-accent-600 h-4 w-4 animate-spin" />
      {label}
      <button
        className="text-fg-subtle hover:text-danger ml-auto underline-offset-2 hover:underline"
        onClick={onCancel}
      >
        キャンセル
      </button>
    </div>
  );
}

function KeyPointsSkeleton() {
  return (
    <ol className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="border-border bg-surface-elevated flex animate-pulse gap-3 rounded-lg border p-4"
        >
          <div className="bg-surface-muted h-10 w-10 shrink-0 rounded-md" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="bg-surface-muted h-3.5 w-2/3 rounded" />
            <div className="bg-surface-muted h-3 w-full rounded" />
            <div className="bg-surface-muted h-3 w-5/6 rounded" />
          </div>
        </li>
      ))}
    </ol>
  );
}

function SummaryFooter({
  keypoints,
  overview,
  usage,
  model,
  lang,
  onRegen,
  regenDisabled,
}: {
  keypoints: KeyPoint[];
  overview: string;
  usage: UsageInfo | null;
  model: AnthropicModelId;
  lang: Lang;
  onRegen: () => void;
  regenDisabled: boolean;
}) {
  const handleCopy = () => {
    const parts: string[] = [];
    if (keypoints.length > 0) {
      parts.push(lang === 'en' ? '# Key points' : '# 要点');
      keypoints.forEach((p, i) => {
        parts.push(`${i + 1}. ${p.emoji} **${p.title}** — ${p.body}`);
      });
    }
    if (overview) {
      if (parts.length > 0) parts.push('');
      parts.push(lang === 'en' ? '# Overview' : '# 概要');
      parts.push(overview);
    }
    void navigator.clipboard.writeText(parts.join('\n'));
  };

  return (
    <div className="border-border bg-surface-muted/40 flex flex-col gap-2 rounded-lg border p-3">
      {usage ? <UsageBadge usage={usage} model={model} lang={lang} /> : null}
      <div className="flex gap-2">
        <Button variant="secondary" size="md" onClick={handleCopy}>
          <Copy className="h-3.5 w-3.5" />
          コピー
        </Button>
        <Button variant="primary" size="md" onClick={onRegen} disabled={regenDisabled}>
          {regenDisabled ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          再生成
        </Button>
      </div>
    </div>
  );
}

function mergeUsage(a: UsageInfo | null, b: UsageInfo | null): UsageInfo | null {
  if (!a && !b) return null;
  return {
    inputTokens: (a?.inputTokens ?? 0) + (b?.inputTokens ?? 0),
    outputTokens: (a?.outputTokens ?? 0) + (b?.outputTokens ?? 0),
    cacheReadTokens: (a?.cacheReadTokens ?? 0) + (b?.cacheReadTokens ?? 0),
    cacheCreationTokens: (a?.cacheCreationTokens ?? 0) + (b?.cacheCreationTokens ?? 0),
  };
}
