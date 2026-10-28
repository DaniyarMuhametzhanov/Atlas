// Общие кусочки вкладок: раздел с заголовком и пометка «Скоро появится».
import type { ReactNode } from 'react';
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
