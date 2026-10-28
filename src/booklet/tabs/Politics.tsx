import type { Country } from '../../content/schema';
import { AsOf, Section, Soon } from '../parts';
import s from './tabs.module.css';

export function Politics({ c }: { c: Country }) {
  const p = c.politics;
  return (
    <>
      {c.updated === 'legacy-v1' ? (
        <p className={s.soonLine}>Текст из старой версии атласа; дата проверки не указана. Обновление — на этапе наполнения.</p>
      ) : null}
      <Section title="Как устроена власть">
        <p>{p.system}</p>
      </Section>
      {p.leaders || p.parties ? (
        <Section title="Кто у власти">
          {p.leaders ? <p>{p.leaders}</p> : null}
          {p.parties ? <p>Главные партии: {p.parties}</p> : null}
        </Section>
      ) : (
        <Soon title="Кто у власти" what="руководители страны и главные партии." />
      )}
      <Section title="Настроения граждан">
        <p>{p.mood}</p>
      </Section>
      {p.economy ? (
        <Section title="Экономика">
          <p>{p.economy}</p>
        </Section>
      ) : (
        <Soon title="Экономика" what="на чём зарабатывает страна." />
      )}
      <Section title="Технологии и инфраструктура">
        <p>{p.techInfra}</p>
      </Section>
      {p.freedom?.length ? (
        <Section title="Оценки свободы" note="Это внешняя оценка организаций, а не мнение атласа.">
          <dl className={s.practical}>
            {p.freedom.map((f) => (
              <div key={f.source}>
                <dt>{f.source}, {f.year}</dt>
                <dd>{f.score}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : (
        <Soon title="Оценки свободы" what="оценки Freedom House или V-Dem с годом." />
      )}
      <AsOf value={p.asOf} />
    </>
  );
}
