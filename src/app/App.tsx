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
import { EpochPanel } from '../booklet/EpochPanel';
import { HistoryBooklet } from '../booklet/HistoryBooklet';
import { Compare } from '../compare/Compare';
import { Quiz } from '../quiz/Quiz';
import { Tour } from '../tour/Tour';
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
  // адрес #/time/1700 задаёт год машины времени (когда его открыли или поменяли вручную)
  useEffect(() => {
    if (route.name === 'time' && useStore.getState().year !== route.year) useStore.getState().setYear(route.year);
  }, [route]);
  // на телефоне при выборе страны панель поднимается до половины экрана
  useEffect(() => {
    if (countryId || route.name === 'compare' || route.name === 'quiz' || route.name === 'tour') setSheet('half');
  }, [countryId, route.name, setSheet]);
  // машина времени на телефоне: проигрыватель стоит внизу карты — панель сворачиваем, чтобы его не закрыть;
  // выбрали государство — поднимаем панель с его буклетом
  const timePolity = route.name === 'time' ? (route.polity ?? '') : null;
  useEffect(() => {
    if (timePolity === null) return;
    setSheet(timePolity ? 'half' : 'collapsed');
  }, [timePolity, setSheet]);

  useEffect(() => {
    const c = countryId ? COUNTRY_BY_ID.get(countryId) : null;
    document.title = c
      ? `${c.name} — Атлас-путеводитель`
      : route.name === 'sources'
        ? 'Источники — Атлас-путеводитель'
        : route.name === 'time'
          ? 'Машина времени — Атлас-путеводитель'
          : route.name === 'compare'
            ? 'Сравнение стран — Атлас-путеводитель'
            : route.name === 'quiz'
              ? 'Викторина — Атлас-путеводитель'
              : route.name === 'tour'
                ? 'Случайная экскурсия — Атлас-путеводитель'
                : 'Атлас-путеводитель';
  }, [countryId, route.name]);

  const panel =
    route.name === 'country' && route.tab ? (
      <Booklet id={route.id} tab={route.tab} />
    ) : route.name === 'time' ? (
      route.polity ? <HistoryBooklet en={route.polity} /> : <EpochPanel />
    ) : route.name === 'compare' ? (
      <Compare ids={route.ids} />
    ) : route.name === 'quiz' ? (
      <Quiz />
    ) : route.name === 'tour' ? (
      <Tour />
    ) : (
      <Welcome />
    );
  const sheetTitle = countryId
    ? COUNTRY_BY_ID.get(countryId)?.name
    : route.name === 'time'
      ? 'Машина времени'
      : route.name === 'compare'
        ? 'Сравнение стран'
        : route.name === 'quiz'
          ? 'Викторина'
          : route.name === 'tour'
            ? 'Экскурсия'
            : 'Атлас-путеводитель';

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
            <BottomSheet title={sheetTitle}>{panel}</BottomSheet>
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
