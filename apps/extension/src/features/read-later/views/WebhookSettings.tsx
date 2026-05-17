import { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button, Input, cn } from '@sidekick/ui-kit';
import { useReadLaterSettings } from '../hooks';
import { deliverWebhook } from '../lib/webhooks';
import { makeDefaultWebhook, updateSettings } from '../storage';
import {
  WEBHOOK_PROVIDER_LABEL,
  type ReadLaterPrefs,
  type WebhookConfig,
  type WebhookProvider,
} from '../types';

const PROVIDERS: WebhookProvider[] = ['slack', 'linear', 'discord', 'custom'];

export function WebhookSettings() {
  const settings = useReadLaterSettings();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const addProvider = async (provider: WebhookProvider) => {
    const webhook = makeDefaultWebhook(provider);
    await updateSettings({ webhooks: [...settings.webhooks, webhook] });
    setExpandedId(webhook.id);
  };

  const updateWebhook = async (id: string, patch: Partial<WebhookConfig>) => {
    const next = settings.webhooks.map((w) => (w.id === id ? { ...w, ...patch } : w));
    await updateSettings({ webhooks: next });
  };

  const removeWebhook = async (id: string) => {
    if (!confirm('この Webhook を削除しますか?')) return;
    const next = settings.webhooks.filter((w) => w.id !== id);
    await updateSettings({ webhooks: next });
    if (expandedId === id) setExpandedId(null);
  };

  const updatePrefs = async (patch: Partial<ReadLaterPrefs>) => {
    await updateSettings({ prefs: { ...settings.prefs, ...patch } });
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-fg-muted text-xs leading-relaxed">
          ページを保存したとき、外部ツールに通知できます。Slack には Incoming Webhook URL を、
          Linear には Personal API キーを設定してください。
        </p>
      </div>

      <label className="border-border bg-surface-elevated flex items-start gap-3 rounded-md border p-3">
        <input
          type="checkbox"
          checked={settings.prefs.summaryByDefault}
          onChange={(e) => void updatePrefs({ summaryByDefault: e.target.checked })}
          className="accent-accent-600 mt-1 h-4 w-4 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="text-fg-default text-sm font-medium">
            保存時に AI 要約をデフォルトで作成する
          </div>
          <p className="text-fg-subtle mt-0.5 text-[11px]">
            ポップアップのチェックボックスの初期状態を ON にします。
          </p>
        </div>
      </label>

      <div>
        <div className="text-fg-subtle mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider">
          配信先を追加
        </div>
        <div className="flex flex-wrap gap-2">
          {PROVIDERS.map((p) => (
            <Button key={p} variant="secondary" size="sm" onClick={() => void addProvider(p)}>
              <Plus className="h-3 w-3" />
              {WEBHOOK_PROVIDER_LABEL[p]}
            </Button>
          ))}
        </div>
      </div>

      {settings.webhooks.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {settings.webhooks.map((w) => (
            <WebhookRow
              key={w.id}
              webhook={w}
              expanded={expandedId === w.id}
              onToggle={() => setExpandedId(expandedId === w.id ? null : w.id)}
              onChange={(patch) => void updateWebhook(w.id, patch)}
              onRemove={() => void removeWebhook(w.id)}
            />
          ))}
        </ul>
      ) : (
        <p className="text-fg-subtle text-center text-xs">まだ Webhook は登録されていません。</p>
      )}
    </div>
  );
}

