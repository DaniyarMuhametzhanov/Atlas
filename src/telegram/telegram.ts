// Работа внутри Telegram (Mini App). Вне Telegram все функции ничего не делают.
// SDK (telegram-web-app.js) подключает index.html — только когда сайт открыт из Telegram.
import { navigate, type Route } from '../app/router';

type Haptic = { selectionChanged(): void };
type WebApp = {
  initData: string;
  version: string;
  colorScheme: 'light' | 'dark';
  ready(): void;
  expand(): void;
  disableVerticalSwipes?: () => void;
  isVersionAtLeast(v: string): boolean;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  openLink(url: string): void;
  openTelegramLink(url: string): void;
  onEvent(event: 'themeChanged', cb: () => void): void;
  offEvent(event: 'themeChanged', cb: () => void): void;
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
  HapticFeedback?: Haptic;
};

const tg = (globalThis as { Telegram?: { WebApp?: WebApp } }).Telegram?.WebApp;
/** Сайт открыт внутри Telegram */
export const TELEGRAM = !!tg && document.documentElement.classList.contains('tg');

/**
 * Ссылка на мини-приложение в Telegram, например https://t.me/AtlasGuideBot/atlas (задаётся при сборке:
 * VITE_TG_APP_LINK). Без неё «Поделиться» отправляет ссылку на сайт.
 */
const APP_LINK = (import.meta.env.VITE_TG_APP_LINK as string | undefined) ?? '';

/** Тема Telegram — для режима «как в системе» */
export const telegramScheme = (): 'light' | 'dark' | null => (TELEGRAM ? tg!.colorScheme : null);

export function onTelegramTheme(cb: () => void): () => void {
  if (!TELEGRAM) return () => {};
  tg!.onEvent('themeChanged', cb);
  return () => tg!.offEvent('themeChanged', cb);
}

/** Запуск: сказать Telegram, что приложение готово, развернуть на весь экран, не сворачивать жестом вниз (он двигает карту) */
export function initTelegram() {
  if (!TELEGRAM) return;
  tg!.ready();
  tg!.expand();
  if (tg!.isVersionAtLeast('7.7')) tg!.disableVerticalSwipes?.();
  paintTelegram();
  // ссылки «в новой вкладке» (Commons, источники) — во встроенном браузере Telegram
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement | null)?.closest?.('a[target="_blank"]') as HTMLAnchorElement | null;
    if (!a?.href) return;
    e.preventDefault();
    tg!.openLink(a.href);
  });
}

/** Шапка и фон Telegram — в цвет сайта (после смены темы тоже) */
export function paintTelegram() {
  if (!TELEGRAM || !tg!.isVersionAtLeast('6.1')) return;
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if (!/^#[0-9a-f]{6}$/i.test(bg)) return;
  tg!.setHeaderColor(bg);
  tg!.setBackgroundColor(bg);
}

/** Системная кнопка «Назад» Telegram: видна везде, кроме карты мира */
export function syncBackButton(route: Route): () => void {
  if (!TELEGRAM || !tg!.isVersionAtLeast('6.1')) return () => {};
  const back = () => (history.length > 1 ? history.back() : navigate({ name: 'home' }));
  if (route.name === 'home') {
    tg!.BackButton.hide();
    return () => {};
  }
  tg!.BackButton.show();
  tg!.BackButton.onClick(back);
  return () => tg!.BackButton.offClick(back);
}

/** Маршрут → параметр startapp: #/country/KAZ/culture → country_KAZ_culture (только буквы, цифры, _ и -) */
export function startParam(hash: string): string | null {
  const p = hash.replace(/^#\/?/, '').split('/').filter(Boolean).join('_');
  return /^[A-Za-z0-9_-]{1,64}$/.test(p) ? p : null;
}

/** «Поделиться» внутри Telegram: окно выбора чата с ссылкой на эту страницу */
export function shareInTelegram(title: string): boolean {
  if (!TELEGRAM) return false;
  const param = startParam(location.hash);
  const url = APP_LINK ? `${APP_LINK}${param ? `?startapp=${param}` : ''}` : location.href;
  tg!.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`);
  return true;
}
