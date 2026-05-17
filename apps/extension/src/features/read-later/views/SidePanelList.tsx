import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookmarkX,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Globe,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Button, Card, CardContent, Input, cn } from '@sidekick/ui-kit';
import { KeyPointCards } from '../../ai-summary/components/KeyPointCards';
import { StreamingMarkdown } from '../../ai-summary/components/StreamingMarkdown';
import { useReadLaterItems } from '../hooks';
import { deleteItem, patchItem } from '../lib/db';
import type { ReadLaterItem, WebhookDelivery } from '../types';
import { WEBHOOK_PROVIDER_LABEL } from '../types';

type Filter = 'all' | 'unread' | 'read';

export function SidePanelList() {
  const { items, loading } = useReadLaterItems();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const allTags = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      for (const t of it.tags) map.set(t, (map.get(t) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (filter === 'unread' && it.readAt !== null) return false;
      if (filter === 'read' && it.readAt === null) return false;
      if (activeTag && !it.tags.includes(activeTag)) return false;
      if (q) {
        const hay =
          `${it.title}\n${it.hostname}\n${it.description}\n${it.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, filter, search, activeTag]);

  const counts = useMemo(
    () => ({
      all: items.length,
      unread: items.filter((it) => it.readAt === null).length,
      read: items.filter((it) => it.readAt !== null).length,
    }),
    [items],
  );

  const toggleExpand = (id: string) => {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleRead = async (it: ReadLaterItem) => {
    await patchItem(it.id, { readAt: it.readAt === null ? Date.now() : null });
  };

  const remove = async (it: ReadLaterItem) => {
    if (!confirm(`削除しますか?\n\n${it.title}`)) return;
    await deleteItem(it.id);
  };

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h2 className="text-fg-default flex items-center gap-2 text-lg font-semibold">
          📚 あとで読む
        </h2>
        <p className="text-fg-subtle mt-1 text-xs">
          {counts.unread > 0
            ? `未読 ${counts.unread} 件 · 全 ${counts.all} 件`
            : `全 ${counts.all} 件`}
        </p>
      </header>

      <div className="flex flex-col gap-2.5">
        <div className="border-border bg-surface-elevated flex items-center gap-2 rounded-md border px-3 py-2">
          <Search className="text-fg-subtle h-4 w-4 shrink-0" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="タイトル / URL / タグで検索…"
            className="border-0 px-0 text-sm focus-visible:ring-0"
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'unread', 'read'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'duration-fast rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                filter === f
                  ? 'border-accent-500 bg-accent-500/12 text-accent-700 dark:text-accent-300'
                  : 'border-border text-fg-muted hover:bg-surface-muted',
              )}
            >
              {f === 'all' ? '全て' : f === 'unread' ? '未読' : '読了'}
              <span className="ml-1 tabular-nums">{counts[f]}</span>
            </button>
          ))}
        </div>
        {allTags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {allTags.slice(0, 12).map(([tag, count]) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={cn(
                  'duration-fast rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors',
                  activeTag === tag
                    ? 'bg-accent-600 text-white'
                    : 'bg-surface-muted text-fg-muted hover:bg-surface-muted/80',
                )}
              >
                #{tag}
                <span className="ml-1 tabular-nums opacity-70">{count}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="text-fg-muted flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> 読み込み中…
        </div>
      ) : filtered.length === 0 ? (
        items.length === 0 ? (
          <EmptyState />
        ) : (
          <NoMatchState />
        )
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((it) => (
            <ItemRow
              key={it.id}
              item={it}
              expanded={expanded.has(it.id)}
              onToggleExpand={() => toggleExpand(it.id)}
              onToggleRead={() => toggleRead(it)}
              onDelete={() => remove(it)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
        <div className="bg-accent-500/12 text-accent-600 flex h-12 w-12 items-center justify-center rounded-lg">
          📚
        </div>
        <div>
          <h3 className="text-fg-default text-base font-semibold">まだ保存がありません</h3>
          <p className="text-fg-muted mt-1 text-sm">
            気になるページを開いて、ツールバー → 「あとで読む」 から保存できます。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function NoMatchState() {
  return (
    <p className="text-fg-muted py-8 text-center text-sm">条件に一致するアイテムがありません。</p>
  );
}

function ItemRow({
  item,
  expanded,
  onToggleExpand,
  onToggleRead,
  onDelete,
}: {
  item: ReadLaterItem;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleRead: () => void;
  onDelete: () => void;
}) {
  const isRead = item.readAt !== null;
  const hasSummary = item.summary !== null;
  const openPage = () => {
    void chrome.tabs.create({ url: item.url });
  };

  return (
    <li
      className={cn(
        'border-border bg-surface-elevated shadow-xs rounded-lg border p-3',
        isRead && 'opacity-70',
      )}
    >
      <div className="flex items-start gap-3">
        {item.favicon ? (
          <img
            src={item.favicon}
            alt=""
            className="mt-0.5 h-5 w-5 shrink-0 rounded-sm"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <Globe className="text-fg-subtle mt-0.5 h-5 w-5 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <button
            onClick={openPage}
            className="text-fg-default hover:text-accent-600 block text-left text-base font-semibold leading-snug"
          >
            {item.title}
          </button>
          <div className="text-fg-subtle mt-0.5 truncate text-xs">
            {item.hostname} · {formatRelative(item.savedAt)}
            {isRead ? ' · 読了' : ''}
          </div>
          {item.description ? (
            <p className="text-fg-muted mt-1.5 line-clamp-2 text-sm leading-snug">
              {item.description}
            </p>
          ) : null}
          {item.tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.tags.map((t) => (
                <span
                  key={t}
                  className="bg-surface-muted text-fg-muted rounded-full px-2 py-0.5 text-[10px] font-medium"
                >
                  #{t}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
        {hasSummary ? (
          <button
            onClick={onToggleExpand}
            className="bg-accent-500/12 text-accent-700 dark:text-accent-300 hover:bg-accent-500/20 flex items-center gap-1 rounded-full px-2 py-0.5 font-medium transition-colors"
          >
            <Sparkles className="h-3 w-3" />
            要約あり
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        ) : null}
        {item.deliveries.map((d) => (
          <DeliveryBadge key={d.webhookId} delivery={d} />
        ))}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={onToggleRead}
            aria-label={isRead ? '未読に戻す' : '読了にする'}
            className="text-fg-muted hover:bg-surface-muted hover:text-fg-default flex h-7 w-7 items-center justify-center rounded transition-colors"
          >
            {isRead ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onDelete}
            aria-label="削除"
            className="text-fg-muted hover:bg-danger/10 hover:text-danger flex h-7 w-7 items-center justify-center rounded transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {expanded && item.summary ? (
        <div className="border-border mt-3 space-y-3 border-t pt-3">
          {item.summary.keypoints.length > 0 ? (
            <KeyPointCards points={item.summary.keypoints} />
          ) : null}
          {item.summary.overview ? (
            <div className="bg-surface-muted/40 rounded-md p-3">
              <StreamingMarkdown text={item.summary.overview} />
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function DeliveryBadge({ delivery }: { delivery: WebhookDelivery }) {
  const label = `${WEBHOOK_PROVIDER_LABEL[delivery.provider]}: ${delivery.webhookName}`;
  if (delivery.status === 'sent') {
    return (
      <span
        className="bg-success/12 text-success flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
        title={label}
      >
        <Check className="h-3 w-3" />
        {WEBHOOK_PROVIDER_LABEL[delivery.provider]}
      </span>
    );
  }
  if (delivery.status === 'failed') {
    return (
      <span
        className="bg-danger/12 text-danger flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
        title={`${label}\n${delivery.error ?? ''}`}
      >
        <AlertTriangle className="h-3 w-3" />
        {WEBHOOK_PROVIDER_LABEL[delivery.provider]}
      </span>
    );
  }
  if (delivery.status === 'skipped') {
    return null;
  }
  return (
    <span
      className="bg-surface-muted text-fg-muted flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
      title={label}
    >
      <Clock className="h-3 w-3" />
      {WEBHOOK_PROVIDER_LABEL[delivery.provider]}
    </span>
  );
}

function formatRelative(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return 'たった今';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 時間前`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 日前`;
  return new Date(timestamp).toLocaleDateString('ja-JP');
}
