// Что можно найти: страны, столицы и города, природа, заповедники, чудеса света, исторические государства.
// Список стран есть сразу; остальное догружается при первом открытии поиска.
import type { FeatureCollection, Point } from 'geojson';
import { COUNTRIES, COUNTRY_BY_ID } from '../content';
import { loadPlaces } from '../content/places';
import { loadPolities, type Polity } from '../map/time/data';
import { getJson } from '../map/data';
import { formatYear } from '../lib/years';
import { bestScore, normalize, switchLayout } from './fuzzy';

export type SearchKind = 'country' | 'capital' | 'city' | 'wonder' | 'nature' | 'reserve' | 'polity';

export type SearchItem = {
  kind: SearchKind;
  key: string;
  title: string;
  /** вторая строка подсказки: страна, годы */
  sub: string;
  /** названия после normalize: русское, английское */
  names: string[];
  /** небольшая прибавка к оценке для известных мест (0…0,05), чтобы Париж шёл раньше тёзок */
  bonus: number;
  iso?: string;
  lon?: number;
  lat?: number;
  placeId?: string;
  polity?: Polity;
};

export type SearchGroup = { id: GroupId; title: string; icon: string; items: SearchItem[] };
type GroupId = 'countries' | 'cities' | 'places' | 'history';

const GROUP_OF: Record<SearchKind, GroupId> = {
  country: 'countries',
  capital: 'cities',
  city: 'cities',
  wonder: 'places',
  nature: 'places',
  reserve: 'places',
  polity: 'history',
};
const GROUPS: Record<GroupId, { title: string; icon: string; max: number }> = {
  countries: { title: 'Страны', icon: '🏳️', max: 4 },
  cities: { title: 'Столицы и города', icon: '🏙️', max: 4 },
  places: { title: 'Природа и достопримечательности', icon: '🏞️', max: 5 },
  history: { title: 'Исторические государства', icon: '🏛️', max: 5 },
};
/** Значок у каждой подсказки */
export const KIND_ICON: Record<SearchKind, string> = {
  country: '🏳️',
  capital: '⭐',
  city: '🏙️',
  wonder: '★',
  nature: '🏞️',
  reserve: '🌿',
  polity: '🏛️',
};
/** Небольшой вес по типу: при равном совпадении страна важнее одноимённого города */
const KIND_WEIGHT: Record<SearchKind, number> = {
  country: 0.04,
  capital: 0.03,
  wonder: 0.025,
  nature: 0.02,
  reserve: 0.015,
  city: 0.01,
  polity: 0,
};

const names = (...list: (string | undefined)[]) =>
  [...new Set(list.filter(Boolean).map((s) => normalize(s!)))].filter(Boolean);
const countryName = (iso?: string) => (iso ? (COUNTRY_BY_ID.get(iso)?.name ?? '') : '');
export const yearsOf = (p: Polity) => (p.span ? `${formatYear(p.span[0])} — ${formatYear(p.span[1])}` : '');

export function countryItems(): SearchItem[] {
  return COUNTRIES.map((c) => ({
    kind: 'country',
    key: `c:${c.id}`,
    title: c.name,
    sub: c.capital && c.capital !== '—' ? `столица — ${c.capital}` : '',
    names: names(c.name, c.nameEn),
    bonus: 0,
    iso: c.id,
  }));
}

type CityProps = { name: string; en: string; iso?: string; pop?: number };

/** Исторические государства: без «связей» (союзов, вассалитета); у объединений убираем скобки */
const MODERN = new Set(COUNTRIES.map((c) => c.name));

export function polityItems(polities: Polity[]): SearchItem[] {
  // одно и то же государство бывает и отдельной строкой, и объединением с тем же русским названием — оставляем крупнее
  const best = new Map<string, Polity>();
  for (const p of polities) {
    if (p.kind === 'relation' || !p.span) continue;
    // современная страна уже есть в группе «Страны»
    if (p.span[1] >= 1990 && MODERN.has(p.ru)) continue;
    const k = `${p.ru}|${p.span[0]}`;
    const was = best.get(k);
    if (!was || p.area > was.area) best.set(k, p);
  }
  return [...best.values()].map((p) => ({
    kind: 'polity',
    key: `p:${p.i}`,
    title: p.ru,
    sub: yearsOf(p),
    names: names(p.ru, p.en.replace(/^\((.*)\)$/, '$1')),
    // большие и долгие державы вперёд
    bonus: Math.min(0.03, Math.log10(1 + p.area) / 250),
    polity: p,
  }));
}

