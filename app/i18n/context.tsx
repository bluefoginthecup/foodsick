"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { isLocale, languageNames, LANGUAGE_COOKIE, LANGUAGE_KEY, locales, localeTags, translateText, type Locale } from './core';

type I18nContext = { language: Locale; setLanguage: (language: Locale) => void };
const Context = createContext<I18nContext>({ language: 'ko', setLanguage: () => {} });
export function I18nProvider({ children, initialLocale = 'ko' }: { children: ReactNode; initialLocale?: Locale }) {
  const [language, setLanguage] = useState<Locale>(initialLocale);
  const pathname = usePathname();
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANGUAGE_KEY);
      if (isLocale(stored)) queueMicrotask(() => setLanguage(stored));
    } catch { /* Language selection still works when storage is unavailable. */ }
  }, []);
  useEffect(() => {
    document.documentElement.lang = language === 'zh-CN' ? 'zh-Hans' : language;
    try { localStorage.setItem(LANGUAGE_KEY, language); } catch { /* Private browsing. */ }
    try { document.cookie = `${LANGUAGE_COOKIE}=${language}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`; } catch { /* Sandboxed browsers may block cookies. */ }
  }, [language]);
  useEffect(() => {
    const titles: Record<string, string> = {
      '/': '나두아파 | 식중독 의심 증상 지도·신고 안내',
      '/resources': '논문·참고자료 | 나두아파',
      '/law-help': '법률 대응·판례·상담 안내 | 나두아파',
      '/about': '서비스 소개·자주 묻는 질문 | 나두아파',
    };
    if (titles[pathname]) document.title = translateText(titles[pathname], language);
  }, [language, pathname]);
  const value = useMemo(() => ({ language, setLanguage }), [language]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useI18n() {
  const { language, setLanguage } = useContext(Context);
  return useMemo(() => {
    const t = <T extends string | undefined | null,>(value: T): T => (typeof value === 'string' ? translateText(value, language) : value) as T;
    const number = new Intl.NumberFormat(localeTags[language]);
    const text = (value: ReactNode): ReactNode => typeof value === 'string' ? t(value) : typeof value === 'number' ? number.format(value) : Array.isArray(value) ? value.map(text) : value;
    const message = (key: string, values: readonly (string | number)[]) => t(key).replace(/\{(\d+)\}/g, (token, index) => String(values[Number(index)] ?? token));
    return { language, setLanguage, locale: localeTags[language], t, text, message };
  }, [language, setLanguage]);
}
export function LanguageSelect() {
  const { language, setLanguage, t } = useI18n();
  return <label className="language-select"><span aria-hidden="true">🌐</span><span className="sr-only">{t('언어')}</span>
    <select aria-label={t('언어')} value={language} onChange={event => { if (isLocale(event.target.value)) setLanguage(event.target.value); }}>
      {locales.map(locale => <option key={locale} value={locale} lang={locale} translate="no">{languageNames[locale]}</option>)}
    </select>
  </label>;
}
