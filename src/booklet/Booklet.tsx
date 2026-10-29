import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import { useStore } from '../store/store';
import { Art } from './art/Art';
import { COUNTRIES, getPhoto, loadCountry } from '../content';
import { shareInTelegram, TELEGRAM } from '../telegram/telegram';
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
import { Photo } from '../ui/photos/Photo';
import { useGallery } from '../ui/photos/useGallery';
import s from './Booklet.module.css';

const PANELS: Record<TabId, (p: { c: Country }) => JSX.Element> = {
  overview: Overview,
  tourist: Tourist,
  politics: Politics,
  culture: Culture,
  relations: Relations,
  stereotypes: Stereotypes,
};

/**
 * В круглый штамп столицы помещается ≈7 букв шрифта Unbounded: длинное слово уменьшаем, а не рвём посередине
 * («Претори / я»). Не меньше 65% — дальше уже не прочитать; совсем длинные («Шри-Джаяварденепура-Котте») переносятся.
 */
function stampFit(capital: string): number {
  const longest = Math.max(...capital.split(/[\s-]+/).map((w) => w.length));
  return Math.max(0.65, Math.min(1, 7 / longest));
}

/** Фото грузятся лениво (по мере прокрутки); для печати нужны все сразу */
function eagerImages(root: HTMLElement | null): HTMLImageElement[] {
  const imgs = [...(root?.querySelectorAll('img') ?? [])];
  for (const i of imgs) i.loading = 'eager';
  return imgs;
}
/** Дождаться загрузки фото, но не дольше ms — медленная сеть не должна держать печать */
function waitImages(imgs: HTMLImageElement[], ms: number): Promise<unknown> {
  const one = (i: HTMLImageElement) =>
    i.complete
      ? null
      : new Promise((ok) => {
          i.addEventListener('load', ok, { once: true });
          i.addEventListener('error', ok, { once: true });
        });
  const all = Promise.all(imgs.map(one));
  return Promise.race([all, new Promise((ok) => setTimeout(ok, ms))]);
}

export function Booklet({ id, tab }: { id: string; tab: TabId }) {
  const [country, setCountry] = useState<Country | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printAll, setPrintAll] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const top = useRef<HTMLElement>(null);
  const setRelationsMap = useStore((st) => st.setRelationsMap);
  const explored = useStore((st) => st.explored.includes(id));
  const toggleExplored = useStore((st) => st.toggleExplored);
  // обложка и все фото открытой вкладки — одна галерея на весь экран
  useGallery(top, country?.id === id ? id : null);

  // при печати (кнопкой или Ctrl+P) печатаем все вкладки сразу
  useEffect(() => {
    const before = () => {
      flushSync(() => setPrintAll(true));
      eagerImages(top.current);
    };
    const after = () => setPrintAll(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  // режим «Отношения» на карте относится к одной стране — при смене страны выключаем
  useEffect(() => {
    const rm = useStore.getState().relationsMap;
    if (rm && rm.iso !== id) setRelationsMap(null);
  }, [id, setRelationsMap]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

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

  // на узком экране строка вкладок листается вбок — держим активную вкладку в поле зрения
  useEffect(() => {
    const el = tabRefs.current[TABS.findIndex((x) => x.id === tab)];
    const row = el?.parentElement;
    if (!el || !row || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({ left: el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2, behavior: 'auto' });
  }, [tab, country]);

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
  const [motif, land] = country.icon.motif.split(' ');
  const share = async () => {
    if (shareInTelegram(country.name)) return;
    const url = location.href;
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: country.name, url });
      else {
        await navigator.clipboard.writeText(url);
        setToast('Ссылка скопирована');
      }
    } catch {
      /* пользователь отменил или буфер обмена недоступен */
    }
  };

  return (
    <article ref={top} className={s.booklet} style={{ '--rc': `var(--r-${country.region})`, '--rk': `var(--k-${country.region})` } as CSSProperties}>
      <header className={s.head}>
        <figure className={s.cover}>
          {cover ? (
            <>
              <Photo p={cover} alt={country.name} country={country.name} sizes="(max-width: 760px) 100vw, 560px" width={560} height={280} lazy={false} />
              <a className={s.credit} href={cover.url} target="_blank" rel="noopener noreferrer">
                Фото: {cover.author} · {cover.license}
              </a>
            </>
          ) : (
            <Art motif={motif} land={land} seed={country.name} big />
          )}
        </figure>
        <div className={s.titles}>
          <p className={s.kicker}>{REGIONS[country.region]}</p>
          <h2 className={`${s.name} ${country.name.length > 12 ? s.nameLong : ''}`}>{country.name}</h2>
          <p className={s.tagline}>{country.tagline}</p>
          <p className={s.fame}>
            <span>Чем знаменита:</span> {country.fame}
          </p>
          <div className={s.stamp} aria-label={`Столица: ${country.capital}`} style={{ '--fit': stampFit(country.capital) } as CSSProperties}>
            <small>Столица</small>
            <b>{country.capital}</b>
          </div>
        </div>
        <div className={s.actions}>
          <button type="button" onClick={share}>🔗 Поделиться</button>
          <button
            type="button"
            className={explored ? s.explored : undefined}
            aria-pressed={explored}
            onClick={() => {
              toggleExplored(id);
              setToast(explored ? 'Отметка снята' : `Изучено: ${useStore.getState().explored.length} из ${COUNTRIES.length}`);
            }}
          >
            {explored ? '✓ Изучена' : '☆ Отметить изученной'}
          </button>
          <button type="button" onClick={() => navigate({ name: 'compare', ids: [id] })}>⚖️ Сравнить</button>
          {TELEGRAM ? null : (
            <button
              type="button"
              onClick={async () => {
                // сначала все вкладки и все фото, потом окно печати — иначе фото ниже экрана печатаются пустыми
                flushSync(() => setPrintAll(true));
                // места природы и заповедники подгружаются отдельно — даём им появиться
                await new Promise((ok) => setTimeout(ok, 300));
                await waitImages(eagerImages(top.current), 4000);
                window.print();
              }}
            >
              🖨 Распечатать
            </button>
          )}
          <span className={s.toast} role="status">{toast}</span>
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

      {printAll ? (
        TABS.map((t) => {
          const P = PANELS[t.id];
          return (
            <section key={t.id} className={s.panel}>
              <h3 className={s.printTitle}>{t.icon} {t.label}</h3>
              <P c={country} />
            </section>
          );
        })
      ) : (
        <section className={s.panel} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0}>
          <Panel c={country} />
        </section>
      )}
    </article>
  );
}
