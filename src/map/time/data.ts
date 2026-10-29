// Данные машины времени: файлы по векам (готовит scripts/build-history.ts), отбор государств на год,
// цвета, справочник государств и эпохи.
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import epochsJson from '../../../content/epochs/epochs.json';

import { fetchAsset } from '../../lib/asset';
export const MIN_YEAR = -3000;
export const MAX_YEAR = 2024;
/** Годы эпох: панель эпохи, клавиши [ ], шкала проигрывателя */
export const EPOCHS: number[] = [...(epochsJson as number[]), MAX_YEAR];

/** Строка Cliopatria: государство в промежутке лет a…b */
export type RowProps = {
  i: number; // номер имени в справочнике
  a: number;
  b: number;
  g: number; // номер объединения (империи), в которое входит, или −1
  ar: number; // площадь, км²
  lx: number; // точка подписи
  ly: number;
  t: string; // «сегодня здесь»: коды стран через пробел
  k: 0 | 1; // 1 — объединение («(British Empire)»): само не рисуется, даёт цвет и подпись
};
export type Row = Feature<Polygon | MultiPolygon, RowProps>;
export type Polity = {
  i: number;
  en: string;
  ru: string;
  kind: 'polity' | 'group' | 'relation';
  span?: [number, number];
  area: number;
  wd?: string;
  today: string[];
};

const getJson = async <T,>(file: string): Promise<T> => {
  const res = await fetchAsset(`data/history/${file}`);
  if (!res.ok) throw new Error(`Не загрузился ${file}: ${res.status}`);
  return res.json() as Promise<T>;
};

type Index = { centuries: number[]; peoples: number[] };
let indexP: Promise<Index> | null = null;
export const loadIndex = () => (indexP ??= getJson<Index>('index.json'));

const centuryCache = new Map<number, Promise<Row[]>>();
export const centuryOf = (y: number) => Math.floor(y / 100) * 100;
/** Все строки века (кэшируются; соседние века загружаем заранее) */
export function loadCentury(c: number): Promise<Row[]> {
  if (!centuryCache.has(c)) {
    centuryCache.set(
      c,
      loadIndex().then(async (idx) => {
        if (!idx.centuries.includes(c)) return [];
        const topo = await getJson<Topology<{ p: GeometryCollection<RowProps> }>>(`polities/c${c}.json`);
        return (topojson.feature(topo, topo.objects.p) as FeatureCollection<Polygon | MultiPolygon, RowProps>).features;
      }),
    );
  }
  return centuryCache.get(c)!;
}
/** Подгрузить заранее век до и после — пока смотришь текущий */
export function prefetchAround(y: number) {
  const c = centuryOf(y);
  void loadCentury(c - 100);
  void loadCentury(c + 100);
}

/** Строки, которые действуют в этом году (без повторов: долгие строки лежат в нескольких веках) */
export function activeRows(rows: Row[], year: number): Row[] {
  return rows.filter((r) => r.properties.a <= year && year <= r.properties.b);
}

let politiesP: Promise<Polity[]> | null = null;
export const loadPolities = () =>
  (politiesP ??= import('../../../content/history/polities.json').then((m) => m.default as unknown as Polity[]));

const peoplesCache = new Map<number, Promise<FeatureCollection>>();
/** «Народы и культуры» для ближайшего года эпохи не позже выбранного */
export async function loadPeoples(year: number): Promise<FeatureCollection | null> {
  const idx = await loadIndex();
  const y = [...idx.peoples].reverse().find((p) => p <= year) ?? idx.peoples[0];
  if (y == null) return null;
  if (!peoplesCache.has(y)) {
    peoplesCache.set(
      y,
      getJson<Topology>(`peoples/${y}.json`).then((topo) => {
        const key = Object.keys(topo.objects)[0];
        return topojson.feature(topo, topo.objects[key]) as FeatureCollection;
      }),
    );
  }
  return peoplesCache.get(y)!;
}

let relP: Promise<FeatureCollection> | null = null;
export const loadRelations = () =>
  (relP ??= getJson<Topology<{ r: GeometryCollection }>>('relations.json').then(
    (topo) => topojson.feature(topo, topo.objects.r) as FeatureCollection,
  ));

// Пастельные цвета, как в видео «история мира на карте». Колонии берут цвет своей империи.
const PALETTE = ['#e3a0a8', '#9fa8e8', '#e8e07a', '#a9d98d', '#c9a3e3', '#f0b980', '#8fd3c8', '#efa3cf', '#c9c77a', '#9ecbea', '#d6b48c', '#b5e0a0', '#f2c4c4', '#a3c4f3', '#e4c86b', '#c4b5f0'];
export function colorFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 131 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// ---------- Шкала проигрывателя: каждая эпоха — равный отрезок ----------
// Древность пролетает быстро, новое время идёт медленно — как в старой версии атласа.
export const SCALE_MAX = (EPOCHS.length - 1) * 1000;
export function yearToPos(y: number): number {
  const yy = Math.max(EPOCHS[0], Math.min(MAX_YEAR, y));
  let i = 0;
  while (i < EPOCHS.length - 2 && EPOCHS[i + 1] <= yy) i++;
  const [a, b] = [EPOCHS[i], EPOCHS[i + 1]];
  return (i + (yy - a) / (b - a)) * 1000;
}
export function posToYear(pos: number): number {
  const p = Math.max(0, Math.min(SCALE_MAX, pos));
  const i = Math.min(EPOCHS.length - 2, Math.floor(p / 1000));
  const [a, b] = [EPOCHS[i], EPOCHS[i + 1]];
  const y = Math.round(a + ((p - i * 1000) / 1000) * (b - a));
  return y === 0 ? 1 : y; // нулевого года нет
}
export const epochIndex = (y: number) => {
  let i = 0;
  while (i < EPOCHS.length - 1 && EPOCHS[i + 1] <= y) i++;
  return i;
};
