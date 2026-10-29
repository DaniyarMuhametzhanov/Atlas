// Случайная экскурсия: 5 мест из разных стран с фото и коротким рассказом.
// Карта сама перелетает от места к месту; маршрут идёт с запада на восток.
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/store';
import { COUNTRY_BY_ID, getPhoto } from '../content';
import { loadPlaces, type PlacesData } from '../content/places';
import type { MapPlace } from '../content/schema';
import { pickTour } from './pickTour';
import { Photo } from '../ui/photos/Photo';
import { useGallery } from '../ui/photos/useGallery';
import s from './Tour.module.css';

/** Сколько секунд показывать место при автопрогулке */
const STAY = 12;

const KIND = (p: MapPlace, data: PlacesData) =>
  data.wonders.includes(p) ? 'Чудо света' : data.reserves.includes(p) ? 'Заповедник' : 'Природа';

export function Tour() {
  const [data, setData] = useState<PlacesData | null>(null);
  const [stops, setStops] = useState<MapPlace[]>([]);
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [error, setError] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const stop = stops[i];
  useGallery(box, stop?.id ?? null);

  const restart = (d: PlacesData) => {
    setStops(pickTour(d));
    setI(0);
  };

  useEffect(() => {
    loadPlaces().then(
      (d) => {
        setData(d);
        restart(d);
      },
      () => setError(true),
    );
  }, []);

  // перелёт к месту и обводка его страны
  useEffect(() => {
    if (!stop) return;
    const st = useStore.getState();
    st.setFlyTo({ center: [stop.lon, stop.lat], zoom: 4.8 });
    st.setHighlight([stop.country]);
  }, [stop]);

  // автопрогулка: следующее место через STAY секунд; на последнем — остановка
  useEffect(() => {
    if (!auto || !stops.length) return;
    if (i >= stops.length - 1) {
      setAuto(false);
      return;
    }
    const t = setTimeout(() => setI((x) => x + 1), STAY * 1000);
    return () => clearTimeout(t);
  }, [auto, i, stops.length]);

  useEffect(() => () => useStore.getState().setHighlight([]), []);

  if (error) return <p className={s.state}>Не загрузился список мест — проверьте интернет.</p>;
  if (!data || !stop) return <p className={s.state} aria-busy="true">Собираю маршрут…</p>;

  const photo = getPhoto(stop.photo);
  const country = COUNTRY_BY_ID.get(stop.country);
  return (
    <div className={s.tour} ref={box}>
      <div className={s.top}>
        <h2 className={s.h}>Случайная экскурсия</h2>
        <span className={s.muted}>
          Остановка {i + 1} из {stops.length}
        </span>
      </div>
      <ol className={s.route} aria-label="Маршрут">
        {stops.map((p, k) => (
          <li key={p.id}>
            <button
              type="button"
              aria-current={k === i ? 'step' : undefined}
              onClick={() => {
                setAuto(false);
                setI(k);
              }}
            >
              <span aria-hidden="true">{k + 1}</span> {p.name}
            </button>
          </li>
        ))}
      </ol>
      <article className={s.stop} aria-live="polite">
        {photo ? (
          <figure className={s.photo}>
            <Photo p={photo} alt={stop.name} country={country?.name} sizes="(max-width: 760px) 100vw, 480px" width={480} height={240} lazy={false} />
          </figure>
        ) : null}
        <p className={s.kind}>
          {KIND(stop, data)} · {country ? <a href={`#/country/${stop.country}/tourist`}>{country.name}</a> : stop.country}
        </p>
        <h3 className={s.name}>{stop.name}</h3>
        <p>{stop.text}</p>
      </article>
      {auto ? (
        <div className={s.timer} aria-hidden="true">
          <i key={i} style={{ animationDuration: `${STAY}s` }} />
        </div>
      ) : null}
      <div className={s.controls}>
        <button type="button" disabled={i === 0} onClick={() => { setAuto(false); setI(i - 1); }}>
          ← Назад
        </button>
        <button type="button" onClick={() => setAuto(!auto)} aria-pressed={auto} disabled={!auto && i === stops.length - 1}>
          {auto ? '⏸ Пауза' : '▶ Автопрогулка'}
        </button>
        <button type="button" disabled={i === stops.length - 1} onClick={() => { setAuto(false); setI(i + 1); }}>
          Дальше →
        </button>
      </div>
      <button type="button" className={s.again} onClick={() => { restart(data); setAuto(true); }}>
        🧭 Новая экскурсия
      </button>
    </div>
  );
}
