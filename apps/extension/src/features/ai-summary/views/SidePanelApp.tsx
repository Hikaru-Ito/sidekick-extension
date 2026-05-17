import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Copy,
  FileText,
  Globe,
  ListChecks,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Settings,
  Sparkles,
} from 'lucide-react';
import { Button, Card, CardContent, SectionHeader, cn } from '@sidekick/ui-kit';
import { ChoiceGroup } from '../components/ChoiceGroup';
import { ChatView } from '../components/ChatView';
import { KeyPointCards } from '../components/KeyPointCards';
import { StreamingMarkdown } from '../components/StreamingMarkdown';
import { UsageBadge } from '../components/UsageBadge';
import { useAISummarySettings } from '../hooks';
import { generateKeyPoints, streamChat, streamOverview, type UsageInfo } from '../lib/anthropic';
import { extractActiveTab, hashContent } from '../lib/extract';
import { appendHistory, clearIntent, readIntent } from '../storage';
import {
  ANTHROPIC_MODELS,
  type AnthropicModelId,
  type ChatTurn,
  type ExtractedPage,
  type HistoryEntry,
  type KeyPoint,
  type Lang,
  type Length,
  type SummaryMode,
  type Tone,
} from '../types';

type Status =
  | { kind: 'idle' }
  | { kind: 'extracting' }
  | { kind: 'streaming'; mode: SummaryMode }
  | { kind: 'done'; mode: SummaryMode; usage: UsageInfo }
  | { kind: 'error'; message: string };

const MODE_ICONS: Record<SummaryMode, typeof FileText> = {
  overview: FileText,
  keypoints: ListChecks,
  chat: MessageSquareText,
};

const MODE_LABELS: Record<SummaryMode, string> = {
  overview: '概要',
  keypoints: '要点',
  chat: 'チャット',
};