function WebhookRow({
  webhook,
  expanded,
  onToggle,
  onChange,
  onRemove,
}: {
  webhook: WebhookConfig;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<WebhookConfig>) => void;
  onRemove: () => void;
}) {
  const [testStatus, setTestStatus] = useState<
    { kind: 'idle' } | { kind: 'testing' } | { kind: 'ok' } | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  const handleTest = async () => {
    setTestStatus({ kind: 'testing' });
    const result = await deliverWebhook(webhook, {
      id: 'test',
      url: 'https://example.com/sidekick-test',
      title: '[Sidekick test] 接続確認',
      hostname: 'example.com',
      description: 'これは Sidekick から送信されたテスト通知です。',
      savedAt: Date.now(),
      readAt: null,
      tags: ['test'],
      notes: '',
      summary: null,
      deliveries: [],
      favicon: undefined,
    });
    if (result.status === 'sent') {
      setTestStatus({ kind: 'ok' });
    } else if (result.status === 'failed') {
      setTestStatus({ kind: 'error', message: result.error ?? '失敗' });
    } else {
      setTestStatus({ kind: 'error', message: 'webhook が無効化されています' });
    }
  };

  return (
    <li
      className={cn(
        'border-border bg-surface-elevated rounded-md border',
        !webhook.enabled && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-2 p-3">
        <input
          type="checkbox"
          checked={webhook.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
          className="accent-accent-600 h-4 w-4 shrink-0"
          aria-label="有効"
        />
        <button onClick={onToggle} className="min-w-0 flex-1 text-left">
          <div className="text-fg-default text-sm font-medium">
            {webhook.name || WEBHOOK_PROVIDER_LABEL[webhook.provider]}
          </div>
          <div className="text-fg-subtle truncate text-[11px]">
            {WEBHOOK_PROVIDER_LABEL[webhook.provider]}
            {webhook.url ? ` · ${webhook.url}` : ''}
            {webhook.provider === 'linear' && webhook.linearTeam
              ? ` · team ${webhook.linearTeam}`
              : ''}
          </div>
        </button>
        <button
          onClick={onRemove}
          aria-label="削除"
          className="text-fg-muted hover:text-danger hover:bg-danger/10 flex h-7 w-7 items-center justify-center rounded transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onToggle}
          aria-label={expanded ? '閉じる' : '編集'}
          className="text-fg-muted hover:bg-surface-muted flex h-7 w-7 items-center justify-center rounded transition-colors"
        >
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {expanded ? (
        <div className="border-border space-y-3 border-t p-3">
          <Field label="表示名">
            <Input
              value={webhook.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="#reading-list"
              className="text-sm"
            />
          </Field>
          {webhook.provider !== 'linear' ? (
            <Field label="URL">
              <Input
                value={webhook.url}
                onChange={(e) => onChange({ url: e.target.value })}
                placeholder={
                  webhook.provider === 'slack'
                    ? 'https://hooks.slack.com/services/T0/B0/XXXX'
                    : webhook.provider === 'discord'
                      ? 'https://discord.com/api/webhooks/...'
                      : 'https://example.com/endpoint'
                }
                className="font-mono text-xs"
              />
            </Field>
          ) : (
            <>
              <Field label="Personal API key">
                <Input
                  type="password"
                  value={webhook.linearApiKey ?? ''}
                  onChange={(e) => onChange({ linearApiKey: e.target.value })}
                  placeholder="lin_api_..."
                  className="font-mono text-xs"
                />
              </Field>
              <Field label="Team (キーまたは UUID)">
                <Input
                  value={webhook.linearTeam ?? ''}
                  onChange={(e) => onChange({ linearTeam: e.target.value })}
                  placeholder="ENG"
                  className="font-mono text-sm"
                />
              </Field>
            </>
          )}

          {webhook.provider === 'custom' ? (
            <>
              <Field label="HTTP メソッド">
                <select
                  value={webhook.method}
                  onChange={(e) => onChange({ method: e.target.value as WebhookConfig['method'] })}
                  className="border-border bg-surface-elevated rounded-md border px-3 py-1.5 text-sm"
                >
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </Field>
              <Field label="ヘッダー">
                <div className="flex flex-col gap-1.5">
                  {webhook.headers.map((h, i) => (
                    <div key={i} className="flex gap-1.5">
                      <Input
                        value={h.key}
                        onChange={(e) => {
                          const next = [...webhook.headers];
                          next[i] = { ...h, key: e.target.value };
                          onChange({ headers: next });
                        }}
                        placeholder="content-type"
                        className="flex-1 font-mono text-xs"
                      />
                      <Input
                        value={h.value}
                        onChange={(e) => {
                          const next = [...webhook.headers];
                          next[i] = { ...h, value: e.target.value };
                          onChange({ headers: next });
                        }}
                        placeholder="application/json"
                        className="flex-1 font-mono text-xs"
                      />
                      <button
                        onClick={() => {
                          const next = webhook.headers.filter((_, j) => j !== i);
                          onChange({ headers: next });
                        }}
                        aria-label="ヘッダー削除"
                        className="text-fg-muted hover:text-danger flex h-9 w-9 items-center justify-center rounded"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onChange({ headers: [...webhook.headers, { key: '', value: '' }] })
                    }
                  >
                    <Plus className="h-3 w-3" /> ヘッダーを追加
                  </Button>
                </div>
              </Field>
            </>
          ) : null}

          <Field
            label={
              webhook.provider === 'linear'
                ? 'タイトル / 本文テンプレート (\\n---\\n で区切る)'
                : '本文テンプレート'
            }
          >
            <textarea
              value={webhook.bodyTemplate}
              onChange={(e) => onChange({ bodyTemplate: e.target.value })}
              rows={8}
              className="border-border bg-surface-elevated text-fg-default focus-visible:border-accent-400 focus-visible:ring-accent-500/50 w-full rounded-md border px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2"
              spellCheck={false}
            />
            <p className="text-fg-subtle mt-1 text-[10px] leading-relaxed">
              使用可能変数: <code>{`{{title}}`}</code> <code>{`{{url}}`}</code>{' '}
              <code>{`{{hostname}}`}</code> <code>{`{{description}}`}</code>{' '}
              <code>{`{{image}}`}</code> <code>{`{{tags}}`}</code> <code>{`{{notes}}`}</code>{' '}
              <code>{`{{summary}}`}</code> <code>{`{{overview}}`}</code>{' '}
              <code>{`{{keypoints}}`}</code> <code>{`{{savedAt}}`}</code>
              {'  '}/ セクション:{' '}
              <code>
                {`{{#summary}}`}…{`{{/summary}}`}
              </code>{' '}
              <code>
                {`{{#image}}`}…{`{{/image}}`}
              </code>
            </p>
            {webhook.provider === 'slack' || webhook.provider === 'discord' ? (
              <p className="text-fg-subtle mt-1.5 text-[10px] leading-relaxed">
                💡 テンプレに <code>{`{{image}}`}</code>{' '}
                が含まれない場合は、OGP画像が自動でプレビュー添付されます。
              </p>
            ) : null}
          </Field>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTest}
              disabled={testStatus.kind === 'testing'}
            >
              {testStatus.kind === 'testing' ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  送信中…
                </>
              ) : (
                'テスト送信'
              )}
            </Button>
            {testStatus.kind === 'ok' ? (
              <span className="text-success text-xs">✓ 送信成功</span>
            ) : null}
            {testStatus.kind === 'error' ? (
              <span className="text-danger truncate text-xs">{testStatus.message}</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-fg-subtle mb-1.5 text-[10px] font-semibold uppercase tracking-wider">
        {label}
      </div>
      {children}
    </div>
  );
}
