import { useEffect } from 'react';
import { useStore } from '../store/store';
import { useHashRoute, useThemeAttr } from './useHashRoute';
import { PHONE, useMedia } from './useMedia';
import { Header } from '../ui/Header';
import { MapView } from '../map/MapView';
import { Booklet } from '../booklet/Booklet';
import { Welcome } from '../booklet/Welcome';
import { BottomSheet } from '../ui/BottomSheet';
import { SourcesPage } from '../ui/SourcesPage';
import { COUNTRY_BY_ID } from '../content';
import s from './App.module.css';

// Раскладка: компьютер — карта слева (62%), буклет справа; планшет — карта сверху, буклет снизу;
// телефон — карта на весь экран, буклет в выдвижной панели снизу.
export function App() {
  useHashRoute();
  useThemeAttr();
  const route = useStore((st) => st.route);
  const setSheet = useStore((st) => st.setSheet);
  const phone = useMedia(PHONE);

  const countryId = route.name === 'country' ? route.id : null;
  // на телефоне при выборе страны панель поднимается до половины экрана
  useEffect(() => {
    if (countryId) setSheet('half');
  }, [countryId, setSheet]);

  useEffect(() => {
    const c = countryId ? COUNTRY_BY_ID.get(countryId) : null;
    document.title = c ? `${c.name} — Атлас-путеводитель` : route.name === 'sources' ? 'Источники — Атлас-путеводитель' : 'Атлас-путеводитель';
  }, [countryId, route.name]);

  const panel =
    route.name === 'country' && route.tab ? <Booklet id={route.id} tab={route.tab} /> : <Welcome />;

  return (
    <div className={s.app}>
      <Header />
      {route.name === 'sources' ? (
        <main className={s.page}>
          <SourcesPage />
        </main>
      ) : (
        <main className={s.main}>
          <section className={s.map} aria-label="Карта">
            <MapView />
          </section>
          {phone ? (
            <BottomSheet title={countryId ? COUNTRY_BY_ID.get(countryId)?.name : 'Атлас-путеводитель'}>{panel}</BottomSheet>
          ) : (
            <aside className={s.side} aria-label="Буклет">
              {panel}
            </aside>
          )}
        </main>
      )}
    </div>
  );
}
