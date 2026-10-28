import type { Country } from '../../content/schema';
import { Bullets, Section, Soon } from '../parts';

export function Culture({ c }: { c: Country }) {
  const k = c.culture;
  return (
    <>
      {k.ethnic ? (
        <Section title="Этнический состав">
          <Bullets items={k.ethnic.map((e) => `${e.group} — ${e.percent}%`)} />
        </Section>
      ) : (
        <Soon title="Этнический состав" what="диаграмма и проценты по данным переписи." />
      )}
      {k.languages || k.religions ? (
        <Section title="Языки и религии">
          {k.languages ? <p>Языки: {k.languages.join(', ')}</p> : null}
          {k.religions ? <p>Религии: {k.religions.map((r) => (r.percent ? `${r.name} (${r.percent}%)` : r.name)).join(', ')}</p> : null}
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
      {k.holidays ? (
        <Section title="Праздники">
          <Bullets items={k.holidays.map((h) => `${h.date} — ${h.name}: ${h.text}`)} />
        </Section>
      ) : (
        <Soon title="Праздники" what="главные праздники: дата и смысл." />
      )}
      {k.people ? (
        <Section title="Известные люди">
          <Bullets items={k.people.map((p) => `${p.name} — ${p.who}`)} />
        </Section>
      ) : (
        <Soon title="Известные люди" what="3–5 человек, которыми гордится страна." />
      )}
    </>
  );
}
