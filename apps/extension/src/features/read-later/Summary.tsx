import { useEffect, useState } from 'react';
import { countItems, subscribeChanges } from './lib/db';

export function ReadLaterSummary() {
  const [counts, setCounts] = useState<{ total: number; unread: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      countItems().then((c) => {
        if (!cancelled) setCounts(c);
      });
    void load();
    const unsub = subscribeChanges(() => void load());
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  if (!counts) return null;
  if (counts.total === 0) {
    return <span className="text-fg-subtle text-xs">空</span>;
  }
  if (counts.unread > 0) {
    return (
      <span className="text-fg-muted text-xs">
        未読 <strong className="text-fg-default">{counts.unread}</strong> / {counts.total}
      </span>
    );
  }
  return <span className="text-fg-muted text-xs">{counts.total} 件</span>;
}
