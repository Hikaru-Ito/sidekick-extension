import { useEffect, useState } from 'react';
import { ArrowLeft, Github, Moon, Settings, Sun } from 'lucide-react';
import { IconButton, cn } from '@sidekick/ui-kit';
import { features } from '../../features/registry';
import { HomeView } from './views/HomeView';
import { FeatureView } from './views/FeatureView';

type View = { kind: 'home' } | { kind: 'feature'; id: string };

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
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    void chrome.storage.sync.set({ 'sidekick:theme': theme }).catch(() => {});
  }, [theme]);

  return { theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) };
}

export function App() {
  const [view, setView] = useState<View>({ kind: 'home' });
  const { theme, toggle } = useTheme();

  const currentFeature =
    view.kind === 'feature' ? features.find((f) => f.id === view.id) : undefined;

  return (
    <div className="flex h-full min-h-[420px] flex-col bg-surface">
      <header
        className={cn(
          'flex h-12 shrink-0 items-center gap-1 border-b border-border px-3',
          'bg-surface-elevated/80 backdrop-blur',
        )}
      >
        {view.kind === 'feature' ? (
          <IconButton
            label="戻る"
            size="sm"
            onClick={() => setView({ kind: 'home' })}
          >
            <ArrowLeft className="h-4 w-4" />
          </IconButton>
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-500/12 text-accent-600">
            <SidekickLogo />
          </div>
        )}
        <div className="ml-1 min-w-0 flex-1">
          <h1 className="text-sm font-semibold leading-none text-fg-default">
            {currentFeature?.name ?? 'Sidekick'}
          </h1>
          {view.kind === 'home' ? (
            <p className="mt-0.5 text-[11px] text-fg-subtle">便利機能をひとつに</p>
          ) : (
            <p className="mt-0.5 text-[11px] text-fg-subtle line-clamp-1">
              {currentFeature?.description}
            </p>
          )}
        </div>
        <IconButton label={theme === 'dark' ? 'ライトモード' : 'ダークモード'} size="sm" onClick={toggle}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </IconButton>
        <IconButton
          label="GitHub"
          size="sm"
          onClick={() =>
            chrome.tabs.create({
              url: 'https://github.com/Hikaru-Ito/sidekick-extension',
            })
          }
        >
          <Github className="h-4 w-4" />
        </IconButton>
        {view.kind === 'home' ? (
          <IconButton
            label="設定"
            size="sm"
            onClick={() => chrome.runtime.openOptionsPage?.()}
          >
            <Settings className="h-4 w-4" />
          </IconButton>
        ) : null}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-3">
        {view.kind === 'home' ? (
          <HomeView onSelect={(id) => setView({ kind: 'feature', id })} />
        ) : currentFeature ? (
          <FeatureView feature={currentFeature} />
        ) : (
          <p className="text-sm text-fg-muted">機能が見つかりません</p>
        )}
      </main>

      <footer className="shrink-0 border-t border-border bg-surface-muted/50 px-3 py-2 text-[10px] text-fg-subtle">
        Sidekick v0.1.0 · {features.length} 機能 · MIT OSS
      </footer>
    </div>
  );
}

function SidekickLogo() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}
