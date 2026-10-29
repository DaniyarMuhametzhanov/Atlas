import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { loadPlaces } from '../content/places';
import { DATASETS, getPhoto } from '../content';
import type { PhotoSource } from '../content/schema';
import sources from '../../content/sources.json';
import { normalize } from '../search/fuzzy';
import s from './SourcesPage.module.css';

/** «CC BY-SA 4.0» → «CC BY-SA»: версии одной лицензии в сводке складываем вместе */
const family = (license: string) => license.replace(/\s+[\d.]+.*$/, '').trim() || license;

// Источники и лицензии: наборы данных и все фото с авторами. У фото — поиск: их почти девятьсот.
export function SourcesPage() {
  const photos = useMemo(
    () =>
      (sources.photos as { id: string }[])
        .map((p) => getPhoto(p.id))
        .filter((p): p is PhotoSource => !!p)
        .sort((a, b) => a.title.localeCompare(b.title, 'ru')),
    [],
  );
  const licenses = useMemo(() => {
    const by = new Map<string, number>();
    for (const p of photos) by.set(family(p.license), (by.get(family(p.license)) ?? 0) + 1);
    return [...by].sort((a, b) => b[1] - a[1]);
  }, [photos]);
  // названия фото на Commons — обычно английские; добавляем к поиску русские названия мест, где фото стоит
  const [placeNames, setPlaceNames] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    loadPlaces().then((d) => setPlaceNames(new Map([...d.byId.values()].filter((x) => x.photo).map((x) => [x.photo!, x.name]))));
  }, []);
  const [q, setQ] = useState('');
  const query = normalize(useDeferredValue(q));
  const shown = query
    ? photos.filter((p) => normalize(`${p.title} ${p.author} ${p.license} ${placeNames.get(p.id) ?? ''}`).includes(query))
    : photos;

  return (
    <article className={s.page}>
      <a href="#/" className={s.back}>← К карте</a>
      <h1>Источники и лицензии</h1>
      <h2>Наборы данных</h2>
      <table className={s.table}>
        <thead>
          <tr><th>Данные</th><th>Лицензия</th></tr>
        </thead>
        <tbody>
          {DATASETS.map((d) => (
            <tr key={d.id}>
              <td><a href={d.url} target="_blank" rel="noopener noreferrer">{d.name}</a></td>
              <td>{d.license}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Фото ({photos.length})</h2>
      <p className={s.muted}>
        Все фото — с Wikimedia Commons под свободными лицензиями:{' '}
        {licenses.map(([l, n], i) => (
          <span key={l}>
            {i ? ', ' : ''}
            {l} — {n}
          </span>
        ))}
        .
      </p>
      <input
        type="search"
        className={s.filter}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Найти фото по названию, автору или лицензии"
        aria-label="Найти фото по названию, автору или лицензии"
      />
      {query ? <p className={s.muted} role="status">Найдено: {shown.length}</p> : null}
      <ul className={s.photos}>
        {shown.map((p) => (
          <li key={p.id}>
            <a href={p.url} target="_blank" rel="noopener noreferrer">{p.title}</a>
            {placeNames.has(p.id) ? <span className={s.place}> ({placeNames.get(p.id)})</span> : null} — {p.author}, {p.license}
          </li>
        ))}
      </ul>
    </article>
  );
}
