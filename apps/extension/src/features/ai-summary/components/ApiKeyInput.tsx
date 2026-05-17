import { useState } from 'react';
import { Check, Copy, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button, Input, cn } from '@sidekick/ui-kit';
import { pingApiKey } from '../lib/anthropic';

interface Props {
  value: string;
  onChange: (next: string) => void;
  onSave: () => Promise<void>;
}

export function ApiKeyInput({ value, onChange, onSave }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [status, setStatus] = useState<
    { kind: 'idle' } | { kind: 'testing' } | { kind: 'ok' } | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  const masked = value ? `${value.slice(0, 8)}…${value.slice(-4)}` : '';

  const handleTest = async () => {
    if (!value) return;
    setStatus({ kind: 'testing' });
    const err = await pingApiKey(value);
    if (err) {
      setStatus({ kind: 'error', message: err });
    } else {
      setStatus({ kind: 'ok' });
      await onSave();
    }
  };

  const handleCopy = () => {
    if (!value) return;
    void navigator.clipboard.writeText(value);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <Input
          type={revealed ? 'text' : 'password'}
          value={revealed ? value : masked || value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="sk-ant-…"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 font-mono text-xs"
        />
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? '非表示' : '表示'}
          className="text-fg-muted hover:bg-surface-muted hover:text-fg-default border-border flex h-9 w-9 items-center justify-center rounded-md border transition-colors"
        >
          {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!value}
          aria-label="コピー"
          className="text-fg-muted hover:bg-surface-muted hover:text-fg-default border-border flex h-9 w-9 items-center justify-center rounded-md border transition-colors disabled:opacity-40"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleTest}
          disabled={!value || status.kind === 'testing'}
        >
          {status.kind === 'testing' ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              テスト中
            </>
          ) : status.kind === 'ok' ? (
            <>
              <Check className="h-3 w-3" />
              接続OK · 保存済
            </>
          ) : (
            'キーをテストして保存'
          )}
        </Button>
        {status.kind === 'error' ? (
          <span className="text-danger text-xs">{status.message}</span>
        ) : null}
      </div>

      <p className="text-fg-subtle text-[11px] leading-relaxed">
        🔒 キーは端末のローカルストレージ (
        <code className={cn('text-[10px]')}>chrome.storage.local</code>) のみに保存され、 Anthropic
        以外のサーバーには送信されません。
      </p>
      <p className="text-fg-subtle text-[11px]">
        まだ持っていない場合は{' '}
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
