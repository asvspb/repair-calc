import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ru from './locales/ru.json';
import en from './locales/en.json';

i18n.use(initReactI18next).init({
  lng: 'ru',
  resources: {
    ru: { translation: ru },
    en: { translation: en },
  },
  fallbackLng: 'ru',
  defaultNS: 'translation',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
