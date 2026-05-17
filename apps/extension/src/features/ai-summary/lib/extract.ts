import { Readability } from '@mozilla/readability';
import type { ExtractedPage } from '../types';

const MAX_CHARS = 50_000;

interface RawPage {
  title: string;
  url: string;
  html: string;
  bodyText: string;
}

/**
 * Runs inside the active tab via `chrome.scripting.executeScript`. Returns the
 * raw HTML so the popup can run Readability on it (keeps content scripts
 * lightweight; Readability is ~22 KB and only needed when we summarize).
 */
function grabRawPage(): RawPage {
  return {
    title: document.title || '',
    url: location.href,
    html: document.documentElement.outerHTML,
    bodyText: document.body?.innerText ?? '',
  };
}

function truncate(text: string, max = MAX_CHARS): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '\n\n[…content truncated to fit context window]';
}

export async function extractActiveTab(): Promise<ExtractedPage | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;

  // chrome:// and a few other schemes can't be scripted into.
  if (
    !tab.url ||
    tab.url.startsWith('chrome://') ||
    tab.url.startsWith('chrome-extension://') ||
    tab.url.startsWith('edge://') ||
    tab.url.startsWith('about:')
  ) {
    return null;
  }

  let raw: RawPage;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: grabRawPage,
    });
    const result = results?.[0]?.result;
    if (!result) return null;
    raw = result;
  } catch (err) {
    console.warn('[ai-summary] executeScript failed', err);
    return null;
  }

  try {
    const doc = new DOMParser().parseFromString(raw.html, 'text/html');
    // Resolve <base> so relative links survive Readability if we ever render
    // the article HTML (we currently use textContent only).
    if (!doc.head.querySelector('base')) {
      const base = doc.createElement('base');
      base.href = raw.url;
      doc.head.insertBefore(base, doc.head.firstChild);
    }
    const article = new Readability(doc).parse();
    if (article && article.textContent && article.textContent.trim().length > 200) {
      return {
        title: article.title || raw.title,
        url: raw.url,
        byline: article.byline ?? '',
        siteName: article.siteName ?? '',
        excerpt: article.excerpt ?? '',
        content: truncate(article.textContent.trim()),
        length: article.textContent.length,
        fallback: false,
      };
    }
  } catch (err) {
    console.warn('[ai-summary] Readability parse failed, falling back', err);
  }

  // Fallback: best-effort body text.
  const text = (raw.bodyText || '').trim();
  return {
    title: raw.title,
    url: raw.url,
    byline: '',
    siteName: '',
    excerpt: text.slice(0, 200),
    content: truncate(text),
    length: text.length,
    fallback: true,
  };
}

export async function hashContent(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
