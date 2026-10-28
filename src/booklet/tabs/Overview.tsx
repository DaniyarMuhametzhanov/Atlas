import type { Country } from '../../content/schema';
import { Section, Soon, Timeline } from '../parts';
import s from './tabs.module.css';

const num = (n: number) => n.toLocaleString('ru-RU');

export function Overview({ c }: { c: Country }) {
  const f = c.overview.facts;
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
      <Soon title="Соседи по карте" what="кнопки перехода к соседним странам (этап 4, по границам на карте)." />
    </>
  );
}
