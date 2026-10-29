// Панель эпохи (машина времени, пока не выбрано государство):
// крупнейшие государства на карте, события мира, находки и открытия с фото.
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/store';
import { navigate } from '../app/router';
import { formatYear } from '../lib/years';
import { getPhoto } from '../content';
import { Photo } from '../ui/photos/Photo';
import { useGallery } from '../ui/photos/useGallery';
import eventsJson from '../../content/epochs/events.json';
import findsJson from '../../content/epochs/finds.json';
import { EPOCHS, colorFor, epochIndex, loadPolities, type Polity } from '../map/time/data';
import s from './history.module.css';

type Ev = { lane: string; year: number; title: string; text: string };
type Find = { year: number; title: string; text: string; photo?: string };
const EVENTS = eventsJson.events as Ev[];
const LANES = eventsJson.lanes as Record<string, string>;
const FINDS = findsJson as Find[];

// форматировщики чисел создаём один раз: toLocaleString с настройками каждый раз строит новый,
// а при проигрывании панель перерисовывается каждый год — это давало долгие кадры
const MLN = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const THOUSANDS = new Intl.NumberFormat('ru-RU');
const fmt = (n: number) => (n >= 1e6 ? `${MLN.format(n / 1e6)} млн км²` : `${THOUSANDS.format(Math.round(n / 1000))} тыс. км²`);

export function EpochPanel() {
  const year = useDeferredValue(useStore((st) => st.year));
  const active = useDeferredValue(useStore((st) => st.timeActive));
  const historyOf = useStore((st) => st.historyOf);
  const [polities, setPolities] = useState<Polity[]>([]);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    loadPolities().then(setPolities);
  }, []);

  const i = epochIndex(year);
  const [y0, y1] = [EPOCHS[i], EPOCHS[Math.min(i + 1, EPOCHS.length - 1)]];

  // крупнейшие: суммируем площадь частей одного государства; колонии считаем отдельно, цвет — как у империи
  const top = useMemo(() => {
    const by = new Map<number, { i: number; ar: number; g: number }>();
    for (const r of active) {
      if (r.properties.k !== 0) continue;
      const cur = by.get(r.properties.i) ?? { i: r.properties.i, ar: 0, g: r.properties.g };
      cur.ar += r.properties.ar;
      by.set(r.properties.i, cur);
    }
    return [...by.values()].sort((a, b) => b.ar - a.ar).slice(0, 8);
  }, [active]);

  const events = useMemo(() => {
    const inEpoch = EVENTS.filter((e) => e.year >= y0 && e.year < (y1 === y0 ? y0 + 1 : y1)).sort((a, b) => a.year - b.year);
    if (inEpoch.length) return { title: 'Что происходило', list: inEpoch.slice(0, 7) };
    return { title: 'Незадолго до этого', list: EVENTS.filter((e) => e.year < y0).sort((a, b) => b.year - a.year).slice(0, 4) };
  }, [y0, y1]);
  const finds = useMemo(() => {
    const near = FINDS.filter((f) => f.year >= y0 - 100 && f.year <= (y1 === y0 ? y0 + 100 : y1));
    return near.length ? near : FINDS.filter((f) => f.year <= year).slice(-2);
  }, [y0, y1, year]);
  useGallery(box, `${y0}`);

  const name = (n: number) => polities[n]?.ru || polities[n]?.en || '…';

  return (
    <div className={s.panel} ref={box}>
      <p className={s.kicker}>Машина времени{historyOf ? ' · история одной страны' : ''}</p>
      <h2 className={s.title}>
        {formatYear(year)}
        <small> эпоха {formatYear(y0)}{y1 !== y0 ? ` — ${formatYear(y1)}` : ''}</small>
      </h2>
      <p className={s.hint}>Нажмите на государство на карте — откроется его буклет. Пробел — пуск и пауза, [ и ] — соседние эпохи.</p>

      <section className={s.sec}>
        <h3>Крупнейшие государства</h3>
        {top.length ? (
          <ul className={s.top}>
            {top.map((t) => (
              <li key={t.i}>
                <button type="button" onClick={() => navigate({ name: 'time', year, polity: polities[t.i]?.en })}>
                  <i style={{ background: colorFor(polities[t.g >= 0 ? t.g : t.i]?.en ?? '') }} aria-hidden="true" />
                  <span>{name(t.i)}</span>
                  <small>{fmt(t.ar)}</small>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.muted}>В этом году на карте нет государств{historyOf ? ' на территории выбранной страны' : ''}.</p>
        )}
      </section>

      <section className={s.sec}>
        <h3>{events.title}</h3>
        <ul className={s.events}>
          {events.list.map((e) => (
            <li key={`${e.year}-${e.title}`}>
              <b>{formatYear(e.year)}</b> {e.title}
              <small>{LANES[e.lane] ?? ''} · {e.text}</small>
            </li>
          ))}
        </ul>
      </section>

      {finds.length ? (
        <section className={s.sec}>
          <h3>Находки и открытия</h3>
          <div className={s.finds}>
            {finds.map((f) => {
              const p = getPhoto(f.photo);
              return (
                <div key={f.title} className={s.find}>
                  {p ? <Photo p={p} alt={f.title} sizes="120px" className={s.findPhoto} /> : <span className={s.findPhoto} aria-hidden="true" />}
                  <span>
                    <strong>{formatYear(f.year)} · {f.title}</strong>
                    <span>{f.text}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
