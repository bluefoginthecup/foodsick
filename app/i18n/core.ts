import en from './en.json' with { type: 'json' };
import zh from './zh-CN.json' with { type: 'json' };
import ja from './ja.json' with { type: 'json' };
import vi from './vi.json' with { type: 'json' };

export const locales = ['ko', 'en', 'zh-CN', 'ja', 'vi'] as const;
export type Locale = typeof locales[number];
export const languageNames: Record<Locale, string> = { ko: '한국어', en: 'English', 'zh-CN': '简体中文', ja: '日本語', vi: 'Tiếng Việt' };
export const localeTags: Record<Locale, string> = { ko: 'ko-KR', en: 'en-US', 'zh-CN': 'zh-CN', ja: 'ja-JP', vi: 'vi-VN' };
export const LANGUAGE_KEY = 'nadoapa.language';
export const LANGUAGE_COOKIE = 'nadoapa_language';
const catalogs: Record<Exclude<Locale, 'ko'>, Record<string, string>> = { en, 'zh-CN': zh, ja, vi };
export function isLocale(value: unknown): value is Locale { return locales.includes(value as Locale); }
export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.trim().toLowerCase().split(/[-_]/)[0];
    if (base === 'zh') return 'zh-CN';
    if (base === 'ko' || base === 'en' || base === 'ja' || base === 'vi') return base;
  }
  return languages.length ? 'en' : 'ko';
}
export function requestLocale(cookie: string | null, acceptLanguage: string | null): Locale {
  const stored = cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${LANGUAGE_COOKIE}=`))?.split('=')[1];
  if (isLocale(stored)) return stored;
  const languages = (acceptLanguage || '').split(',').map((part, index) => {
    const [tag, quality] = part.trim().split(';q=');
    return { tag, weight: quality === undefined ? 1 : Number(quality), index };
  }).filter(item => item.tag && item.tag !== '*' && item.weight > 0).sort((a, b) => b.weight - a.weight || a.index - b.index).map(item => item.tag);
  return detectLocale(languages);
}
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = Object.keys(en).filter(key => /\{\d+\}/.test(key)).sort((a, b) => b.replace(/\{\d+\}/g, '').length - a.replace(/\{\d+\}/g, '').length).map(key => {
  const slots: string[] = [];
  const parts = key.split(/(\{\d+\})/g).map(part => {
    if (/^\{\d+\}$/.test(part)) { slots.push(part); return '(.*?)'; }
    return escape(part);
  });
  return { key, slots, regex: new RegExp(`^${parts.join('')}$`) };
});

// Translate display strings only. Never pass the result back to storage or an API.
export function translateText(input: string, locale: Locale, depth = 0): string {
  if (locale === 'ko' || !input) return input;
  const key = normalize(input);
  const catalog = catalogs[locale];
  let translated = catalog[key];
  if (!translated && depth < 3) {
    for (const pattern of patterns) {
      const match = pattern.regex.exec(key);
      if (!match || !catalog[pattern.key]) continue;
      const values = new Map(pattern.slots.map((slot, i) => [slot, translateText(match[i + 1], locale, depth + 1)]));
      translated = catalog[pattern.key].replace(/\{\d+\}/g, slot => values.get(slot) ?? slot);
      break;
    }
    if (!translated && /[,·]\s/.test(key)) {
      const parts = key.split(/(,\s+|\s+·\s+)/);
      translated = parts.map(part => translateText(part, locale, depth + 1)).join('');
    }
  }
  if (!translated) return input;
  return (input.match(/^\s*/)?.[0] ?? '') + translated + (input.match(/\s*$/)?.[0] ?? '');
}
