import { useEffect, useState } from 'react';
import type { Country } from '../../content/schema';
import { COUNTRY_BY_ID } from '../../content';
import { loadNeighbors } from '../../content/neighbors';
import { navigate } from '../../app/router';
import { Section, Soon, Timeline } from '../parts';
import s from './tabs.module.css';

const num = (n: number) => n.toLocaleString('ru-RU');

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
      {f ? (
        <Section title="В цифрах">
          <dl className={s.facts}>
            <div><dt>Площадь</dt><dd>{num(f.area)} км²</dd></div>
            <div><dt>Население</dt><dd>{num(f.population)}</dd></div>
            {f.gdpPerCapita ? <div><dt>ВВП на человека</dt><dd>${num(f.gdpPerCapita)}</dd></div> : null}
            <div><dt>Столица</dt><dd>{c.capital}</dd></div>
          </dl>
        </Section>
      ) : (
        <Soon title="В цифрах" what="площадь, население, ВВП на человека." />
      )}
      <Section title="Вехи истории">
        <Timeline items={c.overview.timeline} />
      </Section>
      <section className={s.fact}>
        <h3>💡 Знаете ли вы?</h3>
        <p>{c.overview.funFact}</p>
      </section>
      {near === null ? null : near.length ? (
        <Section title="Соседи по карте">
          <div className={s.near}>
            {near.map((id) => (
              <button key={id} type="button" onClick={() => navigate({ name: 'country', id })}>
                {COUNTRY_BY_ID.get(id)?.name ?? id}
              </button>
            ))}
          </div>
        </Section>
      ) : (
        <Section title="Соседи по карте">
          <p>Сухопутных границ нет — соседи только через море.</p>
        </Section>
      )}
    </>
  );
}
