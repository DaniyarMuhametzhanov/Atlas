import { COUNTRIES, photoCount } from '../content';
import { navigate } from '../app/router';
import s from './Welcome.module.css';

const KEYS: [string, string][] = [
  ['W A S D / стрелки', 'двигать карту'],
  ['Shift', 'быстрее'],
  ['Q / E, − / +', 'масштаб'],
  ['R', 'весь мир'],
  ['1–6, ← →', 'вкладки буклета (когда фокус на них)'],
];

// Что показывает буклет, пока страна не выбрана
export function Welcome() {
  const picks = ['KAZ', 'JPN', 'PER', 'EGY', 'ISL', 'NZL'].map((id) => COUNTRIES.find((c) => c.id === id)!).filter(Boolean);
  return (
    <div className={s.welcome}>
      <h2>Атлас-путеводитель</h2>
      <p>
        Выберите страну на карте или в поиске — откроется буклет: обзор, советы туристу, политика, культура, отношения с
        соседями и стереотипы.
      </p>
      <p className={s.muted}>
        В атласе {COUNTRIES.length} стран и {photoCount} фото.
      </p>
      <div className={s.picks}>
        {picks.map((c) => (
          <button key={c.id} type="button" onClick={() => navigate({ name: 'country', id: c.id })}>
            {c.name}
          </button>
        ))}
      </div>
      <h3>Клавиатура</h3>
      <dl className={s.keys}>
        {KEYS.map(([k, v]) => (
          <div key={k}>
            <dt><kbd>{k}</kbd></dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
