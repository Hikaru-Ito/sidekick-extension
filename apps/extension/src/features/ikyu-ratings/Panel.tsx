import { useEffect, useState } from 'react';
import { Loader2, MapPin, Trash2 } from 'lucide-react';
import { Button, Card, CardContent, Switch, cn } from '@sidekick/ui-kit';
import { clearAll, countCached, subscribeChanges } from './lib/cache';
import { readSettings, subscribeSettings, writeSettings } from './storage';
import { DEFAULT_SETTINGS, type IkyuRatingsSettings } from './types';

export function IkyuRatingsPanel() {
  const [settings, setSettings] = useState<IkyuRatingsSettings>(DEFAULT_SETTINGS);
  const [count, setCount] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void readSettings().then((s) => {
      if (!cancelled) setSettings(s);
    });
    const unsub = subscribeSettings(setSettings);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const reload = () =>
      countCached().then((c) => {
        if (!cancelled) setCount(c);
      });
    void reload();
    const unsub = subscribeChanges(() => void reload());
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const toggle = async (enabled: boolean) => {
    setSettings(await writeSettings({ enabled }));
  };

  const setTtl = async (cacheTtlDays: number) => {
    setSettings(await writeSettings({ cacheTtlDays }));
  };

  const setFallback = async (showFallbackLink: boolean) => {
    setSettings(await writeSettings({ showFallbackLink }));
  };

  const handleClear = async () => {
    if (!confirm('キャッシュした評価データを全削除しますか?')) return;
    setClearing(true);
    try {
      await clearAll();
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardContent className="flex items-start gap-3 p-3">
          <div className="bg-accent-500/12 text-accent-600 flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
            <MapPin className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-fg-default text-sm font-semibold">一休 × 食べログ + Maps</h3>
            <p className="text-fg-subtle mt-1 text-[11px] leading-relaxed">
              一休レストランの店舗詳細ページに、その店の食べログ評価と Google Maps 評価を
              自動挿入します。バックグラウンドで両サイトを順次スクレイプ → 7 日間キャッシュ。
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="border-border bg-surface-elevated flex items-center justify-between rounded-md border px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-fg-default text-sm font-medium">この機能を有効化</div>
          <p className="text-fg-subtle mt-0.5 text-[11px]">
            restaurant.ikyu.com/数字/ の店舗ページでのみ動作します。
          </p>
        </div>
        <Switch checked={settings.enabled} onCheckedChange={(v) => void toggle(v)} />
      </div>

      <div className="border-border bg-surface-elevated rounded-md border p-3">
        <div className="text-fg-subtle mb-2 text-[10px] font-semibold uppercase tracking-wider">
          キャッシュ
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="text-fg-muted text-xs">
            保存件数:{' '}
            <strong className="text-fg-default tabular-nums">{count === null ? '…' : count}</strong>{' '}
            件
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleClear()}
            disabled={clearing || count === 0}
          >
            {clearing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
            全削除
          </Button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-fg-subtle text-[11px]">期限 (日):</span>
          {[1, 7, 30].map((d) => (
            <button
              key={d}
              onClick={() => void setTtl(d)}
              className={cn(
                'duration-fast rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                settings.cacheTtlDays === d
                  ? 'border-accent-500 bg-accent-500/12 text-accent-700 dark:text-accent-300'
                  : 'border-border text-fg-muted hover:bg-surface-muted',
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <label className="border-border bg-surface-elevated flex items-start gap-3 rounded-md border p-3">
        <input
          type="checkbox"
          checked={settings.showFallbackLink}
          onChange={(e) => void setFallback(e.target.checked)}
          className="accent-accent-600 mt-1 h-4 w-4 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="text-fg-default text-sm font-medium">
            取得失敗時に「検索」リンクを出す
          </div>
          <p className="text-fg-subtle mt-0.5 text-[11px]">
            CAPTCHA / マッチング失敗時、食べログ / Maps 手動検索リンクを表示します。
          </p>
        </div>
      </label>
    </div>
  );
}
