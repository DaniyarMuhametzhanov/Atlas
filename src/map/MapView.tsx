import { COUNTRY_BY_ID } from '../content';
import { useStore } from '../store/store';
import s from './MapView.module.css';

// Временная заглушка: снимок рельефа Blue Marble. Настоящая карта MapLibre — этап 4.
export function MapView() {
  const route = useStore((st) => st.route);
  const country = route.name === 'country' ? COUNTRY_BY_ID.get(route.id) : undefined;
  return (
    <div className={s.map} role="img" aria-label="Карта мира (заглушка)">
      <img className={s.relief} src={`${import.meta.env.BASE_URL}data/relief-bluemarble.jpg`} alt="" />
      <div className={s.note}>
        {country ? <b>{country.name}</b> : null}
        <span>Интерактивная карта MapLibre появится на этапе 4</span>
      </div>
      <span className={s.credit}>Рельеф: NASA Blue Marble</span>
    </div>
  );
}
