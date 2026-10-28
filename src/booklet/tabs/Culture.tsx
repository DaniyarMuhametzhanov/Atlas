import type { Country } from '../../content/schema';
import { EthnicBar } from '../charts/EthnicBar';
import { Bullets, Section, Soon } from '../parts';
import s from './tabs.module.css';

export function Culture({ c }: { c: Country }) {
  const k = c.culture;
  return (
    <>
      {k.ethnic?.length ? (
        <Section title="Этнический состав">
          <EthnicBar groups={k.ethnic} source={k.ethnicSource} multi={k.ethnicMulti} />
        </Section>
      ) : (
        <Soon title="Этнический состав" what="доли народов по данным переписи (с годом)." />
      )}
      {k.languages?.length || k.religions?.length ? (
        <Section title="Языки и религии">
          <dl className={s.practical}>
            {k.languages?.length ? <div><dt>Языки</dt><dd>{k.languages.join(', ')}</dd></div> : null}
            {k.religions?.length ? (
              <div>
                <dt>Религии</dt>
                <dd>{k.religions.map((r) => (r.percent != null ? `${r.name} (${r.percent}%)` : r.name)).join(', ')}</dd>
              </div>
            ) : null}
          </dl>
        </Section>
      ) : (
        <Soon title="Языки и религии" what="на каких языках говорят и во что верят." />
      )}
      <Section title="Характер и ценности">
        <p>{k.character}</p>
      </Section>
      <Section title="Традиции">
        <Bullets items={k.traditions} />
      </Section>
      {k.holidays?.length ? (
        <Section title="Главные праздники">
          <ul className={s.holidays}>
            {k.holidays.map((h) => (
              <li key={h.name}>
                <b>{h.date}</b>
                <span><strong>{h.name}</strong> — {h.text}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : (
        <Soon title="Главные праздники" what="дата и смысл праздника." />
      )}
      {k.people?.length ? (
        <Section title="Известные люди">
          <ul className={s.holidays}>
            {k.people.map((p) => (
              <li key={p.name}>
                <span><strong>{p.name}</strong> — {p.who}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : (
        <Soon title="Известные люди" what="3–5 человек, которыми гордится страна." />
      )}
    </>
  );
}
