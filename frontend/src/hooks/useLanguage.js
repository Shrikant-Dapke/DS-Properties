import { useContext } from 'react';
import { LanguageContext } from '../contexts/languageContextDef.js';
import i18n from '../i18n/index.js';

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (ctx) return ctx;
  return {
    language: i18n.language || 'en',
    setLanguage: (lng) => i18n.changeLanguage(lng),
  };
}
