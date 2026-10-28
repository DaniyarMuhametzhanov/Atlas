import { useState } from 'react';
import { useStore, type LayerId } from '../store/store';
import s from './MapView.module.css';

const LAYER_LABEL: Record<LayerId, string> = {
  countries: 'Значки стран',
  nature: 'Природа',
  reserves: 'Заповедники',
  wonders: 'Чудеса света',
  capitals: 'Столицы',
  cities: 'Крупные города',
};

// Кнопки поверх карты: режим «Рельеф / Регионы», глобус, слои, масштаб
export function MapControls({ onZoom, onReset }: { onZoom: (d: number) => void; onReset: () => void }) {
  const mapMode = useStore((st) => st.mapMode);
  const setMapMode = useStore((st) => st.setMapMode);
  const globe = useStore((st) => st.globe);
  const setGlobe = useStore((st) => st.setGlobe);
  const layers = useStore((st) => st.layers);
  const toggleLayer = useStore((st) => st.toggleLayer);
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className={s.topLeft}>
        <div className={s.modes} role="group" aria-label="Вид карты">
          <button type="button" aria-pressed={mapMode === 'relief'} onClick={() => setMapMode('relief')}>Рельеф</button>
          <button type="button" aria-pressed={mapMode === 'regions'} onClick={() => setMapMode('regions')}>Регионы</button>
        </div>
        <button type="button" className={s.chip} aria-pressed={globe} onClick={() => setGlobe(!globe)} title="Глобус (G)">
          🌐 <span className={s.wide}>Глобус</span>
        </button>
        <div className={s.layersWrap}>
          <button type="button" className={s.chip} aria-expanded={open} aria-controls="map-layers" onClick={() => setOpen(!open)}>
            ☰ <span className={s.wide}>Слои</span>
          </button>
          {open ? (
            <fieldset id="map-layers" className={s.layers}>
              <legend className="visually-hidden">Что показывать на карте</legend>
              {(Object.keys(LAYER_LABEL) as LayerId[]).map((id) => (
                <label key={id}>
                  <input type="checkbox" checked={layers[id]} onChange={() => toggleLayer(id)} /> {LAYER_LABEL[id]}
                </label>
              ))}
            </fieldset>
          ) : null}
        </div>
      </div>
      <div className={s.zoom}>
        <button type="button" onClick={() => onZoom(1)} aria-label="Приблизить (E)">+</button>
        <button type="button" onClick={() => onZoom(-1)} aria-label="Отдалить (Q)">−</button>
        <button type="button" onClick={onReset} aria-label="Весь мир (R)" title="Весь мир (R)">⟲</button>
      </div>
    </>
  );
}
