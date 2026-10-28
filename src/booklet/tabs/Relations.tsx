import type { Country } from '../../content/schema';
import { COUNTRY_BY_ID } from '../../content';
import { navigate } from '../../app/router';
import { useStore, type RelationStatus } from '../../store/store';
import { AsOf, Section, Soon, StatusBadge } from '../parts';
import s from './tabs.module.css';

const ORDER: RelationStatus[] = ['союз', 'дружба', 'нейтрально', 'напряжённость', 'конфликт'];

export function Relations({ c }: { c: Country }) {
  const r = c.relations;
  const relMap = useStore((st) => st.relationsMap);
  const setRelMap = useStore((st) => st.setRelationsMap);
  const onMap = relMap?.iso === c.id;
  const world = [...(r.world ?? [])].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  const toggleMap = () =>
    setRelMap(onMap ? null : { iso: c.id, statuses: Object.fromEntries(world.map((w) => [w.country, w.status])) });

  return (
    <>
      {r.internal ? (
        <Section title="Внутри страны">
          <p>{r.internal}</p>
        </Section>
      ) : (
        <Soon title="Внутри страны" what="как живут вместе разные народы страны, были ли конфликты и как сейчас." />
      )}
      <Section title="С соседями">
        <p>{r.neighbors}</p>
      </Section>
      {world.length ? (
        <Section title="С миром">
          <button type="button" className={s.mapBtn} aria-pressed={onMap} onClick={toggleMap}>
            🗺 {onMap ? 'Выключить режим «Отношения» на карте' : 'Показать на карте'}
          </button>
          <ul className={s.world}>
            {world.map((w) => (
              <li key={w.country}>
                <span className={s.worldHead}>
                  <button type="button" className={s.linkBtn} onClick={() => navigate({ name: 'country', id: w.country })}>
                    {COUNTRY_BY_ID.get(w.country)?.name ?? w.country}
                  </button>
                  <StatusBadge status={w.status} />
                </span>
                <span>{w.text}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : (
        <Soon title="С миром" what="страны со статусом отношений: союз, дружба, нейтрально, напряжённость, конфликт — и режим «Отношения» на карте." />
      )}
      {r.attitudes?.length ? (
        <Section title="Отношение жителей к другим народам" note="Только по данным опросов.">
          <ul className={s.world}>
            {r.attitudes.map((a) => (
              <li key={a.toward}>
                <strong>{a.toward}</strong>
                <span>{a.text}</span>
                <small>{a.source}, {a.year}</small>
              </li>
            ))}
          </ul>
        </Section>
      ) : (
        <Soon title="Отношение жителей к другим народам" what="данные опросов (Pew Research Center, Gallup, World Values Survey) с годом." />
      )}
      <AsOf value={r.asOf} />
    </>
  );
}
