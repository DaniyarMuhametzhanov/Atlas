import type { Country } from '../../content/schema';
import { Section, Soon } from '../parts';
import s from './tabs.module.css';

type Item = { myth: string; reality: string; source?: string };

function List({ items }: { items: Item[] }) {
  return (
    <div className={s.myths}>
      {items.map((it, i) => (
        <div key={i} className={s.myth}>
          <p><b>Стереотип:</b> {it.myth}</p>
          <p><b>Как на самом деле:</b> {it.reality}</p>
          {it.source ? <small>Источник: {it.source}</small> : null}
        </div>
      ))}
    </div>
  );
}

export function Stereotypes({ c }: { c: Country }) {
  const st = c.stereotypes;
  return (
    <>
      <p className={s.disclaimer}>
        Стереотип — это упрощённое мнение о большой группе людей. Он не описывает каждого человека и часто неверен.
      </p>
      {st?.about.length ? (
        <Section title="Что думают о жителях">
          <List items={st.about} />
        </Section>
      ) : (
        <Soon title="Что думают о жителях" what="стереотипы о жителях страны и то, как обстоит дело на самом деле." />
      )}
      {st?.held.length ? (
        <Section title="Что думают сами жители о других">
          <List items={st.held} />
        </Section>
      ) : (
        <Soon title="Что думают сами жители о других" what="распространённые представления жителей о других народах." />
      )}
    </>
  );
}
