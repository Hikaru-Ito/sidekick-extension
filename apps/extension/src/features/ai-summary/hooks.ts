import { useEffect, useState } from 'react';
import { readHistory, readSettings, subscribeHistory, subscribeSettings } from './storage';
import { DEFAULT_SETTINGS, type AISummarySettings, type HistoryEntry } from './types';

export function useAISummarySettings(): AISummarySettings {
  const [settings, setSettings] = useState<AISummarySettings>(DEFAULT_SETTINGS);
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

export function useAISummaryHistory(): HistoryEntry[] {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  useEffect(() => {
    let cancelled = false;
    void readHistory().then((h) => {
      if (!cancelled) setHistory(h);
    });
    const unsub = subscribeHistory(setHistory);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);
  return history;
}
