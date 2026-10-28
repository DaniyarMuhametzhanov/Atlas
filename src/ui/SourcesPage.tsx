import { DATASETS, getPhoto } from '../content';
import sources from '../../content/sources.json';
import s from './SourcesPage.module.css';

// Источники и лицензии: наборы данных и все фото с авторами
export function SourcesPage() {
  const photos = sources.photos.map((p) => getPhoto(p.id)!).sort((a, b) => a.title.localeCompare(b.title));
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
      <p className={s.muted}>Все фото — с Wikimedia Commons, у каждого своя свободная лицензия.</p>
      <ul className={s.photos}>
        {photos.map((p) => (
          <li key={p.id}>
            <a href={p.url} target="_blank" rel="noopener noreferrer">{p.title}</a> — {p.author}, {p.license}
          </li>
        ))}
      </ul>
    </article>
  );
}
