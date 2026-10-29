// Сравнение стран: до трёх столбцов рядом. У чисел — полоска, чтобы разница была видна сразу.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { COUNTRIES, COUNTRY_BY_ID, loadCountry } from '../content';
import { loadNeighbors } from '../content/neighbors';
import { REGIONS } from '../content/regions';
import type { Country } from '../content/schema';
import { MAX_COMPARE, navigate } from '../app/router';
import s from './Compare.module.css';

const num = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
const people = (n: number) => (n >= 1e6 ? `${(n / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн` : num(n));
const DANGER = ['', 'безопасно', 'нужна осторожность', 'высокий риск', 'не ездить'];
const SORTED = [...COUNTRIES].filter((c) => c.id !== 'ATA' && c.id !== 'ATF').sort((a, b) => a.name.localeCompare(b.name, 'ru'));

type Row = {
  title: string;
  /** число для полоски (больше — длиннее) */
  value?: (c: Country) => number | undefined;
  show: (c: Country) => ReactNode;
};

const density = (c: Country) => (c.overview.facts ? c.overview.facts.population / c.overview.facts.area : undefined);
const yearRain = (c: Country) => c.tourist.climate?.reduce((sum, m) => sum + m.rainMm, 0);

const ROWS: Row[] = [
  { title: 'Регион', show: (c) => REGIONS[c.region] },
  { title: 'Столица', show: (c) => c.capital },
  { title: 'Чем знаменита', show: (c) => c.fame },
  { title: 'Площадь', value: (c) => c.overview.facts?.area, show: (c) => (c.overview.facts ? `${num(c.overview.facts.area)} км²` : null) },
  { title: 'Население', value: (c) => c.overview.facts?.population, show: (c) => (c.overview.facts ? people(c.overview.facts.population) : null) },
  { title: 'Людей на 1 км²', value: density, show: (c) => (density(c) != null ? num(density(c)!) : null) },
  {
    title: 'ВВП на человека',
    value: (c) => c.overview.facts?.gdpPerCapita,
    show: (c) => (c.overview.facts?.gdpPerCapita ? `$${num(c.overview.facts.gdpPerCapita)}` : null),
  },
  { title: 'Устройство власти', show: (c) => c.politics.system },
  {
    title: 'Индекс свободы',
    // Freedom House: 0–100, больше — свободнее
    value: (c) => {
      const f = c.politics.freedom?.find((x) => x.source === 'Freedom House');
      const n = f ? Number.parseInt(f.score, 10) : NaN;
      return Number.isFinite(n) ? n : undefined;
    },
    show: (c) => {
      const f = c.politics.freedom?.find((x) => x.source === 'Freedom House');
      return f ? `${f.score} (Freedom House, ${f.year})` : null;
    },
  },
  { title: 'Безопасность для туриста', show: (c) => `${c.tourist.danger.level} из 4 — ${DANGER[c.tourist.danger.level]}` },
  { title: 'Языки', show: (c) => (c.tourist.practical?.languages ?? c.culture.languages)?.join(', ') },
  { title: 'Валюта', show: (c) => c.tourist.practical?.currency },
  { title: 'Время', show: (c) => c.tourist.practical?.timezone },
  {
    title: 'Днём в столице: январь / июль',
    show: (c) => (c.tourist.climate ? `${Math.round(c.tourist.climate[0].tMax)}° / ${Math.round(c.tourist.climate[6].tMax)}°` : null),
  },
  { title: 'Осадков за год', value: yearRain, show: (c) => (yearRain(c) != null ? `${num(yearRain(c)!)} мм` : null) },
  { title: 'Виза для граждан Казахстана', show: (c) => c.tourist.practical?.visaKZ },
  { title: 'Виза для граждан России', show: (c) => c.tourist.practical?.visaRU },
  {
    title: 'Главная религия',
    show: (c) => {
      const r = c.culture.religions?.[0];
      return r ? `${r.name}${r.percent != null ? ` — ${r.percent}%` : ''}` : null;
    },
  },
];

