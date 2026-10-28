// Маленький роутер на location.hash. Адрес страницы описывает, что открыто:
//   #/                         — карта мира
//   #/country/KAZ              — страна (вкладка — последняя открытая)
//   #/country/KAZ/culture      — страна и вкладка
//   #/sources                  — источники и лицензии
import { isTabId, type TabId } from '../booklet/tabs';

export type Route =
  | { name: 'home' }
  | { name: 'country'; id: string; tab?: TabId }
  | { name: 'sources' };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'country' && parts[1] && /^[A-Za-z]{3}$/.test(parts[1])) {
    const id = parts[1].toUpperCase();
    return isTabId(parts[2]) ? { name: 'country', id, tab: parts[2] } : { name: 'country', id };
  }
  if (parts[0] === 'sources') return { name: 'sources' };
  return { name: 'home' };
}

export function formatHash(route: Route): string {
  switch (route.name) {
    case 'country':
      return `#/country/${route.id}${route.tab ? '/' + route.tab : ''}`;
    case 'sources':
      return '#/sources';
    default:
      return '#/';
  }
}

/** Перейти по адресу. replace — заменить текущую запись истории (кнопка «Назад» её пропустит). */
export function navigate(route: Route, replace = false): void {
  const hash = formatHash(route);
  if (location.hash === hash) return;
  if (replace) {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = hash;
  }
}
