import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { getPhoto, loadCountry, photoUrl } from '../content';
import type { Country } from '../content/schema';
import { REGIONS } from '../content/regions';
import { navigate } from '../app/router';
import { TABS, type TabId } from './tabs';
import { Overview } from './tabs/Overview';
import { Tourist } from './tabs/Tourist';
import { Politics } from './tabs/Politics';
import { Culture } from './tabs/Culture';
import { Relations } from './tabs/Relations';
import { Stereotypes } from './tabs/Stereotypes';
import s from './Booklet.module.css';

const PANELS: Record<TabId, (p: { c: Country }) => JSX.Element> = {
  overview: Overview,
  tourist: Tourist,
  politics: Politics,
  culture: Culture,
  relations: Relations,
  stereotypes: Stereotypes,
};

export function Booklet({ id, tab }: { id: string; tab: TabId }) {
  const [country, setCountry] = useState<Country | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const top = useRef<HTMLElement>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    loadCountry(id).then(
      (c) => alive && setCountry(c),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [id]);

  // при смене страны — наверх буклета
  useEffect(() => {
    top.current?.scrollIntoView({ block: 'start' });
  }, [id]);

  if (error) return <p className={s.state}>Не получилось открыть страну: {error}</p>;
  if (!country || country.id !== id) return <p className={s.state} aria-busy="true">Открываю буклет…</p>;

  const go = (t: TabId, focus = false) => {
    navigate({ name: 'country', id, tab: t }, true);
    if (focus) tabRefs.current[TABS.findIndex((x) => x.id === t)]?.focus();
  };
  // стрелки, Home/End и цифры 1–6, когда фокус на строке вкладок
  const onKey = (e: KeyboardEvent) => {
    const i = TABS.findIndex((x) => x.id === tab);
    let n = -1;
    if (e.key === 'ArrowRight') n = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = TABS.length - 1;
    else if (/^[1-6]$/.test(e.key)) n = Number(e.key) - 1;
    if (n < 0) return;
    e.preventDefault();
    go(TABS[n].id, true);
  };

  const cover = getPhoto(country.photos.cover);
  const Panel = PANELS[tab];
  const share = async () => {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: country.name, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* пользователь отменил */
    }
  };

  return (
    <article ref={top} className={s.booklet} style={{ '--rc': `var(--r-${country.region})`, '--rk': `var(--k-${country.region})` } as CSSProperties}>
      <header className={s.head}>
        {cover ? (
          <figure className={s.cover}>
            <img src={photoUrl(cover, 1200)} alt={country.name} width={560} height={280} />
            <a className={s.credit} href={cover.url} target="_blank" rel="noopener noreferrer">
              Фото: {cover.author} · {cover.license}
            </a>
          </figure>
        ) : null}
        <div className={s.titles}>
          <p className={s.kicker}>{REGIONS[country.region]}</p>
          <h2 className={s.name}>{country.name}</h2>
          <p className={s.tagline}>{country.tagline}</p>
          <p className={s.fame}>
            <span>Чем знаменита:</span> {country.fame}
          </p>
          <div className={s.stamp} aria-label={`Столица: ${country.capital}`}>
            <small>Столица</small>
            <b>{country.capital}</b>
          </div>
        </div>
        <div className={s.actions}>
          <button type="button" onClick={share}>🔗 Поделиться</button>
          <button type="button" disabled title="Появится на этапе 9">⚖️ Сравнить</button>
          <button type="button" onClick={() => window.print()}>🖨 Распечатать</button>
        </div>
      </header>

      <div className={s.tabs} role="tablist" aria-label="Разделы буклета" onKeyDown={onKey}>
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={t.id === tab}
            aria-controls={`panel-${t.id}`}
            tabIndex={t.id === tab ? 0 : -1}
            className={s.tab}
            onClick={() => go(t.id)}
          >
            <span className={s.tabIcon} aria-hidden="true">{t.icon}</span> <span>{t.label}</span>
          </button>
        ))}
      </div>

      <section className={s.panel} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0}>
        <Panel c={country} />
      </section>
    </article>
  );
}
