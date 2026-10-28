import { useEffect, useState } from 'react';
import type { Country, MapPlace } from '../../content/schema';
import { getPhoto } from '../../content';
import { Photo } from '../../ui/photos/Photo';
import { loadPlaces, type PlacesData } from '../../content/places';
import natureTypes from '../../../content/places/nature-types.json';
import wonderKinds from '../../../content/places/wonder-kinds.json';
import { useStore } from '../../store/store';
import { Art } from '../art/Art';
import { sightMotif } from '../art/scenes';
import { ClimateCharts } from '../charts/ClimateCharts';
import { AsOf, Bullets, Section, Soon } from '../parts';
import s from './tabs.module.css';

const DANGER = ['', 'Безопасно', 'Нужна осторожность', 'Высокий риск', 'Не ездить'];
const NTYPE = natureTypes as Record<string, { ru: string; icon: string; land: string }>;
const WKIND = wonderKinds as Record<string, string>;

/** Фото места или запасной рисунок */
function Thumb({ photo, alt, art, country }: { photo?: string; alt: string; art: [string, string]; country: string }) {
  const p = getPhoto(photo);
  return (
    <span className={s.thumb}>
      {p ? (
        <Photo p={p} alt={alt} country={country} sizes="(max-width: 480px) 96px, 128px" width={224} height={112} />
      ) : (
        <Art motif={art[0]} land={art[1]} seed={alt} />
      )}
    </span>
  );
}

function placeTag(p: MapPlace): { tag: string; cls: string } {
  if (p.type === 'reserve') return { tag: 'Заповедник', cls: s.res };
  if (WKIND[p.type]) return { tag: `★ ${WKIND[p.type]}`, cls: s.won };
  return { tag: NTYPE[p.type]?.ru ?? 'Природа', cls: s.nat };
}

export function Tourist({ c }: { c: Country }) {
  const t = c.tourist;
  const [motif, land] = c.icon.motif.split(' ');
  const [places, setPlaces] = useState<PlacesData | null>(null);
  const focus = useStore((st) => st.focusPlace);
  useEffect(() => {
    loadPlaces().then(setPlaces);
  }, []);
  // нажали на булавку на карте — прокручиваем к карточке этого места
  useEffect(() => {
    if (!places || !focus) return;
    const el = document.getElementById(`place-${focus}`);
    el?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [places, focus]);

  const groups = [
    { ids: t.wonders, title: '★ Чудеса света' },
    { ids: t.reserves, title: 'Заповедники' },
    { ids: t.nature, title: 'Природа' },
  ];
  const pr = t.practical;

  return (
    <>
      <Section title="Что посмотреть">
        <div className={s.cards}>
          {t.sights.map((p) => {
            const art = sightMotif(p.name, p.text, motif, c.region, land);
            return (
              <div key={p.name} className={s.card}>
                <Thumb photo={p.photos?.[0]} alt={p.name} art={art} country={c.name} />
                <span>
                  <strong>{p.name}</strong>
                  <span>{p.text}</span>
                  {p.photos && p.photos.length > 1 ? (
                    <span className={s.strip}>
                      {p.photos.slice(1, 5).map((id) => {
                        const ph = getPhoto(id);
                        return ph ? (
                          <span key={id} className={s.stripItem}>
                            <Photo p={ph} alt={`${p.name}: ещё фото`} country={c.name} sizes="56px" />
                          </span>
                        ) : null;
                      })}
                    </span>
                  ) : null}
                </span>
              </div>
            );
          })}
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
                    const { tag, cls } = placeTag(p);
                    const nt = NTYPE[p.type];
                    return (
                      <div key={id} id={`place-${id}`} className={`${s.card} ${focus === id ? s.focus : ''}`}>
                        <Thumb photo={p.photo} alt={p.name} art={nt ? [nt.icon, nt.land] : ['forest', 'jungle']} country={c.name} />
                        <span>
                          <span className={`${s.tag} ${cls}`}>{tag}</span>
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

      {pr ? (
        <Section title="Практическая информация">
          <dl className={s.practical}>
            <div><dt>Валюта</dt><dd>{pr.currency}{pr.rateHint ? <small> · {pr.rateHint}</small> : null}</dd></div>
            <div><dt>Языки</dt><dd>{pr.languages.join(', ')}</dd></div>
            <div><dt>Розетки и напряжение</dt><dd>{pr.plugs} · {pr.voltage}</dd></div>
            <div><dt>Часовой пояс</dt><dd>{pr.timezone}</dd></div>
            {pr.visaKZ ? <div><dt>Виза для граждан Казахстана</dt><dd>{pr.visaKZ}</dd></div> : null}
            {pr.visaRU ? <div><dt>Виза для граждан России</dt><dd>{pr.visaRU}</dd></div> : null}
            <div><dt>Лучший сезон</dt><dd>{pr.bestSeason}</dd></div>
          </dl>
          {pr.phrases?.length ? (
            <table className={s.phrases}>
              <caption>Полезные фразы</caption>
              <thead>
                <tr><th>По-русски</th><th>По-местному</th><th>Как произносить</th></tr>
              </thead>
              <tbody>
                {pr.phrases.map((ph) => (
                  <tr key={ph.ru}><td>{ph.ru}</td><td lang="und">{ph.local}</td><td><i>{ph.say}</i></td></tr>
                ))}
              </tbody>
            </table>
          ) : null}
          <AsOf value={pr.asOf} />
          {pr.visaKZ || pr.visaRU ? <p className={s.soonLine}>Правила въезда меняются — проверьте их перед поездкой.</p> : null}
        </Section>
      ) : (
        <Soon title="Практическая информация" what="валюта и курс, языки, 5 полезных фраз, розетки, часовой пояс, визы для граждан Казахстана и России, лучший сезон." />
      )}

      {t.climate ? (
        <Section title="Климат">
          <ClimateCharts rows={t.climate} city={c.capital} />
        </Section>
      ) : (
        <Soon title="Климат" what="температура и осадки по месяцам в столице." />
      )}

      {t.food?.length ? (
        <Section title="Кухня">
          <div className={s.cards}>
            {t.food.map((f) => (
              <div key={f.name} className={s.card}>
                <Thumb photo={f.photo} alt={f.name} art={['none', 'plain']} country={c.name} />
                <span>
                  <strong>{f.name}</strong>
                  <span>{f.text}</span>
                </span>
              </div>
            ))}
          </div>
        </Section>
      ) : (
        <Soon title="Кухня" what="3–5 главных блюд с фото." />
      )}

      {t.etiquette ? (
        <Section title="Этикет">
          <div className={s.etiquette}>
            <div>
              <h4>✅ Можно</h4>
              <Bullets items={t.etiquette.do} />
            </div>
            <div>
              <h4>❌ Лучше не надо</h4>
              <Bullets items={t.etiquette.dont} />
            </div>
          </div>
        </Section>
      ) : (
        <Soon title="Этикет" what="что можно ✅ и чего лучше не делать ❌." />
      )}

      <Section title="Уровень опасности" note={<>Оценка: {t.danger.asOf}. Перед поездкой проверьте рекомендации МИД своей страны.</>}>
        <div className={s.meter} data-l={t.danger.level} role="img" aria-label={`Уровень ${t.danger.level} из 4: ${DANGER[t.danger.level]}`}>
          {[1, 2, 3, 4].map((i) => (
            <i key={i} className={i <= t.danger.level ? s.on : undefined} />
          ))}
          <b>{t.danger.level} из 4 · {DANGER[t.danger.level]}</b>
        </div>
        <p>{t.danger.text}</p>
      </Section>
    </>
  );
}