let full: Promise<SearchItem[]> | null = null;
/** Полный список (города, места, история); грузится один раз */
export function loadSearchItems(): Promise<SearchItem[]> {
  full ??= Promise.all([
    getJson<Cities>('capitals.json'),
    getJson<Cities>('cities.json'),
    loadPlaces(),
    loadPolities(),
  ]).then(([capitals, cities, places, polities]) => buildItems(capitals, cities, places, polities));
  return full;
}

type Places = Awaited<ReturnType<typeof loadPlaces>>;
type Cities = FeatureCollection<Point, CityProps>;
export function buildItems(
  capitals: Cities,
  cities: Cities,
  places: Pick<Places, 'nature' | 'reserves' | 'wonders'>,
  polities: Polity[],
): SearchItem[] {
  const city = (f: (typeof cities.features)[number], kind: 'capital' | 'city', i: number): SearchItem => ({
    kind,
    key: `${kind}:${f.properties.iso ?? ''}:${i}`,
    title: f.properties.name,
    sub: kind === 'capital' ? `столица, ${countryName(f.properties.iso)}` : countryName(f.properties.iso),
    names: names(f.properties.name, f.properties.en),
    bonus: kind === 'city' ? Math.min(0.02, Math.log10(f.properties.pop ?? 1) / 400) : 0,
    iso: f.properties.iso,
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
  });
  const place =
    (kind: 'wonder' | 'nature' | 'reserve') =>
    (p: (typeof places.nature)[number]): SearchItem => ({
      kind,
      key: `pl:${p.id}`,
      title: p.name,
      sub: countryName(p.country),
      names: names(p.name),
      bonus: p.main ? 0.01 : 0,
      iso: p.country,
      lon: p.lon,
      lat: p.lat,
      placeId: p.id,
    });
  return [
    ...countryItems(),
    ...capitals.features.map((f, i) => city(f, 'capital', i)),
    ...cities.features.map((f, i) => city(f, 'city', i)),
    ...places.wonders.map(place('wonder')),
    ...places.nature.map(place('nature')),
    ...places.reserves.map(place('reserve')),
    ...polityItems(polities),
  ];
}

/** Оценка записи: лучшее из «как набрано» и «в другой раскладке» (чуть ниже) */
export function scoreItem(item: SearchItem, q: string, swapped: string | null): number {
  let s = bestScore(q, item.names);
  if (swapped) s = Math.max(s, bestScore(swapped, item.names) * 0.98);
  return s ? s + item.bonus + KIND_WEIGHT[item.kind] : 0;
}

/** Подсказки по группам. Группы идут в порядке лучшего совпадения в них. */
export function search(items: SearchItem[], query: string): SearchGroup[] {
  const q = normalize(query);
  if (!q) return [];
  const sw = switchLayout(query);
  const swapped = sw ? normalize(sw) : null;
  const scored = items
    .map((item) => ({ item, s: scoreItem(item, q, swapped) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.item.title.localeCompare(b.item.title, 'ru'));
  // совпадения с опечатками показываем, только если нет хороших
  const top = scored[0]?.s ?? 0;
  const keep = scored.filter((x) => x.s >= Math.min(0.5, top - 0.35));
  const byGroup = new Map<GroupId, SearchItem[]>();
  const seen = new Set<string>();
  for (const { item } of keep) {
    const g = GROUP_OF[item.kind];
    // столица и одноимённый город-миллионник — одна подсказка
    const dupe = `${g}|${item.title}|${item.iso ?? ''}`;
    if (seen.has(dupe)) continue;
    seen.add(dupe);
    const list = byGroup.get(g) ?? [];
    if (list.length < GROUPS[g].max) list.push(item);
    byGroup.set(g, list);
  }
  return [...byGroup.entries()].map(([id, list]) => ({ id, ...GROUPS[id], items: list }));
}
