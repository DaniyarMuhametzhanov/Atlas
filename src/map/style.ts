// Стиль карты MapLibre: источники данных и слои снизу вверх.
// Порядок слоёв подписей = приоритет при наложении: MapLibre расставляет верхние слои первыми,
// нижние получают только свободное место.
import type {
  ExpressionSpecification,
  FilterSpecification,
  LayerSpecification,
  Map as MlMap,
  StyleSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl';
import type { MapData } from './data';
import type { LayerId, MapMode } from '../store/store';

const BASE = import.meta.env.BASE_URL;
// MapLibre требует абсолютный адрес для шрифтов и плиток
const abs = (p: string) => new URL(BASE + p, location.href).href.replace(/%7B/g, '{').replace(/%7D/g, '}');

export const FONT = ['Noto Sans Medium'];
export const FONT_REGULAR = ['Noto Sans Regular'];

/** Цвета берём из CSS-переменных — так карта следует теме сайта */
export function themeColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return {
    sea: v('--sea'),
    paper: v('--paper'),
    ink: v('--ink'),
    muted: v('--muted'),
    line: v('--line'),
    accent: v('--accent'),
    nat: v('--nat'),
    reserve: v('--reserve'),
    wonder: v('--wonder'),
    rel: { союз: v('--rel-alliance'), дружба: v('--rel-friend'), нейтрально: v('--rel-neutral'), напряжённость: v('--rel-tension'), конфликт: v('--rel-conflict') } as Record<string, string>,
    region: { eu: v('--r-eu'), me: v('--r-me'), as: v('--r-as'), af: v('--r-af'), am: v('--r-am'), oc: v('--r-oc') } as Record<string, string>,
    regionInk: { eu: v('--k-eu'), me: v('--k-me'), as: v('--k-as'), af: v('--k-af'), am: v('--k-am'), oc: v('--k-oc') } as Record<string, string>,
    dark: document.documentElement.dataset.theme === 'dark' || (document.documentElement.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches),
  };
}
export type Colors = ReturnType<typeof themeColors>;

const regionMatch = (map: Record<string, string>, fallback: string): ExpressionSpecification => [
  'match', ['get', 'region'], 'eu', map.eu, 'me', map.me, 'as', map.as, 'af', map.af, 'am', map.am, 'oc', map.oc, fallback,
];

// Слои, которыми управляют флажки панели «Слои»
export const LAYER_GROUPS: Record<LayerId, string[]> = {
  countries: ['country-icons-big', 'country-icons-rest', 'cnames-mid', 'cnames-noicon', 'explored'],
  nature: ['nature-main', 'nature-rest', 'natureRest-cluster', 'natureRest-count'],
  reserves: ['reserves', 'reserves-cluster', 'reserves-count'],
  wonders: ['wonders'],
  capitals: ['capitals-big-dot', 'capitals-big', 'capitals-dot', 'capitals'],
  cities: ['cities-dot', 'cities'],
};
// В слое «все булавки» (zoom 6+) и «места выбранной страны» фильтр по виду места
export const KIND_BY_LAYER: Partial<Record<LayerId, string>> = { nature: 'nature', reserves: 'reserve', wonders: 'wonder' };

/** Слои, по которым можно нажать: сверху вниз */
export const INTERACTIVE = [
  'pins-selected', 'pins-z6', 'wonders', 'country-icons-big', 'country-icons-rest', 'nature-main',
  'reserves', 'reserves-cluster', 'nature-rest', 'natureRest-cluster', 'cnames-noicon', 'cnames-mid', 'capitals', 'capitals-big',
  'hit-small', 'countries-fill',
];

const pinText: ExpressionSpecification = ['step', ['zoom'], '', 3, ['get', 'name']];
const pinIcon: ExpressionSpecification = ['case', ['==', ['get', 'icon'], ''], ['concat', 'dot-', ['get', 'kind']], ['get', 'icon']];

function pinLayer(id: string, source: string, c: Colors, extra: Partial<SymbolLayerSpecification> = {}, color = c.nat): SymbolLayerSpecification {
  return {
    id,
    type: 'symbol',
    source,
    ...extra,
    layout: {
      'icon-image': pinIcon,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.36, 4, 0.46, 8, 0.56],
      'icon-padding': 1,
      'text-field': pinText,
      'text-font': FONT,
      'text-size': 11,
      'text-anchor': 'top',
      'text-offset': [0, 1.45],
      'text-max-width': 8,
      'text-optional': true,
      'text-padding': 1,
      'symbol-sort-key': ['-', 1, ['get', 'main']],
      ...(extra.layout ?? {}),
    },
    paint: { 'text-color': color, 'text-halo-color': c.paper, 'text-halo-width': 1.6, ...(extra.paint ?? {}) },
  } as SymbolLayerSpecification;
}

