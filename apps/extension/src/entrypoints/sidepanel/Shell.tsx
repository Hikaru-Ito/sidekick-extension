import { useEffect, useState } from 'react';
import { BookmarkPlus, Github, Moon, PanelLeftClose, Sparkles, Sun } from 'lucide-react';
import { IconButton, cn } from '@sidekick/ui-kit';
import { SidePanelApp } from '../../features/ai-summary/views/SidePanelApp';
import { SidePanelList } from '../../features/read-later/views/SidePanelList';

type View = 'ai-summary' | 'read-later';

function readView(): View {
  if (typeof window === 'undefined') return 'ai-summary';
  const params = new URLSearchParams(window.location.search);
  return params.get('view') === 'read-later' ? 'read-later' : 'ai-summary';
}

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    void chrome.storage.sync
      .get('sidekick:theme')
      .then((res) => {
        const stored = res['sidekick:theme'];
        if (stored === 'light' || stored === 'dark') setTheme(stored);
      })
      .catch(() => {
        /* noop */
      });
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      const next = changes['sidekick:theme']?.newValue;
      if (next === 'light' || next === 'dark') setTheme(next);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    void chrome.storage.sync.set({ 'sidekick:theme': theme }).catch(() => {});
  }, [theme]);

  return { theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) };
}

const VIEW_LABELS: Record<View, { title: string; subtitle: string; Icon: typeof Sparkles }> = {
  'ai-summary': {
    title: 'ページAI要約',
    subtitle: 'Powered by Claude · BYOK',
    Icon: Sparkles,
  },
  'read-later': {
    title: 'あとで読む',
    subtitle: '保存したページを一覧・整理',
    Icon: BookmarkPlus,
  },
};

export function SidePanelShell() {
  const { theme, toggle } = useTheme();
  const [view, setView] = useState<View>(() => readView());

  // React to URL changes (back/forward) even though we don't use a router.
  useEffect(() => {
    const onPop = () => setView(readView());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const closePanel = () => {
    try {
      // @ts-expect-error newer Chrome API
      chrome.sidePanel.close?.();
    } catch {
      window.close();
    }
  };

  const meta = VIEW_LABELS[view];
  const Icon = meta.Icon;

  return (
    <div className="bg-surface flex h-full min-h-0 flex-col">
      <header
        className={cn(
          'border-border bg-surface-elevated/80 flex h-12 shrink-0 items-center gap-2 border-b px-3 backdrop-blur',
        )}
      >
        <div className="bg-accent-500/12 text-accent-600 flex h-7 w-7 items-center justify-center rounded-md">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-fg-default truncate text-sm font-semibold leading-none">
            {meta.title}
          </h1>
          <p className="text-fg-subtle mt-0.5 text-[11px]">{meta.subtitle}</p>
        </div>
        <IconButton
          label={theme === 'dark' ? 'ライトモード' : 'ダークモード'}
          size="sm"
          onClick={toggle}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </IconButton>
        <IconButton
          label="GitHub"
          size="sm"
          onClick={() =>
            chrome.tabs.create({ url: 'https://github.com/Hikaru-Ito/sidekick-extension' })
          }
        >
          <Github className="h-4 w-4" />
        </IconButton>
        <IconButton label="パネルを閉じる" size="sm" onClick={closePanel}>
          <PanelLeftClose className="h-4 w-4" />
        </IconButton>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        {view === 'ai-summary' ? <SidePanelApp /> : <SidePanelList />}
      </main>

      <footer className="border-border bg-surface-muted/50 text-fg-subtle shrink-0 border-t px-3 py-1.5 text-[10px]">
        Sidekick · MIT OSS · 端末ローカルで処理されます
      </footer>
    </div>
  );
}
