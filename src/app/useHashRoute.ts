import { useEffect } from 'react';
import { useStore } from '../store/store';
import { navigate, parseHash } from './router';
import { COUNTRY_BY_ID } from '../content';

/** Следит за адресом страницы и кладёт разобранный маршрут в хранилище */
export function useHashRoute() {
  const setRoute = useStore((s) => s.setRoute);
  useEffect(() => {
    const sync = () => {
      const route = parseHash(location.hash);
      if (route.name === 'country') {
        // неизвестный код → на карту мира; адрес без вкладки → дописываем последнюю открытую
        if (!COUNTRY_BY_ID.has(route.id)) return navigate({ name: 'home' }, true);
        if (!route.tab) return navigate({ ...route, tab: useStore.getState().lastTab }, true);
      }
      setRoute(route);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [setRoute]);
}

/** Ставит data-theme на <html>, если тема выбрана вручную */
export function useThemeAttr() {
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);
}