export function buildStyle(data: MapData, c: Colors, mode: MapMode): StyleSpecification {
  const clusterLayers = (src: string, color: string): LayerSpecification[] => [
    {
      id: `${src}-cluster`, type: 'circle', source: src, minzoom: 3, filter: ['has', 'point_count'],
      paint: { 'circle-color': color, 'circle-radius': ['step', ['get', 'point_count'], 13, 5, 16, 10, 19], 'circle-stroke-width': 2, 'circle-stroke-color': c.paper },
    },
    {
      id: `${src}-count`, type: 'symbol', source: src, minzoom: 3, filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': FONT, 'text-size': 12, 'text-allow-overlap': true },
      paint: { 'text-color': '#fff' },
    },
  ];
  const unclustered: FilterSpecification = ['!', ['has', 'point_count']];

  return {
    version: 8,
    glyphs: abs('data/glyphs/{fontstack}/{range}.pbf'),
    sources: {
      relief: { type: 'raster', tiles: [abs('data/relief/{z}/{x}/{y}.jpg')], tileSize: 256, maxzoom: 4, attribution: 'Рельеф: NASA Blue Marble' },
      borders: { type: 'geojson', data: data.borders, promoteId: 'iso', attribution: 'Границы: Natural Earth' },
      points: { type: 'geojson', data: data.points },
      capitals: { type: 'geojson', data: data.capitals, attribution: 'Города: GeoNames, русские названия: Викиданные' },
      cities: { type: 'geojson', data: data.cities },
      natureMain: { type: 'geojson', data: data.natureMain },
      natureRest: { type: 'geojson', data: data.natureRest, cluster: true, clusterMaxZoom: 3, clusterRadius: 40 },
      reserves: { type: 'geojson', data: data.reserves, cluster: true, clusterMaxZoom: 3, clusterRadius: 40 },
      wonders: { type: 'geojson', data: data.wonders },
      allPlaces: { type: 'geojson', data: data.allPlaces },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': c.sea } },
      { id: 'relief', type: 'raster', source: 'relief', layout: { visibility: mode === 'relief' ? 'visible' : 'none' }, paint: { 'raster-fade-duration': 150 } },
      { id: 'countries-fill', type: 'fill', source: 'borders', paint: fillPaint(c, mode) },
      { id: 'countries-line', type: 'line', source: 'borders', paint: linePaint(c, mode) },
      {
        id: 'countries-selected', type: 'line', source: 'borders', filter: ['==', ['get', 'iso'], ''],
        paint: { 'line-color': c.accent, 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.6, 6, 3] },
      },
      // невидимый круг вокруг мелких стран, чтобы по ним было легко попасть пальцем
      { id: 'hit-small', type: 'circle', source: 'points', filter: ['==', ['get', 'small'], 1], paint: { 'circle-radius': 12, 'circle-opacity': 0 } },

      { id: 'cities-dot', type: 'circle', source: 'cities', minzoom: 5, paint: cityDot(c, 2.5) },
      { id: 'capitals-big-dot', type: 'circle', source: 'capitals', minzoom: 1.5, maxzoom: 3, filter: ['<=', ['get', 'rank'], 30], paint: cityDot(c, 3) },
      { id: 'capitals-dot', type: 'circle', source: 'capitals', minzoom: 3, paint: cityDot(c, 3.5) },
      {
        id: 'cities', type: 'symbol', source: 'cities', minzoom: 5,
        layout: { 'text-field': ['get', 'name'], 'text-font': FONT_REGULAR, 'text-size': 11, 'text-anchor': 'left', 'text-offset': [0.6, 0], 'symbol-sort-key': ['-', ['get', 'pop']] },
        paint: { 'text-color': c.ink, 'text-halo-color': c.paper, 'text-halo-width': 1.4 },
      },
      capitalLabel('capitals-big', c, { minzoom: 1.5, maxzoom: 3, filter: ['<=', ['get', 'rank'], 30] }),
      capitalLabel('capitals', c, { minzoom: 3 }),

      // 6 — названия стран без значка; средние страны на мелком масштабе — только названием
      countryName('cnames-noicon', c, { minzoom: 1.5, filter: ['==', ['get', 'icon'], ''] }),
      countryName('cnames-mid', c, { maxzoom: 1.5, filter: ['all', ['!=', ['get', 'icon'], ''], ['>', ['get', 'rank'], 40], ['<=', ['get', 'rank'], 100]] }),
      // 5 — остальная природа (кружки с числом при zoom < 4)
      ...clusterLayers('natureRest', c.nat),
      pinLayer('nature-rest', 'natureRest', c, { minzoom: 3, maxzoom: 6, filter: unclustered }),
      // 4 — заповедники
      ...clusterLayers('reserves', c.reserve),
      pinLayer('reserves', 'reserves', c, { minzoom: 3, maxzoom: 6, filter: unclustered }, c.reserve),
      // 3 — главные природные места
      pinLayer('nature-main', 'natureMain', c, { minzoom: 1.5, maxzoom: 6 }),
      // 2 — значки стран: крупные сразу, остальные с zoom 1.5
      countryIcons('country-icons-rest', c, { minzoom: 1.5, filter: ['all', ['!=', ['get', 'icon'], ''], ['>', ['get', 'rank'], 40]] }),
      countryIcons('country-icons-big', c, { filter: ['all', ['!=', ['get', 'icon'], ''], ['<=', ['get', 'rank'], 40]] }),
      // «Исследователь»: зелёная галочка в правом верхнем углу значка изученной страны (список — фильтром)
      {
        id: 'explored', type: 'symbol', source: 'points', filter: ['in', ['get', 'iso'], ['literal', []]],
        layout: {
          'icon-image': 'explored-check',
          'icon-offset': ['interpolate', ['linear'], ['zoom'], 0, ['literal', [11, -11]], 3, ['literal', [16, -16]], 6, ['literal', [20, -20]]],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      },
      // 1 — чудеса света
      pinLayer('wonders', 'wonders', c, { maxzoom: 6, layout: { 'icon-size': ['interpolate', ['linear'], ['zoom'], 0, 0.42, 4, 0.52, 8, 0.6], 'symbol-sort-key': 0 } }, c.wonder),
      // zoom 6+: «никто не пропадает» — все булавки видны, подписи по возможности
      pinLayer('pins-z6', 'allPlaces', c, {
        minzoom: 6,
        layout: { 'icon-allow-overlap': true, 'icon-ignore-placement': false },
        paint: { 'text-color': ['match', ['get', 'kind'], 'wonder', c.wonder, 'reserve', c.reserve, c.nat] },
      }),
      // 0 — места выбранной страны: всегда поверх
      pinLayer('pins-selected', 'allPlaces', c, {
        filter: ['==', ['get', 'country'], ''],
        layout: { 'icon-allow-overlap': true, 'text-field': ['step', ['zoom'], '', 2.5, ['get', 'name']] },
        paint: { 'text-color': ['match', ['get', 'kind'], 'wonder', c.wonder, 'reserve', c.reserve, c.nat] },
      }),
    ],
  };
}