export function Compare({ ids }: { ids: string[] }) {
  const [list, setList] = useState<Country[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [near, setNear] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    setError(null);
    Promise.all(ids.map(loadCountry)).then(
      (cs) => alive && setList(cs),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [ids]);

  // подсказки «с кем сравнить»: соседи первой страны
  useEffect(() => {
    let alive = true;
    if (!ids[0]) return setNear([]);
    loadNeighbors().then(
      (all) => alive && setNear((all[ids[0]] ?? []).filter((x) => COUNTRY_BY_ID.has(x) && !ids.includes(x)).slice(0, 5)),
      () => alive && setNear([]),
    );
    return () => {
      alive = false;
    };
  }, [ids]);

  const go = (next: string[]) => navigate({ name: 'compare', ids: next }, true);
  const add = (id: string) => id && !ids.includes(id) && ids.length < MAX_COMPARE && go([...ids, id]);
  const ready = list.length === ids.length && list.every((c, i) => c.id === ids[i]);

  return (
    <div className={s.compare}>
      <h2 className={s.h}>Сравнение стран</h2>
      <div className={s.chips}>
        {ids.map((id) => (
          <span key={id} className={s.chip}>
            <a href={`#/country/${id}`}>{COUNTRY_BY_ID.get(id)?.name ?? id}</a>
            <button type="button" onClick={() => go(ids.filter((x) => x !== id))} aria-label={`Убрать из сравнения: ${COUNTRY_BY_ID.get(id)?.name ?? id}`}>
              ✕
            </button>
          </span>
        ))}
        {ids.length < MAX_COMPARE ? (
          <select className={s.add} value="" onChange={(e) => add(e.target.value)} aria-label="Добавить страну в сравнение">
            <option value="">+ Добавить страну</option>
            {SORTED.filter((c) => !ids.includes(c.id)).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {near.length && ids.length < MAX_COMPARE ? (
        <p className={s.near}>
          <span>Соседи:</span>
          {near.map((id) => (
            <button key={id} type="button" onClick={() => add(id)}>
              + {COUNTRY_BY_ID.get(id)!.name}
            </button>
          ))}
        </p>
      ) : null}

      {!ids.length ? <p className={s.state}>Добавьте две или три страны — их цифры и факты встанут рядом.</p> : null}
      {error ? <p className={s.state}>Не получилось открыть страну: {error}</p> : null}
      {ids.length && !ready && !error ? <p className={s.state} aria-busy="true">Собираю сравнение…</p> : null}

      {ready && ids.length ? (
        <div className={s.scroll} tabIndex={0} role="region" aria-label="Таблица сравнения">
          <table className={s.table} style={{ '--cols': list.length } as CSSProperties}>
            <thead>
              <tr>
                <th scope="col" className={s.rowHead}>
                  <span className={s.visuallyHidden}>Показатель</span>
                </th>
                {list.map((c) => (
                  <th key={c.id} scope="col" style={{ '--rc': `var(--r-${c.region})`, '--rk': `var(--k-${c.region})` } as CSSProperties}>
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => {
                const vals = list.map((c) => r.value?.(c));
                const max = Math.max(0, ...vals.map((v) => v ?? 0));
                return (
                  <tr key={r.title}>
                    <th scope="row" className={s.rowHead}>{r.title}</th>
                    {list.map((c, i) => {
                      const v = vals[i];
                      const shown = r.show(c);
                      return (
                        <td key={c.id} style={{ '--rk': `var(--k-${c.region})` } as CSSProperties}>
                          {shown ?? <span className={s.none}>нет данных</span>}
                          {v != null && max > 0 && list.length > 1 ? (
                            <span className={s.bar} aria-hidden="true">
                              <i style={{ width: `${Math.max(2, (v / max) * 100)}%` }} />
                            </span>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