export function SidePanelApp() {
  const settings = useAISummarySettings();
  const [page, setPage] = useState<ExtractedPage | null>(null);
  const [mode, setMode] = useState<SummaryMode>('overview');
  const [overrideModel, setOverrideModel] = useState<AnthropicModelId | null>(null);
  const [length, setLength] = useState<Length | null>(null);
  const [tone, setTone] = useState<Tone | null>(null);
  const [lang, setLang] = useState<Lang | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [overview, setOverview] = useState<string>('');
  const [keypoints, setKeypoints] = useState<KeyPoint[]>([]);
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [chatPending, setChatPending] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  // Persistent usage info per mode — kept so the footer can stay visible
  // across regenerations and the streaming state.
  const [lastUsage, setLastUsage] = useState<Record<SummaryMode, UsageInfo | null>>({
    overview: null,
    keypoints: null,
    chat: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const model = overrideModel ?? settings.prefs.defaultModel;
  const effLen = length ?? settings.prefs.length;
  const effTone = tone ?? settings.prefs.tone;
  const effLang = lang ?? settings.prefs.lang;

  // Pre-extract the active tab so the user sees its title in the header.
  useEffect(() => {
    let cancelled = false;
    setStatus({ kind: 'extracting' });
    void extractActiveTab()
      .then((p) => {
        if (cancelled) return;
        setPage(p);
        setStatus({ kind: 'idle' });
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : 'ページ取得に失敗しました',
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cancelInFlight = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
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
    cancelInFlight();
    const controller = new AbortController();
    abortRef.current = controller;
    setOverview('');
    setStatus({ kind: 'streaming', mode: 'overview' });
    try {
      const result = await streamOverview({
        apiKey: settings.anthropicApiKey,
        model,
        page,
        length: effLen,
        tone: effTone,
        lang: effLang,
        signal: controller.signal,
        onDelta: (chunk) => setOverview((cur) => cur + chunk),
      });
      setStatus({ kind: 'done', mode: 'overview', usage: result.usage });
      setLastUsage((u) => ({ ...u, overview: result.usage }));
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
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : '要約に失敗しました',
      });
    }
  }, [
    settings.anthropicApiKey,
    page,
    model,
    effLen,
    effTone,
    effLang,
    cancelInFlight,
    persistHistory,
  ]);

  const runKeyPoints = useCallback(async () => {
    if (!settings.anthropicApiKey || !page) return;
    cancelInFlight();
    const controller = new AbortController();
    abortRef.current = controller;
    setKeypoints([]);
    setStatus({ kind: 'streaming', mode: 'keypoints' });
    try {
      const result = await generateKeyPoints({
        apiKey: settings.anthropicApiKey,
        model,
        page,
        length: effLen,
        tone: effTone,
        lang: effLang,
        signal: controller.signal,
      });
      setKeypoints(result.points);
      setStatus({ kind: 'done', mode: 'keypoints', usage: result.usage });
      setLastUsage((u) => ({ ...u, keypoints: result.usage }));
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
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : '要点抽出に失敗しました',
      });
    }
  }, [
    settings.anthropicApiKey,
    page,
    model,
    effLen,
    effTone,
    effLang,
    cancelInFlight,
    persistHistory,
  ]);

  const sendChatMessage = useCallback(async () => {
    if (!settings.anthropicApiKey || !page) return;
    const userMessage = chatInput.trim();
    if (!userMessage) return;
    cancelInFlight();
    const controller = new AbortController();
    abortRef.current = controller;
    const nextTurns: ChatTurn[] = [...chatTurns, { role: 'user', text: userMessage }];
    setChatTurns(nextTurns);
    setChatInput('');
    setChatPending('');
    setStatus({ kind: 'streaming', mode: 'chat' });
    try {
      const result = await streamChat({
        apiKey: settings.anthropicApiKey,
        model,
        page,
        history: chatTurns,
        newUserMessage: userMessage,
        lang: effLang,
        signal: controller.signal,
        onDelta: (chunk) => setChatPending((cur) => (cur ?? '') + chunk),
      });
      setChatTurns([...nextTurns, { role: 'assistant', text: result.text }]);
      setChatPending(null);
      setStatus({ kind: 'done', mode: 'chat', usage: result.usage });
      setLastUsage((u) => ({ ...u, chat: result.usage }));
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return;
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'チャットに失敗しました',
      });
      setChatPending(null);
    }
  }, [settings.anthropicApiKey, page, chatInput, chatTurns, model, effLang, cancelInFlight]);

  const runActive = useCallback(() => {
    if (mode === 'overview') void runOverview();
    else if (mode === 'keypoints') void runKeyPoints();
  }, [mode, runOverview, runKeyPoints]);

  // Read the launcher intent (set by the popup) once the page is extracted.
  // If `autostart` is true and the requested mode is overview/keypoints, fire it.
  const intentHandledRef = useRef(false);
  useEffect(() => {
    if (intentHandledRef.current) return;
    if (!settings.anthropicApiKey || !page) return;
    intentHandledRef.current = true;
    void (async () => {
      const intent = await readIntent();
      if (!intent) {
        // No intent → still auto-fire overview by default so the user
        // doesn't have to hunt for the "summarize" button.
        setTimeout(() => void runOverview(), 0);
        return;
      }
      setMode(intent.mode);
      await clearIntent();
      if (intent.autostart) {
        setTimeout(() => {
          if (intent.mode === 'overview') void runOverview();
          else if (intent.mode === 'keypoints') void runKeyPoints();
        }, 0);
      }
    })();
  }, [page, settings.anthropicApiKey, runOverview, runKeyPoints]);

  const hasResultForCurrentMode =
    (mode === 'overview' && overview.length > 0) ||
    (mode === 'keypoints' && keypoints.length > 0) ||
    (mode === 'chat' && chatTurns.length > 0);

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
              開いているページを Claude に読んでもらい、概要・要点・追加質問へ答えてもらえます。
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

  return (
    <div className="flex flex-col gap-4">
      <PageCard page={page} status={status} onSettings={openOptions} />

      <ModeRow mode={mode} onChange={setMode} />

      {/* Quick controls */}
      <div className="grid grid-cols-2 gap-3">
        <LabeledChoice
          label="モデル"
          value={model}
          onChange={(v) => setOverrideModel(v as AnthropicModelId)}
          choices={ANTHROPIC_MODELS.map((m) => ({
            value: m.id,
            label: m.label.replace('Claude ', ''),
          }))}
        />
        <LabeledChoice
          label="長さ"
          value={effLen}
          onChange={(v) => setLength(v as Length)}
          choices={[
            { value: 'short', label: '短く' },
            { value: 'standard', label: 'ふつう' },
            { value: 'detailed', label: '詳しく' },
          ]}
        />
      </div>

      {/* Action area (empty state for the current mode) */}
      {!hasResultForCurrentMode && status.kind !== 'streaming' && page ? (
        <Button onClick={runActive} variant="primary" size="lg" disabled={!page || mode === 'chat'}>
          {mode === 'chat' ? (
            <>下のメッセージ欄から質問してください</>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              このページを要約する
            </>
          )}
        </Button>
      ) : null}

      {/* Status banner */}
      {status.kind === 'error' ? (
        <div className="border-danger/30 bg-danger/8 text-danger flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{status.message}</span>
        </div>
      ) : null}

      {status.kind === 'streaming' ? (
        <div className="text-fg-muted flex items-center gap-2 text-sm">
          <Loader2 className="text-accent-600 h-4 w-4 animate-spin" />
          {MODE_LABELS[status.mode]}を生成中…
          <button
            className="text-fg-subtle hover:text-danger ml-auto underline-offset-2 hover:underline"
            onClick={cancelInFlight}
          >
            キャンセル
          </button>
        </div>
      ) : null}

      {/* Result for overview mode */}
      {mode === 'overview' && overview ? (
        <Card>
          <CardContent className="p-4">
            <StreamingMarkdown text={overview} />
          </CardContent>
        </Card>
      ) : null}
      {mode === 'overview' && overview ? (
        <ResultFooter
          text={overview}
          usage={lastUsage.overview}
          model={model}
          onRegen={runOverview}
          regenDisabled={status.kind === 'streaming' && status.mode === 'overview'}
        />
      ) : null}

      {/* Result for keypoints mode */}
      {mode === 'keypoints' && keypoints.length > 0 ? <KeyPointCards points={keypoints} /> : null}
      {mode === 'keypoints' && keypoints.length > 0 ? (
        <ResultFooter
          text={JSON.stringify(keypoints, null, 2)}
          usage={lastUsage.keypoints}
          model={model}
          onRegen={runKeyPoints}
          regenDisabled={status.kind === 'streaming' && status.mode === 'keypoints'}
        />
      ) : null}

      {/* Chat */}
      {mode === 'chat' ? (
        <ChatView
          turns={chatTurns}
          pending={chatPending}
          isStreaming={status.kind === 'streaming' && status.mode === 'chat'}
          inputValue={chatInput}
          onInputChange={setChatInput}
          onSubmit={sendChatMessage}
          disabled={!page || (status.kind === 'streaming' && status.mode === 'chat')}
        />
      ) : null}
    </div>
  );
}

