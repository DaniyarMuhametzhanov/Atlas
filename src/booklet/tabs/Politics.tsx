import type { Country } from '../../content/schema';
import { Section, Soon } from '../parts';

export function Politics({ c }: { c: Country }) {
  const p = c.politics;
  return (
    <>
      <Section title="Как устроена власть">
        <p>{p.system}</p>
      </Section>
      {p.leaders || p.parties ? (
        <Section title="Кто у власти">
          {p.leaders ? <p>{p.leaders}</p> : null}
          {p.parties ? <p>{p.parties}</p> : null}
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
      {p.freedom ? (
        <Section title="Оценки свободы" note="Это внешняя оценка организаций, а не мнение атласа.">
          <ul>
            {p.freedom.map((f) => (
              <li key={f.source}>
                {f.source}: {f.score} ({f.year})
              </li>
            ))}
          </ul>
        </Section>
      ) : (
        <Soon title="Оценки свободы" what="оценки Freedom House или V-Dem с годом." />
      )}
    </>
  );
}
