import { COUNTRIES, photoCount } from '../content';
import { navigate } from '../app/router';
import { useStore } from '../store/store';
import s from './Welcome.module.css';

const KEYS: [string, string][] = [
  ['W A S D / стрелки', 'двигать карту'],
  ['Shift', 'быстрее'],
  ['Q / E, − / +', 'масштаб'],
  ['R', 'весь мир'],
  ['G', 'глобус'],
  ['F', 'поиск'],
  ['1–6, ← →', 'вкладки буклета (когда фокус на них)'],
];

// Что показывает буклет, пока страна не выбрана
export function Welcome() {
  const picks = ['KAZ', 'JPN', 'PER', 'EGY', 'ISL', 'NZL'].map((id) => COUNTRIES.find((c) => c.id === id)!).filter(Boolean);
  const explored = useStore((st) => st.explored);
  const recent = useStore((st) => st.recent)
    .map((id) => COUNTRIES.find((c) => c.id === id))
    .filter((c) => !!c);
  // считаем только страны с буклетом (отметка могла остаться от старой версии)
  const done = explored.filter((id) => COUNTRIES.some((c) => c.id === id)).length;
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
      {recent.length ? <h3>Недавно смотрели</h3> : null}
      <div className={s.picks}>
        {(recent.length ? recent : picks).map((c) => (
          <button key={c.id} type="button" onClick={() => navigate({ name: 'country', id: c.id })}>
            {explored.includes(c.id) ? <span aria-label="изучена">✓ </span> : null}
            {c.name}
          </button>
        ))}
      </div>
      <h3>Исследователь</h3>
      <div className={s.progress}>
        <p>
          Изучено <b>{done}</b> из {COUNTRIES.length}
        </p>
        <span className={s.track} role="progressbar" aria-valuemin={0} aria-valuemax={COUNTRIES.length} aria-valuenow={done} aria-label="Изучено стран">
          <i style={{ width: `${(done / COUNTRIES.length) * 100}%` }} />
        </span>
        <p className={s.muted}>
          {done
            ? 'Изученные страны отмечены на карте зелёной галочкой.'
            : 'Откройте страну и нажмите «☆ Отметить изученной» — где побывали или о которой прочитали.'}
        </p>
      </div>
      <h3>Поиграть и сравнить</h3>
      <div className={s.picks}>
        <button type="button" onClick={() => navigate({ name: 'quiz' })}>
          🎯 Викторина
        </button>
        <button type="button" onClick={() => navigate({ name: 'tour' })}>
          🧭 Случайная экскурсия
        </button>
        <button type="button" onClick={() => navigate({ name: 'compare', ids: [] })}>
          ⚖️ Сравнить страны
        </button>
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
