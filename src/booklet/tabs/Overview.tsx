import { useEffect, useState } from 'react';
import type { Country } from '../../content/schema';
import { COUNTRY_BY_ID } from '../../content';
import { loadNeighbors } from '../../content/neighbors';
import { navigate } from '../../app/router';
import { Section, Soon, Timeline } from '../parts';
import s from './tabs.module.css';

const num = (n: number) => n.toLocaleString('ru-RU');
/** 20 300 000 → «20,3 млн» */
const people = (n: number) => (n >= 1e6 ? `${(n / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн` : num(n));
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
/** «2026-10» → «октябрь 2026» */
const monthYear = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return MONTHS[m - 1] ? `${MONTHS[m - 1]} ${y}` : ym;
};

export function Overview({ c }: { c: Country }) {
  const f = c.overview.facts;
  const [near, setNear] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    loadNeighbors().then(
      (all) => alive && setNear(all[c.id] ?? []),
      () => alive && setNear([]),
    );
    return () => {
      alive = false;
    };
  }, [c.id]);

  return (
    <>
      <p className={s.lead}>{c.overview.intro}</p>
      <Section title="В цифрах">
        <dl className={s.facts}>
          <div><dt>Столица</dt><dd>{c.capital}</dd></div>
          {f ? (
            <>
              <div><dt>Площадь</dt><dd>{num(f.area)} км²</dd></div>
              <div><dt>Население</dt><dd>{people(f.population)}</dd></div>
              {f.gdpPerCapita ? <div><dt>ВВП на человека</dt><dd>${num(f.gdpPerCapita)}</dd></div> : null}
            </>
          ) : null}
        </dl>
        {f ? null : <p className={s.soonLine}>⏳ Площадь, население и ВВП на человека — скоро появятся.</p>}
      </Section>
      <Section title="Вехи истории">
        <Timeline items={c.overview.timeline} />
      </Section>
      <section className={s.fact}>
        <h3>💡 Знаете ли вы?</h3>
        <p>{c.overview.funFact}</p>
      </section>
      {near === null ? null : (
        <Section title="Соседи по карте">
          {near.length ? (
            <div className={s.near}>
              {near.map((id) => (
                <button key={id} type="button" onClick={() => navigate({ name: 'country', id })}>
                  {COUNTRY_BY_ID.get(id)?.name ?? id}
                </button>
              ))}
            </div>
          ) : (
            <p>Сухопутных границ нет — соседи только через море.</p>
          )}
        </Section>
      )}
      {near === null && !f ? <Soon title="Соседи по карте" what="загружаются…" /> : null}
      {c.sources?.length ? (
        <Section title="Источники" note={<>Данные проверены: {monthYear(c.updated)}.</>}>
          <ul className={s.sources}>
            {c.sources.map((x) => (
              <li key={x.title}>
                {x.url ? <a href={x.url} target="_blank" rel="noopener noreferrer">{x.title}</a> : x.title}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}
