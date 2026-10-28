// Буклет исторического государства (машина времени).
// Если есть подробный буклет — вступление, вехи, «чем запомнилось»; если нет — автокарточка:
// годы на карте, «в составе», «сегодня здесь», события мира в эти годы. Вкладки — те, что имеют смысл для истории.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useStore } from '../store/store';
import { navigate } from '../app/router';
import { formatYear } from '../lib/years';
import { COUNTRY_BY_ID, getPhoto } from '../content';
import { bookletIdFor, loadBooklet } from '../content/history';
import type { HistoryBooklet as Booklet } from '../content/schema';
import { Photo } from '../ui/photos/Photo';
import { useGallery } from '../ui/photos/useGallery';
import eventsJson from '../../content/epochs/events.json';
import { colorFor, loadPolities, type Polity } from '../map/time/data';
import { Section, Soon, Timeline } from './parts';
import s from './history.module.css';
import b from './Booklet.module.css';

type Ev = { lane: string; year: number; title: string; text: string };
const EVENTS = eventsJson.events as Ev[];
const TABS = [
  { id: 'overview', icon: '📖', label: 'Обзор' },
  { id: 'politics', icon: '🏛', label: 'Как управлялось' },
  { id: 'culture', icon: '🎭', label: 'Культура и народы' },
  { id: 'relations', icon: '🤝', label: 'Отношения' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function HistoryBooklet({ en }: { en: string }) {
  const year = useStore((st) => st.year);
  const setYear = useStore((st) => st.setYear);
  const [polities, setPolities] = useState<Polity[] | null>(null);
  const [booklet, setBooklet] = useState<Booklet | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const box = useRef<HTMLElement>(null);

  useEffect(() => {
    loadPolities().then(setPolities);
  }, []);
  const p = useMemo(() => polities?.find((x) => x.en === en) ?? null, [polities, en]);
  useEffect(() => {
    setBooklet(null);
    setTab('overview');
    const id = bookletIdFor(en);
    if (id) loadBooklet(id).then(setBooklet, () => setBooklet(null));
  }, [en]);
  useGallery(box, `${en}-${tab}-${booklet?.id ?? ''}`);
  // объединение (империя), в которое государство входит в этом году — по строкам на карте
  const active = useStore((st) => st.timeActive);
  const groupIdx = p ? (active.find((r) => r.properties.i === p.i && r.properties.g >= 0)?.properties.g ?? -1) : -1;

  if (!polities) return <p className={s.state}>Открываю буклет…</p>;
  if (!p) return <p className={s.state}>Не нашёл государство «{en}».</p>;

  const span = p.span ?? [year, year];
  const onMapNow = year >= span[0] && year <= span[1];
  const group = groupIdx >= 0 ? (polities[groupIdx] ?? null) : null;
  const relations = polities.filter((x) => x.kind === 'relation' && x.en.includes(p.en));
  const events = EVENTS.filter((e) => e.year >= span[0] && e.year <= span[1]).sort((a, b) => a.year - b.year).slice(0, 8);
  const photo = getPhoto(booklet?.photo);
  const color = colorFor(group?.en ?? p.en);

  return (
    <article ref={box} className={b.booklet} style={{ '--rc': color, '--rk': '#8b1414' } as CSSProperties}>
      <header className={b.head}>
        <button type="button" className={s.back} onClick={() => navigate({ name: 'time', year })}>← К эпохе</button>
        {photo ? (
          <figure className={b.cover}>
            <Photo p={photo} alt={booklet?.name ?? p.ru} sizes="(max-width: 999px) 100vw, 38vw" lazy={false} />
          </figure>
        ) : null}
        <div className={b.titles}>
          <p className={b.kicker}>Историческое государство</p>
          <h2 className={`${b.name} ${(booklet?.name ?? p.ru).length > 14 ? b.nameLong : ''}`}>{booklet?.name ?? (p.ru || p.en)}</h2>
          <p className={b.tagline}>{booklet?.years ?? `${formatYear(span[0])} — ${formatYear(span[1])}`}</p>
          {p.ru && p.ru !== p.en ? <p className={b.fame}><span>В источниках:</span> {p.en}</p> : null}
          <div className={b.stamp} aria-label={booklet ? `Столица: ${booklet.capital}` : `Годы на карте`}>
            <small>{booklet ? 'Столица' : 'На карте'}</small>
            <b>{booklet ? booklet.capital : formatYear(span[0])}</b>
          </div>
        </div>
        {!onMapNow ? (
          <div className={b.actions}>
            <button type="button" onClick={() => setYear(span[0] === span[1] ? span[0] : Math.round((span[0] + span[1]) / 2))}>
              ⏳ Показать на карте ({formatYear(span[0])} — {formatYear(span[1])})
            </button>
          </div>
        ) : null}
      </header>

      <div className={b.tabs} role="tablist" aria-label="Разделы буклета">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={t.id === tab} className={b.tab} onClick={() => setTab(t.id)}>
            <span className={b.tabIcon} aria-hidden="true">{t.icon}</span> <span>{t.label}</span>
          </button>
        ))}
      </div>

      <section className={b.panel} role="tabpanel">
        {tab === 'overview' ? (
          <>
            {booklet ? <p className={s.lead}>{booklet.intro}</p> : (
              <p className={s.muted}>Подробного буклета пока нет — это автокарточка по данным карты Cliopatria.</p>
            )}
            <Section title="Годы на карте">
              <p>{formatYear(span[0])} — {formatYear(span[1])}{p.area ? ` · наибольшая площадь ≈ ${(p.area / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} млн км²` : ''}</p>
            </Section>
            {booklet?.timeline.length ? (
              <Section title="Вехи истории">
                <Timeline items={booklet.timeline} />
              </Section>
            ) : null}
            {booklet ? (
              <section className={s.fact}>
                <h3>💡 Чем запомнилось</h3>
                <p>{booklet.heritage}</p>
              </section>
            ) : null}
            <Section title="Что сегодня на этой земле">
              {p.today.length ? (
                <div className={s.near}>
                  {p.today.map((iso) => (
                    <button key={iso} type="button" onClick={() => navigate({ name: 'country', id: iso })}>
                      {COUNTRY_BY_ID.get(iso)?.name ?? iso}
                    </button>
                  ))}
                </div>
              ) : (
                <p className={s.muted}>Не удалось определить.</p>
              )}
            </Section>
            {events.length ? (
              <Section title="В мире в это время">
                <ul className={s.events}>
                  {events.map((e) => (
                    <li key={`${e.year}-${e.title}`}>
                      <b>{formatYear(e.year)}</b> {e.title}
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}
            {p.wd ? (
              <p className={s.muted}>
                Данные о государстве: <a href={`https://www.wikidata.org/wiki/${p.wd}`} target="_blank" rel="noopener noreferrer">Wikidata {p.wd}</a> · границы: Cliopatria (Seshat), CC BY 4.0
              </p>
            ) : null}
          </>
        ) : null}
        {tab === 'politics' ? (
          <>
            {group ? (
              <Section title="В составе">
                <p>
                  <button type="button" className={s.link} onClick={() => navigate({ name: 'time', year, polity: group.en })}>{group.ru || group.en}</button>
                </p>
              </Section>
            ) : null}
            <Soon title="Как управлялось государство" what="кто правил, как было устроено управление, законы и армия." />
          </>
        ) : null}
        {tab === 'culture' ? <Soon title="Культура и народы" what="кто здесь жил, языки, вера, искусство и изобретения." /> : null}
        {tab === 'relations' ? (
          <>
            {relations.length ? (
              <Section title="Связи с соседями своего времени" note="Союзы, подчинение, вассалитет и личные унии по данным Cliopatria. Включите слой «Связи», чтобы увидеть их на карте.">
                <ul className={s.events}>
                  {relations.map((r) => (
                    <li key={r.i}>
                      <b>{r.span ? `${formatYear(r.span[0])} — ${formatYear(r.span[1])}` : ''}</b> {r.ru || r.en}
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}
            <Soon title="Войны и дружба с соседями" what="с кем воевало и дружило государство и чем это закончилось." />
          </>
        ) : null}
      </section>
    </article>
  );
}
