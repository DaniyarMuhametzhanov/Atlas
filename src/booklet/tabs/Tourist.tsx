import { useEffect, useState } from 'react';
import type { Country } from '../../content/schema';
import { getPhoto, photoUrl } from '../../content';
import { loadPlaces, type PlacesData } from '../../content/places';
import { Section, Soon } from '../parts';
import s from './tabs.module.css';

const DANGER = ['', 'Безопасно', 'Нужна осторожность', 'Высокий риск', 'Не ездить'];

function Thumb({ id, alt }: { id?: string; alt: string }) {
  const p = getPhoto(id);
  if (!p) return <span className={s.thumb} aria-hidden="true" />;
  return (
    <span className={s.thumb}>
      <img src={photoUrl(p, 224)} alt={alt} loading="lazy" width={224} height={112} />
    </span>
  );
}

export function Tourist({ c }: { c: Country }) {
  const t = c.tourist;
  const [places, setPlaces] = useState<PlacesData | null>(null);
  useEffect(() => {
    loadPlaces().then(setPlaces);
  }, []);
  const groups = [
    { ids: t.wonders, title: '★ Чудеса света', tag: 'Чудо света', cls: s.won },
    { ids: t.reserves, title: 'Заповедники', tag: 'Заповедник', cls: s.res },
    { ids: t.nature, title: 'Природа', tag: 'Природа', cls: s.nat },
  ];

  return (
    <>
      <Section title="Что посмотреть">
        <div className={s.cards}>
          {t.sights.map((p) => (
            <div key={p.name} className={s.card}>
              <Thumb id={p.photos?.[0]} alt={p.name} />
              <span>
                <strong>{p.name}</strong>
                <span>{p.text}</span>
              </span>
            </div>
          ))}
        </div>
      </Section>

      {places
        ? groups.map((g) =>
            g.ids.length ? (
              <Section key={g.title} title={g.title}>
                <div className={s.cards}>
                  {g.ids.map((id) => {
                    const p = places.byId.get(id);
                    if (!p) return null;
                    return (
                      <div key={id} className={s.card}>
                        <Thumb id={p.photo} alt={p.name} />
                        <span>
                          <span className={`${s.tag} ${g.cls}`}>{g.tag}</span>
                          <strong>{p.name}</strong>
                          <span>{p.text}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Section>
            ) : null,
          )
        : null}

      {t.practical ? null : <Soon title="Практическая информация" what="валюта и курс, языки, 5 полезных фраз, розетки, часовой пояс, визы для граждан Казахстана и России, лучший сезон." />}
      {t.climate ? null : <Soon title="Климат" what="температура и осадки по месяцам в столице." />}
      {t.food ? null : <Soon title="Кухня" what="3–5 главных блюд с фото." />}
      {t.etiquette ? null : <Soon title="Этикет" what="что можно ✅ и чего лучше не делать ❌." />}

      <Section
        title="Уровень опасности"
        note={<>Оценка: {t.danger.asOf}. Перед поездкой проверьте рекомендации МИД своей страны.</>}
      >
        <div className={s.meter} data-l={t.danger.level} aria-label={`Уровень ${t.danger.level} из 4: ${DANGER[t.danger.level]}`}>
          {[1, 2, 3, 4].map((i) => (
            <i key={i} className={i <= t.danger.level ? s.on : undefined} />
          ))}
          <b>{DANGER[t.danger.level]}</b>
        </div>
        <p>{t.danger.text}</p>
      </Section>
    </>
  );
}