function fillPaint(c: Colors, mode: MapMode) {
  const hover = ['boolean', ['feature-state', 'hover'], false] as ExpressionSpecification;
  // режим «Отношения»: у страны есть состояние rel (статус) или center (выбранная страна)
  const rel = ['feature-state', 'rel'] as ExpressionSpecification;
  const hasRel = ['!=', ['coalesce', rel, ''], ''] as ExpressionSpecification;
  const center = ['boolean', ['feature-state', 'center'], false] as ExpressionSpecification;
  const relColor = ['match', ['coalesce', rel, ''], 'союз', c.rel['союз'], 'дружба', c.rel['дружба'], 'нейтрально', c.rel['нейтрально'], 'напряжённость', c.rel['напряжённость'], 'конфликт', c.rel['конфликт'], '#000000'] as ExpressionSpecification;
  const base = mode === 'relief' ? '#ffffff' : regionMatch(c.region, c.dark ? '#2a313c' : '#e6e1d6');
  return {
    'fill-color': ['case', center, c.paper, hasRel, relColor, base] as ExpressionSpecification,
    'fill-opacity': (mode === 'relief'
      ? ['case', center, 0.75, hasRel, 0.7, hover, 0.16, 0]
      : ['case', center, 0.9, hasRel, 0.9, hover, 0.75, 1]) as ExpressionSpecification,
  };
}
function linePaint(c: Colors, mode: MapMode) {
  return {
    'line-color': mode === 'relief' ? '#ffffff' : c.paper,
    'line-opacity': mode === 'relief' ? 0.45 : 0.9,
    'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 6, 1.2] as ExpressionSpecification,
  };
}
function cityDot(c: Colors, r: number) {
  return { 'circle-radius': r, 'circle-color': c.paper, 'circle-stroke-color': c.ink, 'circle-stroke-width': 1.3 };
}
function capitalLabel(id: string, c: Colors, extra: Partial<SymbolLayerSpecification>): SymbolLayerSpecification {
  return {
    id, type: 'symbol', source: 'capitals', ...extra,
    layout: { 'text-field': ['get', 'name'], 'text-font': FONT_REGULAR, 'text-size': 11, 'text-anchor': 'left', 'text-offset': [0.6, 0], 'text-optional': true, 'symbol-sort-key': ['get', 'rank'] },
    paint: { 'text-color': c.ink, 'text-halo-color': c.paper, 'text-halo-width': 1.4 },
  } as SymbolLayerSpecification;
}
function countryName(id: string, c: Colors, extra: Partial<SymbolLayerSpecification>): SymbolLayerSpecification {
  return {
    id, type: 'symbol', source: 'points', ...extra,
    layout: { 'text-field': ['get', 'name'], 'text-font': FONT, 'text-size': ['interpolate', ['linear'], ['zoom'], 0, 9.5, 4, 12], 'text-max-width': 7, 'symbol-sort-key': ['get', 'rank'] },
    paint: { 'text-color': regionMatch(c.regionInk, c.ink), 'text-halo-color': c.paper, 'text-halo-width': 1.6 },
  } as SymbolLayerSpecification;
}
function countryIcons(id: string, c: Colors, extra: Partial<SymbolLayerSpecification>): SymbolLayerSpecification {
  return {
    id, type: 'symbol', source: 'points', ...extra,
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 0, 0.36, 3, 0.5, 6, 0.62],
      'icon-padding': 1,
      'text-field': ['step', ['zoom'], '', 1.5, ['get', 'name']],
      'text-font': FONT,
      'text-size': ['interpolate', ['linear'], ['zoom'], 1.5, 10, 5, 13],
      'text-anchor': 'top',
      'text-offset': [0, 1.55],
      'text-max-width': 7,
      'text-optional': true,
      'symbol-sort-key': ['get', 'rank'],
    },
    paint: { 'text-color': regionMatch(c.regionInk, c.ink), 'text-halo-color': c.paper, 'text-halo-width': 1.6 },
  } as SymbolLayerSpecification;
}

