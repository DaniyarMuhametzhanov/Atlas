// Общие кусочки вкладок: раздел с заголовком и пометка «Скоро появится».
import type { CSSProperties, ReactNode } from 'react';
import s from './parts.module.css';

export function Section({ title, children, note }: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section className={s.sec}>
      <h3 className={s.h}>{title}</h3>
      {children}
      {note ? <p className={s.note}>{note}</p> : null}
    </section>
  );
}

/** Раздел без данных не прячем: показываем, чего не хватает */
export function Soon({ title, what }: { title: string; what: string }) {
  return (
    <Section title={title}>
      <p className={s.soon}>
        <span aria-hidden="true">⏳</span> <b>Скоро появится:</b> {what}
      </p>
    </Section>
  );
}

export function Timeline({ items }: { items: { year: string; text: string }[] }) {
  return (
    <ol className={s.tl}>
      {items.map((it, i) => (
        <li key={i}>
          <b>{it.year}</b>
          <span>{it.text}</span>
        </li>
      ))}
    </ol>
  );
}

export function Bullets({ items }: { items: string[] }) {
  return (
    <ul className={s.bul}>
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

/** «Верно на: …» — когда проверены быстро меняющиеся данные (политика, визы, курсы, опасность) */
export function AsOf({ value }: { value?: string }) {
  if (!value) return null;
  return <p className={s.note}>Верно на: {value}</p>;
}

export const STATUS_CLASS: Record<string, string> = {
  союз: 'alliance',
  дружба: 'friend',
  нейтрально: 'neutral',
  напряжённость: 'tension',
  конфликт: 'conflict',
};
const STATUS_ICON: Record<string, string> = { союз: '◆', дружба: '●', нейтрально: '○', напряжённость: '▲', конфликт: '✖' };

/** Метка статуса отношений: цвет + значок + слово (не только цвет) */
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={s.badge} style={{ '--c': `var(--rel-${STATUS_CLASS[status]})` } as CSSProperties}>
      <span aria-hidden="true">{STATUS_ICON[status]}</span> {status}
    </span>
  );
}
