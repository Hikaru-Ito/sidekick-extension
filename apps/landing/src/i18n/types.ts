export const LOCALES = ['en', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const localeMeta: Record<Locale, { label: string; htmlLang: string }> = {
  en: { label: 'English', htmlLang: 'en' },
  ja: { label: '日本語', htmlLang: 'ja' },
};
