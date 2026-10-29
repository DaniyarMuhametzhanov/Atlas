// Что происходит при выборе подсказки: карта перелетает к месту, открывается буклет на нужной вкладке,
// историческое государство открывает машину времени на его годах.
import type { Feature } from 'geojson';
import { navigate } from '../app/router';
import { COUNTRY_BY_ID } from '../content';
import { useStore } from '../store/store';
import { activeRows, centuryOf, loadCentury, MAX_YEAR, MIN_YEAR, type Polity, type Row } from '../map/time/data';
import type { SearchItem } from './searchIndex';

type BBox = [number, number, number, number];

function bboxOf(features: Feature[]): BBox {
  const b: BBox = [180, 90, -180, -90];
  const walk = (c: unknown): void => {
    if (typeof (c as number[])[0] === 'number') {
      const [x, y] = c as number[];
      b[0] = Math.min(b[0], x);
      b[1] = Math.min(b[1], y);
      b[2] = Math.max(b[2], x);
      b[3] = Math.max(b[3], y);
    } else (c as unknown[]).forEach(walk);
  };
  for (const f of features) if (f.geometry && 'coordinates' in f.geometry) walk(f.geometry.coordinates);
  return b;
}

/**
 * Год, в который показать государство, и его рамка на карте.
 * Берём пять лет на равных расстояниях за время существования и выбираем тот, где государство крупнее всего:
 * середина бывает неудачной (у Золотой Орды в 1495 году — уже остаток).
 */
export async function polityView(p: Polity): Promise<{ year: number; bbox?: BBox }> {
  const [a, b] = p.span ?? [1700, 1700];
  const fix = (y: number) => Math.max(MIN_YEAR, Math.min(MAX_YEAR, Math.round(y))) || 1; // нулевого года нет
  const years = [...new Set([0.1, 0.3, 0.5, 0.7, 0.9].map((k) => fix(a + (b - a) * k)))];
  let best: { year: number; rows: Row[]; area: number } | null = null;
  for (const year of years) {
    const rows = activeRows(await loadCentury(centuryOf(year)), year).filter(
      (r) => r.properties.i === p.i || r.properties.g === p.i,
    );
    const area = rows.reduce((s, r) => s + r.properties.ar, 0);
    if (rows.length && (!best || area > best.area)) best = { year, rows, area };
  }
  if (!best) return { year: fix(a) };
  const bbox = bboxOf(best.rows);
  // государство через линию перемены дат (Россия, США) — рамка на весь мир бесполезна, берём самую большую часть
  if (bbox[2] - bbox[0] > 200) {
    const big = best.rows.reduce((m, r) => (r.properties.ar > m.properties.ar ? r : m));
    return { year: best.year, bbox: bboxOf([big]) };
  }
  return { year: best.year, bbox };
}

export async function openItem(item: SearchItem): Promise<void> {
  const st = useStore.getState();
  const hasBooklet = !!item.iso && COUNTRY_BY_ID.has(item.iso);
  switch (item.kind) {
    case 'country':
      st.setFocusPlace(null);
      navigate({ name: 'country', id: item.iso!, tab: 'overview' });
      return;
    case 'capital':
    case 'city':
      st.setFocusPlace(null);
      st.setFlyTo({ center: [item.lon!, item.lat!], zoom: item.kind === 'capital' ? 6 : 7, iso: hasBooklet ? item.iso : undefined });
      if (hasBooklet) navigate({ name: 'country', id: item.iso!, tab: 'overview' });
      return;
    case 'wonder':
    case 'nature':
    case 'reserve':
      // буклет прокрутит вкладку «Туристу» к карточке места; на zoom 6 видна булавка
      st.setFocusPlace(item.placeId!);
      st.setFlyTo({ center: [item.lon!, item.lat!], zoom: 6.5, iso: hasBooklet ? item.iso : undefined });
      if (hasBooklet) navigate({ name: 'country', id: item.iso!, tab: 'tourist' });
      return;
    case 'polity': {
      const p = item.polity!;
      const { year, bbox } = await polityView(p);
      st.setHistoryOf(null);
      st.setPlaying(false);
      st.setYear(year);
      if (bbox) st.setFlyTo({ bbox, zoom: 4.5 });
      navigate({ name: 'time', year, polity: p.en });
      return;
    }
  }
}
