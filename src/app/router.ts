// Маленький роутер на location.hash. Адрес страницы описывает, что открыто:
//   #/                         — карта мира
//   #/country/KAZ              — страна (вкладка — последняя открытая)
//   #/country/KAZ/culture      — страна и вкладка
//   #/sources                  — источники и лицензии
//   #/compare/KAZ/RUS          — сравнение стран (до трёх)
//   #/quiz, #/tour             — викторина, случайная экскурсия
//   #/time/1700                — машина времени, 1700 год (−500 = 500 до н.э.)
//   #/time/1700/Kazakh Khanate — и выбранное государство (английское имя из Cliopatria)
import { isTabId, type TabId } from '../booklet/tabs';

/** Сколько стран можно сравнить сразу: больше трёх столбцов не помещаются даже на компьютере */
export const MAX_COMPARE = 3;

export type Route =
  | { name: 'home' }
  | { name: 'country'; id: string; tab?: TabId }
  | { name: 'sources' }
  | { name: 'compare'; ids: string[] }
  | { name: 'quiz' }
  | { name: 'tour' }
  | { name: 'time'; year: number; polity?: string };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'country' && parts[1] && /^[A-Za-z]{3}$/.test(parts[1])) {
    const id = parts[1].toUpperCase();
    return isTabId(parts[2]) ? { name: 'country', id, tab: parts[2] } : { name: 'country', id };
  }
  if (parts[0] === 'sources') return { name: 'sources' };
  if (parts[0] === 'quiz') return { name: 'quiz' };
  if (parts[0] === 'tour') return { name: 'tour' };
  if (parts[0] === 'compare') {
    const ids = [...new Set(parts.slice(1).filter((p) => /^[A-Za-z]{3}$/.test(p)).map((p) => p.toUpperCase()))];
    return { name: 'compare', ids: ids.slice(0, MAX_COMPARE) };
  }
  if (parts[0] === 'time') {
    const y = Number.parseInt(parts[1] ?? '', 10);
    const year = Number.isFinite(y) && y !== 0 ? Math.max(-3400, Math.min(2024, y)) : 1700;
    return parts[2] ? { name: 'time', year, polity: parts[2] } : { name: 'time', year };
  }
  return { name: 'home' };
}

export function formatHash(route: Route): string {
  switch (route.name) {
    case 'country':
      return `#/country/${route.id}${route.tab ? '/' + route.tab : ''}`;
    case 'sources':
      return '#/sources';
    case 'quiz':
      return '#/quiz';
    case 'tour':
      return '#/tour';
    case 'compare':
      return `#/compare${route.ids.map((id) => '/' + id).join('')}`;
    case 'time':
      return `#/time/${route.year}${route.polity ? '/' + encodeURIComponent(route.polity) : ''}`;
    default:
      return '#/';
  }
}

/** Тихо поменять адрес (без события hashchange) — например, год во время проигрывания машины времени */
export function replaceSilently(route: Route): void {
  const hash = formatHash(route);
  if (location.hash !== hash) history.replaceState(null, '', hash);
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
