import { useEffect, useState } from 'react';
import { readConfig, subscribeConfig } from './storage';
import { DEFAULT_AUTO_RELOAD_CONFIG, type AutoReloadConfig } from './types';

export function useAutoReloadConfig(): AutoReloadConfig {
  const [config, setConfig] = useState<AutoReloadConfig>(DEFAULT_AUTO_RELOAD_CONFIG);

  useEffect(() => {
    let cancelled = false;
    void readConfig().then((cfg) => {
      if (!cancelled) setConfig(cfg);
    });
    const unsubscribe = subscribeConfig(setConfig);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return config;
}

export function useActiveTab(): chrome.tabs.Tab | null {
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);

  useEffect(() => {
    let cancelled = false;
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([active]) => {
        if (!cancelled && active) setTab(active);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return tab;
}