function PageCard({
  page,
  status,
  onSettings,
}: {
  page: ExtractedPage | null;
  status: Status;
  onSettings: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="bg-surface-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
          <Globe className="text-fg-muted h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          {status.kind === 'extracting' ? (
            <span className="text-fg-muted text-sm">ページ取得中…</span>
          ) : page ? (
            <>
              <div className="text-fg-default truncate text-base font-semibold">{page.title}</div>
              <div className="text-fg-subtle truncate text-xs">
                {page.siteName || new URL(page.url).hostname} ·{' '}
                <span className="tabular-nums">{Math.round(page.length / 100) / 10}k chars</span>
                {page.fallback ? ' · fallback' : ''}
              </div>
            </>
          ) : (
            <span className="text-fg-muted text-sm">
              このページは読み取れません (chrome:// や 拡張機能ページなど)
            </span>
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

function ModeRow({ mode, onChange }: { mode: SummaryMode; onChange: (m: SummaryMode) => void }) {
  return (
    <div role="tablist" className="bg-surface-muted/70 border-border flex rounded-lg border p-1">
      {(['overview', 'keypoints', 'chat'] as SummaryMode[]).map((m) => {
        const Icon = MODE_ICONS[m];
        const active = m === mode;
        return (
          <button
            key={m}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m)}
            className={cn(
              'duration-fast flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all',
              active
                ? 'bg-surface-elevated text-fg-default shadow-xs'
                : 'text-fg-muted hover:text-fg-default',
            )}
          >
            <Icon className="h-4 w-4" />
            {MODE_LABELS[m]}
          </button>
        );
      })}
    </div>
  );
}

function LabeledChoice<T extends string>({
  label,
  value,
  onChange,
  choices,
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  choices: { value: T; label: string }[];
}) {
  return (
    <div className="min-w-0">
      <SectionHeader title={label} />
      <ChoiceGroup value={value} onChange={onChange} choices={choices} />
    </div>
  );
}

function ResultFooter({
  text,
  usage,
  model,
  onRegen,
  regenDisabled,
}: {
  text: string;
  usage: UsageInfo | null;
  model: AnthropicModelId;
  onRegen: () => void;
  regenDisabled?: boolean;
}) {
  const handleCopy = () => void navigator.clipboard.writeText(text);
  return (
    <div className="border-border bg-surface-muted/40 sticky bottom-0 -mt-2 flex flex-col gap-2 rounded-lg border p-3 backdrop-blur">
      {usage ? <UsageBadge usage={usage} model={model} /> : null}
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
