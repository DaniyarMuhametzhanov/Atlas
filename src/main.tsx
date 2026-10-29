import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/unbounded/500.css';
import '@fontsource/unbounded/700.css';
import '@fontsource/golos-text/400.css';
import '@fontsource/golos-text/500.css';
import '@fontsource/golos-text/600.css';
import './styles/global.css';
import { App } from './app/App';
import { initTelegram } from './telegram/telegram';

// внутри Telegram: развернуть, свои цвета, ссылки во встроенном браузере (вне Telegram ничего не делает)
initTelegram();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
