import { useEffect, useState } from 'react';
import { listItems, subscribeChanges } from './lib/db';
import { readSettings, subscribeSettings } from './storage';
import { DEFAULT_SETTINGS, type ReadLaterItem, type ReadLaterSettings } from './types';

export function useReadLaterSettings(): ReadLaterSettings {
  const [settings, setSettings] = useState<ReadLaterSettings>(DEFAULT_SETTINGS);
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
  return settings;
}

export function useReadLaterItems(): {
  items: ReadLaterItem[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [items, setItems] = useState<ReadLaterItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const data = await listItems();
    setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await listItems();
      if (!cancelled) {
        setItems(data);
        setLoading(false);
      }
    })();
    const unsub = subscribeChanges(() => {
      void listItems().then((data) => {
        if (!cancelled) setItems(data);
      });
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return { items, loading, refresh: load };
}
