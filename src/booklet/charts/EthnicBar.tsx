// Этнический состав: одна полоса 100% из долей и список с процентами.
// Цвета — категориальная палитра в фиксированном порядке; больше 7 групп сворачиваются в «Другие».
import s from './charts.module.css';

type Group = { group: string; percent: number };
const MAX = 7;

export function EthnicBar({ groups, source, multi }: { groups: Group[]; source?: string; multi?: boolean }) {
  const sorted = [...groups].sort((a, b) => b.percent - a.percent);
  const shown = sorted.slice(0, sorted.length > MAX + 1 ? MAX : MAX + 1);
  const rest = sorted.slice(shown.length).reduce((n, g) => n + g.percent, 0);
  const total = sorted.reduce((n, g) => n + g.percent, 0);
  // если можно было назвать несколько народов, «Другие» не досчитываем: сумма и так больше 100%
  const other = multi ? rest : Math.max(rest, 100 - total > 0.05 ? 100 - total : 0);
  const rows = other > 0 ? [...shown, { group: 'Другие', percent: Math.round(other * 10) / 10 }] : shown;
  const color = (i: number, g: Group) => (g.group === 'Другие' ? 'var(--muted)' : `var(--series-${i + 1})`);

  return (
    <figure className={s.ethnic}>
      <div className={s.bar} role="img" aria-label={rows.map((g) => `${g.group} ${g.percent}%`).join(', ')}>
        {rows.map((g, i) => (
          <span key={g.group} style={{ flexGrow: g.percent, background: color(i, g) }} title={`${g.group}: ${g.percent}%`} />
        ))}
      </div>
      <ul className={s.legend}>
        {rows.map((g, i) => (
          <li key={g.group}>
            <i style={{ background: color(i, g) }} aria-hidden="true" />
            <span>{g.group}</span>
            <b>{g.percent.toLocaleString('ru-RU')}%</b>
          </li>
        ))}
      </ul>
      {multi ? <figcaption>Люди могли назвать несколько народов, поэтому сумма больше 100%.</figcaption> : null}
      {source ? <figcaption>Источник: {source}</figcaption> : null}
    </figure>
  );
}
