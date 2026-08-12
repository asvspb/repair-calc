// Отключаем StrictMode для dev — предотвращает дублирование запросов
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';
import { logDebug } from './utils/logger';

const appVersion = import.meta.env.VITE_APP_VERSION || 'unknown';
const commitHash = import.meta.env.VITE_COMMIT_HASH || 'unknown';
const buildTime = import.meta.env.VITE_BUILD_TIME || 'unknown';
logDebug('App', `🚀 v${appVersion} | commit: ${commitHash} | built: ${buildTime}`);

createRoot(document.getElementById('root')!).render(<App />);
