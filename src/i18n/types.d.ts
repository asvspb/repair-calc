import 'i18next';
import ru from './locales/ru.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: typeof ru;
    nsSeparator: '.';
  }
}