/** Перекрасить карту при смене темы или режима «Рельеф / Регионы» без пересоздания */
export function applyTheme(map: MlMap, c: Colors, mode: MapMode) {
  map.setPaintProperty('bg', 'background-color', c.sea);
  map.setLayoutProperty('relief', 'visibility', mode === 'relief' ? 'visible' : 'none');
  for (const [k, v] of Object.entries(fillPaint(c, mode))) map.setPaintProperty('countries-fill', k, v);
  for (const [k, v] of Object.entries(linePaint(c, mode))) map.setPaintProperty('countries-line', k, v);
  map.setPaintProperty('countries-selected', 'line-color', c.accent);
  for (const l of map.getStyle().layers) {
    if (l.type === 'symbol' && l.id !== 'natureRest-count' && l.id !== 'reserves-count') map.setPaintProperty(l.id, 'text-halo-color', c.paper);
  }
  for (const id of ['cities', 'capitals', 'capitals-big']) map.setPaintProperty(id, 'text-color', c.ink);
  for (const id of ['cities-dot', 'capitals-dot', 'capitals-big-dot']) {
    map.setPaintProperty(id, 'circle-color', c.paper);
    map.setPaintProperty(id, 'circle-stroke-color', c.ink);
  }
  for (const id of ['country-icons-big', 'country-icons-rest', 'cnames-mid', 'cnames-noicon']) map.setPaintProperty(id, 'text-color', regionMatch(c.regionInk, c.ink));
  for (const id of ['nature-main', 'nature-rest']) map.setPaintProperty(id, 'text-color', c.nat);
  map.setPaintProperty('reserves', 'text-color', c.reserve);
  map.setPaintProperty('wonders', 'text-color', c.wonder);
  for (const id of ['pins-z6', 'pins-selected']) map.setPaintProperty(id, 'text-color', ['match', ['get', 'kind'], 'wonder', c.wonder, 'reserve', c.reserve, c.nat]);
  map.setPaintProperty('natureRest-cluster', 'circle-color', c.nat);
  map.setPaintProperty('reserves-cluster', 'circle-color', c.reserve);
  for (const id of ['natureRest-cluster', 'reserves-cluster']) map.setPaintProperty(id, 'circle-stroke-color', c.paper);
}
