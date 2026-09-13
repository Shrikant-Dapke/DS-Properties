import { useEffect, useState } from 'react';
import i18n, { LANGUAGE_STORAGE_KEY } from '../i18n/index.js';
import { LanguageContext } from './languageContextDef.js';

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(i18n.language || 'en');

  const setLanguage = (lng) => {
    i18n.changeLanguage(lng);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
    } catch {
      // ignore storage failures (private mode, etc.)
    }
    if (typeof document !== 'undefined') document.documentElement.lang = lng;
    setLanguageState(lng);
  };

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = language;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>
  );
}
