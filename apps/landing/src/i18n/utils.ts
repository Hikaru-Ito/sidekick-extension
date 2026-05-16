import { DEFAULT_LOCALE, LOCALES, type Locale } from './types';

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Extract the locale from a URL pathname (returns the default locale otherwise). */
export function getLocaleFromPath(pathname: string): Locale {
  const trimmed = pathname.replace(/^\/+/, '').replace(/^sidekick-extension\//, '');
  const first = trimmed.split('/')[0];
  return first && isLocale(first) ? first : DEFAULT_LOCALE;
}

/**
 * Build a localized path. English (default) routes have no prefix; non-default
 * locales are prefixed with the locale segment.
 *
 * Examples:
 *   localizePath('/install', 'en')  => '/install'
 *   localizePath('/install', 'ja')  => '/ja/install'
 *   localizePath('/', 'ja')         => '/ja/'
 */
export function localizePath(path: string, locale: Locale): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return clean;
  if (clean === '/') return `/${locale}/`;
  return `/${locale}${clean}`;
}

/** Strip the locale prefix from a path (so it matches the source route). */
export function unlocalizePath(path: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return path;
  const prefix = `/${locale}`;
  if (path === prefix || path === `${prefix}/`) return '/';
  if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length);
  return path;
}
