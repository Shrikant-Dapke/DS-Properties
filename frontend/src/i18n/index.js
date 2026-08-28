import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import mr from './mr.json';

export const LANGUAGE_STORAGE_KEY = 'dsp_language';
export const SUPPORTED_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'mr', label: 'मराठी' },
];

const saved =
  (typeof localStorage !== 'undefined' && localStorage.getItem(LANGUAGE_STORAGE_KEY)) || 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    mr: { translation: mr },
  },
  lng: saved,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = saved;
}

export default i18n;
