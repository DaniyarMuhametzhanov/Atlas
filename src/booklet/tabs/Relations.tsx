import type { Country } from '../../content/schema';
import { Section, Soon } from '../parts';

export function Relations({ c }: { c: Country }) {
  const r = c.relations;
  return (
    <>
      {r.internal ? (
        <Section title="Внутри страны">
          <p>{r.internal}</p>
        </Section>
      ) : (
        <Soon title="Внутри страны" what="как живут вместе разные народы страны." />
      )}
      <Section title="С соседями">
        <p>{r.neighbors}</p>
      </Section>
      {r.world ? (
        <Section title="С миром">
          <ul>
            {r.world.map((w) => (
              <li key={w.country}>
                <b>{w.country}</b> — {w.status}. {w.text}
              </li>
            ))}
          </ul>
        </Section>
      ) : (
        <Soon title="С миром" what="список стран со статусом отношений: союз, дружба, нейтрально, напряжённость, конфликт." />
      )}
      {r.attitudes ? (
        <Section title="Отношение жителей к другим народам" note="Только по данным опросов.">
          <ul>
            {r.attitudes.map((a) => (
              <li key={a.toward}>
                <b>{a.toward}</b>: {a.text} ({a.source}, {a.year})
              </li>
            ))}
          </ul>
        </Section>
      ) : (
        <Soon title="Отношение жителей к другим народам" what="данные опросов Pew, Gallup, World Values Survey с годом." />
      )}
    </>
  );
}
