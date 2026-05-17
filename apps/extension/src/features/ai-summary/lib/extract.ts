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

/**
 * Find the best cover image for the page. Priority:
 *   1. og:image / og:image:url / og:image:secure_url
 *   2. twitter:image / twitter:image:src
 *   3. JSON-LD article image
 *   4. link rel="image_src"
 *   5. Largest visible <img> in the article body (heuristic fallback)
 * Returns an absolute URL or undefined.
 */
export function findCoverImage(doc: Document, baseUrl: string): string | undefined {
  const metaSelectors = [
    'meta[property="og:image"]',
    'meta[property="og:image:url"]',
    'meta[property="og:image:secure_url"]',
    'meta[name="og:image"]',
    'meta[name="twitter:image"]',
    'meta[name="twitter:image:src"]',
    'meta[property="twitter:image"]',
  ];
  for (const sel of metaSelectors) {
    const el = doc.querySelector(sel);
    const content = el?.getAttribute('content');
    if (content) {
      const abs = toAbsolute(content, baseUrl);
      if (abs) return abs;
    }
  }

  // JSON-LD: look for objects with an `image` field. Articles often expose
  // either a string or { "@type": "ImageObject", "url": ... }.
  const ldNodes = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  for (const node of ldNodes) {
    const raw = node.textContent;
    if (!raw) continue;
    try {
      const data: unknown = JSON.parse(raw);
      const image = findImageInLd(data);
      if (image) {
        const abs = toAbsolute(image, baseUrl);
        if (abs) return abs;
      }
    } catch {
      /* JSON-LD blocks frequently contain malformed JSON; skip silently. */
    }
  }

  const linkImage = doc.querySelector('link[rel="image_src"]')?.getAttribute('href');
  if (linkImage) {
    const abs = toAbsolute(linkImage, baseUrl);
    if (abs) return abs;
  }

  return undefined;
}

function findImageInLd(node: unknown): string | undefined {
  if (!node) return undefined;
  if (typeof node === 'string') return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findImageInLd(child);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof node !== 'object') return undefined;
  const obj = node as Record<string, unknown>;
  const image = obj.image;
  if (image) {
    if (typeof image === 'string') return image;
    if (Array.isArray(image)) {
      for (const it of image) {
        if (typeof it === 'string') return it;
        if (it && typeof it === 'object') {
          const url = (it as Record<string, unknown>).url;
          if (typeof url === 'string') return url;
        }
      }
    }
    if (typeof image === 'object') {
      const url = (image as Record<string, unknown>).url;
      if (typeof url === 'string') return url;
    }
  }
  // Recurse into common nested shapes (`@graph`, `mainEntity`, ...).
  for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage']) {
    const val = obj[key];
    if (val) {
      const found = findImageInLd(val);
      if (found) return found;
    }
  }
  return undefined;
}

function toAbsolute(raw: string, baseUrl: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    return new URL(trimmed, baseUrl).href;
  } catch {
    return undefined;
  }
}

/** Fallback heuristic: largest <img> in the parsed article HTML (Readability output). */
function findLargestImage(html: string, baseUrl: string): string | undefined {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let bestUrl: string | undefined;
  let bestArea = 0;
  for (const img of Array.from(doc.querySelectorAll('img'))) {
    const src = img.getAttribute('src') || img.getAttribute('data-src');
    if (!src) continue;
    const abs = toAbsolute(src, baseUrl);
    if (!abs || abs.startsWith('data:')) continue;
    const w = Number(img.getAttribute('width')) || 0;
    const h = Number(img.getAttribute('height')) || 0;
    const area = w * h || 1; // unknown dimensions fall back to "any image is fine"
    if (area > bestArea) {
      bestArea = area;
      bestUrl = abs;
    }
  }
  return bestUrl;
}

function truncate(text: string, max = MAX_CHARS): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '\n\n[…content truncated to fit context window]';
}

export async function extractActiveTab(): Promise<ExtractedPage | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  return extractTab(tab.id, tab.url);
}

/**
 * Same as `extractActiveTab` but driven by a specific tab id. Callable from
 * the background service worker where there is no "current window".
 */
export async function extractTab(tabId: number, knownUrl?: string): Promise<ExtractedPage | null> {
  let url = knownUrl;
  if (!url) {
    try {
      const tab = await chrome.tabs.get(tabId);
      url = tab?.url;
    } catch {
      return null;
    }
  }
  // chrome:// and a few other schemes can't be scripted into.
  if (
    !url ||
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:')
  ) {
    return null;
  }

  let raw: RawPage;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: grabRawPage,
    });
    const result = results?.[0]?.result;
    if (!result) return null;
    raw = result;
  } catch (err) {
    console.warn('[ai-summary] executeScript failed', err);
    return null;
  }

  let coverImage: string | undefined;
  try {
    const doc = new DOMParser().parseFromString(raw.html, 'text/html');
    // Resolve <base> so relative links survive Readability if we ever render
    // the article HTML (we currently use textContent only).
    if (!doc.head.querySelector('base')) {
      const base = doc.createElement('base');
      base.href = raw.url;
      doc.head.insertBefore(base, doc.head.firstChild);
    }
    coverImage = findCoverImage(doc, raw.url);
    const article = new Readability(doc).parse();
    if (article && article.textContent && article.textContent.trim().length > 200) {
      // Heuristic fallback when meta tags were silent: use the largest <img>
      // Readability found in the article body.
      if (!coverImage && article.content) {
        coverImage = findLargestImage(article.content, raw.url);
      }
      return {
        title: article.title || raw.title,
        url: raw.url,
        byline: article.byline ?? '',
        siteName: article.siteName ?? '',
        excerpt: article.excerpt ?? '',
        content: truncate(article.textContent.trim()),
        length: article.textContent.length,
        fallback: false,
        image: coverImage,
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
    image: coverImage,
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
