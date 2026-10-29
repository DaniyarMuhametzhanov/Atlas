// Слои машины времени на карте MapLibre.
//   • Плавная смена границ: два источника по очереди — новое состояние проявляется, старое растворяется (~300 мс).
//   • Подсветка изменений: если государство сильно выросло или уменьшилось (больше 20% площади), появилось или исчезло
//     (крупное), — мигает его контур и всплывает подпись «1991 — распад СССР».
//   • «История одной страны»: только государства, которые лежали на территории выбранной современной страны.
//   • «Народы и культуры» (historical-basemaps) — бледный слой под государствами; «Связи» — пунктир союзов и вассалитета.
import type { ExpressionSpecification, GeoJSONSource, Map as MlMap, MapGeoJSONFeature, MapMouseEvent } from 'maplibre-gl';
import type { Feature, FeatureCollection } from 'geojson';
import { activeRows, centuryOf, colorFor, loadCentury, loadPeoples, loadRelations, prefetchAround, type Polity, type Row } from './data';
import { transitionLabel } from './transitions';
import { FONT } from '../style';

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
const NONE: ExpressionSpecification = ['==', ['get', 'a'], 99999];
/** Не чаще одного обновления карты за это время (мс) при быстрой смене лет */
const MIN_DRAW_MS = 90;
const FILL = { relief: 0.62, regions: 0.85 };
// Слои современной карты, которые в машине времени прячем
export const MODERN_LAYERS = [
  'countries-fill', 'countries-selected', 'hit-small', 'cities-dot', 'capitals-big-dot', 'capitals-dot', 'cities', 'capitals-big', 'capitals',
  'cnames-noicon', 'cnames-mid', 'natureRest-cluster', 'natureRest-count', 'nature-rest', 'reserves-cluster', 'reserves-count', 'reserves',
  'nature-main', 'country-icons-rest', 'country-icons-big', 'explored', 'wonders', 'pins-z6', 'pins-selected',
];
const TIME_LAYERS = ['t-land', 't-peoples', 't-peoples-label', 't-a-fill', 't-a-line', 't-b-fill', 't-b-line', 't-links', 't-sel', 't-flash', 't-labels'];

export type TimeEvents = {
  onToast: (text: string) => void;
  onSelect: (polity: Polity | null) => void;
  onActive: (rows: Row[]) => void;
};

export class TimeLayers {
  private on = false;
  private front: 'a' | 'b' = 'a';
  private key = '';
  private year = 0;
  private rows: Row[] = [];
  private prevAreas = new Map<number, number>();
  private prevYear: number | null = null;
  private selected: number | null = null;
  private historyOf: string | null = null;
  private peoples = true;
  private links = false;
  private mode: 'relief' | 'regions' = 'relief';
  private seq = 0;
  private flashTimer = 0;
  private century: number | null = null;
  private lastDraw = 0;
  private drawTimer = 0;
  private prevRows: Row[] = [];

  constructor(
    private map: MlMap,
    private polities: Polity[],
    private tip: HTMLElement,
    private ev: TimeEvents,
  ) {}

  private name(i: number) {
    const p = this.polities[i];
    return p ? p.ru || p.en : '';
  }
  private reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ---------- включение / выключение ----------
  enable(mode: 'relief' | 'regions', dark: boolean) {
    if (this.on) return;
    this.on = true;
    this.mode = mode;
    const m = this.map;
    for (const id of MODERN_LAYERS) if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', 'none');
    m.setPaintProperty('countries-line', 'line-opacity', 0.18);
    // все государства века — в одном источнике; год выбирается фильтром (данные не пересылаются при каждой смене года)
    for (const id of ['t-poly', 't-labels', 't-sel', 't-flash', 't-peoples', 't-links']) if (!m.getSource(id)) m.addSource(id, { type: 'geojson', data: EMPTY });
    const fade = { duration: this.reduced() ? 0 : 300, delay: 0 };
    const ink = dark ? '#ffffff' : '#5a1010';
    const halo = dark ? '#3a0a0a' : '#ffffff';
    const before = m.getLayer('cities-dot') ? 'cities-dot' : undefined;
    m.addLayer({ id: 't-land', type: 'fill', source: 'borders', paint: { 'fill-color': dark ? '#2a313c' : '#f6f2e8', 'fill-opacity': mode === 'regions' ? 1 : 0 } }, before);
    m.addLayer({ id: 't-peoples', type: 'fill', source: 't-peoples', layout: { visibility: this.peoples ? 'visible' : 'none' }, paint: { 'fill-color': dark ? '#6d6450' : '#cdbf9f', 'fill-opacity': 0.35, 'fill-outline-color': dark ? '#8a8068' : '#b3a37f' } }, before);
    for (const s of ['a', 'b'] as const) {
      m.addLayer({ id: `t-${s}-fill`, type: 'fill', source: 't-poly', filter: NONE, paint: { 'fill-color': ['get', 'col'], 'fill-opacity': 0, 'fill-opacity-transition': fade } }, before);
      m.addLayer({ id: `t-${s}-line`, type: 'line', source: 't-poly', filter: NONE, paint: { 'line-color': '#ffffff', 'line-width': 0.6, 'line-opacity': 0, 'line-opacity-transition': fade } }, before);
    }
    m.addLayer({
      id: 't-links', type: 'line', source: 't-links', layout: { visibility: this.links ? 'visible' : 'none' },
      paint: {
        'line-color': ['match', ['get', 'kind'], 'alliance', '#2a78d6', 'union', '#6250d6', 'vassal', '#e34948', '#eb6834'] as ExpressionSpecification,
        'line-width': 2, 'line-dasharray': [2, 1.5],
      },
    }, before);
    m.addLayer({ id: 't-sel', type: 'line', source: 't-sel', paint: { 'line-color': dark ? '#ffd166' : '#7a1010', 'line-width': 2.4 } }, before);
    m.addLayer({ id: 't-flash', type: 'line', source: 't-flash', paint: { 'line-color': '#ffe100', 'line-width': 4, 'line-opacity': 0, 'line-opacity-transition': { duration: 1400, delay: 0 } } }, before);
    m.addLayer({
      id: 't-peoples-label', type: 'symbol', source: 't-peoples', minzoom: 2.2, layout: {
        visibility: this.peoples ? 'visible' : 'none', 'text-field': ['get', 'NAME'], 'text-font': ['Noto Sans Italic'], 'text-size': 10.5, 'text-max-width': 7,
      },
      paint: { 'text-color': dark ? '#d8ccb0' : '#6b5d40', 'text-halo-color': halo, 'text-halo-width': 1.2 },
    }, before);
    m.addLayer({
      id: 't-labels', type: 'symbol', source: 't-labels', filter: NONE, layout: {
        'text-field': ['get', 'name'],
        'text-font': ['case', ['==', ['get', 'k'], 1], ['literal', ['Noto Sans Italic']], ['literal', FONT]] as ExpressionSpecification,
        'text-size': ['interpolate', ['linear'], ['get', 'ar'], 0, 10, 300000, 11.5, 2000000, 14, 10000000, 17] as ExpressionSpecification,
        'text-max-width': 8,
        'symbol-sort-key': ['-', ['get', 'ar']] as ExpressionSpecification,
        'text-padding': 2,
      },
      paint: { 'text-color': ink, 'text-halo-color': halo, 'text-halo-width': 1.8 },
    }, before);
    m.on('mousemove', this.onMove);
    m.on('click', this.onClick);
    this.key = '';
  }

  disable() {
    if (!this.on) return;
    this.on = false;
    const m = this.map;
    m.off('mousemove', this.onMove);
    m.off('click', this.onClick);
    for (const id of TIME_LAYERS) if (m.getLayer(id)) m.removeLayer(id);
    for (const id of ['t-poly', 't-labels', 't-sel', 't-flash', 't-peoples', 't-links']) if (m.getSource(id)) m.removeSource(id);
    this.century = null;
    m.setPaintProperty('countries-line', 'line-opacity', this.mode === 'relief' ? 0.45 : 0.9);
    this.tip.style.opacity = '0';
    this.prevYear = null;
    this.prevAreas.clear();
    clearTimeout(this.drawTimer);
  }

  /** Тема поменялась: applyTheme перекрасил обычную карту — возвращаем вид машины времени */
  refreshTheme(mode: 'relief' | 'regions', dark: boolean) {
    if (!this.on) return;
    const m = this.map;
    this.mode = mode;
    m.setPaintProperty('countries-line', 'line-opacity', 0.18);
    m.setPaintProperty('t-land', 'fill-color', dark ? '#2a313c' : '#f6f2e8');
    m.setPaintProperty('t-labels', 'text-color', dark ? '#ffffff' : '#5a1010');
    for (const id of ['t-labels', 't-peoples-label']) m.setPaintProperty(id, 'text-halo-color', dark ? '#3a0a0a' : '#ffffff');
    m.setPaintProperty('t-peoples', 'fill-color', dark ? '#6d6450' : '#cdbf9f');
    m.setPaintProperty('t-sel', 'line-color', dark ? '#ffd166' : '#7a1010');
    this.setMode(mode);
  }

  setMode(mode: 'relief' | 'regions') {
    this.mode = mode;
    if (!this.on) return;
    this.map.setPaintProperty('t-land', 'fill-opacity', mode === 'regions' ? 1 : 0);
    this.map.setPaintProperty(`t-${this.front}-fill`, 'fill-opacity', FILL[mode]);
  }

  // ---------- год ----------
  async setYear(year: number) {
    this.year = year;
    if (!this.on) return;
    const my = ++this.seq;
    const c = centuryOf(year);
    const all = await loadCentury(c);
    prefetchAround(year);
    if (my !== this.seq || !this.on) return; // пока грузилось, год сменился
    if (this.century !== c) this.loadCenturyData(c, all);
    const rows = activeRows(all, year);
    const key = rows.map((r) => `${r.properties.i}:${r.properties.a}`).join(',') + '|' + this.historyOf;
    this.rows = rows;
    if (this.links) this.map.setFilter('t-links', ['all', ['<=', ['get', 'a'], year], ['>=', ['get', 'b'], year]]);
    if (this.peoples) void this.updatePeoples(year);
    if (key === this.key) return;
    // при быстрой смене лет обновляем карту не чаще MIN_DRAW_MS — последнее состояние дорисуется
    clearTimeout(this.drawTimer);
    const wait = MIN_DRAW_MS - (performance.now() - this.lastDraw);
    if (wait > 0) {
      this.drawTimer = window.setTimeout(() => void this.setYear(this.year), wait);
      return;
    }
    this.key = key;
    this.lastDraw = performance.now();
    this.draw(rows, year);
  }

  /** Новый век: все его государства и подписи — в источники карты (один раз на век) */
  private loadCenturyData(c: number, all: Row[]) {
    this.century = c;
    const seen = new Set<string>();
    const polys: Feature[] = [];
    const labels: Feature[] = [];
    for (const r of all) {
      const p = r.properties;
      const id = `${p.i}:${p.a}`;
      if (seen.has(id)) continue;
      seen.add(id);
      if (p.k === 0) {
        polys.push({ type: 'Feature', properties: { i: p.i, a: p.a, b: p.b, t: p.t, col: colorFor(this.polities[p.g >= 0 ? p.g : p.i]?.en ?? '') }, geometry: r.geometry });
      }
      labels.push({ type: 'Feature', properties: { i: p.i, a: p.a, b: p.b, t: p.t, k: p.k, ar: p.ar, name: this.name(p.i) }, geometry: { type: 'Point', coordinates: [p.lx, p.ly] } });
    }
    (this.map.getSource('t-poly') as GeoJSONSource).setData({ type: 'FeatureCollection', features: polys });
    (this.map.getSource('t-labels') as GeoJSONSource).setData({ type: 'FeatureCollection', features: labels });
  }

  /** Фильтр «действует в этом году» (+ «на территории выбранной страны») */
  private yearFilter(year: number): ExpressionSpecification {
    const f: ExpressionSpecification[] = [['<=', ['get', 'a'], year], ['>=', ['get', 'b'], year]];
    if (this.historyOf) f.push(['in', this.historyOf, ['get', 't']]);
    return ['all', ...f];
  }

  private draw(rows: Row[], year: number) {
    const m = this.map;
    const shown = this.historyOf ? rows.filter((r) => r.properties.t.split(' ').includes(this.historyOf!)) : rows;
    const polys = shown.filter((r) => r.properties.k === 0);
    const back = this.front === 'a' ? 'b' : 'a';
    const filter = this.yearFilter(year);
    m.setFilter(`t-${back}-fill`, filter);
    m.setFilter(`t-${back}-line`, filter);
    m.setFilter('t-labels', filter);
    m.setPaintProperty(`t-${back}-fill`, 'fill-opacity', FILL[this.mode]);
    m.setPaintProperty(`t-${back}-line`, 'line-opacity', 0.8);
    m.setPaintProperty(`t-${this.front}-fill`, 'fill-opacity', 0);
    m.setPaintProperty(`t-${this.front}-line`, 'line-opacity', 0);
    this.front = back;
    this.drawSelected();
    this.detectChange(polys, year);
    this.prevRows = polys;
    this.ev.onActive(rows);
  }

  /** Сравниваем с предыдущим годом: крупные появления, исчезновения и изменения площади больше 20% */
  private detectChange(polys: Row[], year: number) {
    const areas = new Map<number, number>();
    for (const r of polys) areas.set(r.properties.i, (areas.get(r.properties.i) ?? 0) + r.properties.ar);
    const prev = this.prevAreas;
    const py = this.prevYear;
    this.prevAreas = areas;
    this.prevYear = year;
    if (py == null || Math.abs(year - py) > 150 || this.historyOf) return;
    const BIG = 1_000_000;
    type Change = { i: number; kind: 'appear' | 'vanish' | 'grow' | 'shrink'; delta: number };
    const changes: Change[] = [];
    for (const [i, ar] of areas) {
      const was = prev.get(i);
      if (was == null) {
        if (ar >= BIG) changes.push({ i, kind: 'appear', delta: ar });
      } else if (Math.max(ar, was) >= BIG && Math.abs(ar - was) / was > 0.2) changes.push({ i, kind: ar > was ? 'grow' : 'shrink', delta: Math.abs(ar - was) });
    }
    for (const [i, was] of prev) if (!areas.has(i) && was >= BIG) changes.push({ i, kind: 'vanish', delta: was });
    if (!changes.length) return;
    const b = changes.reduce((x, y) => (y.delta > x.delta ? y : x));
    const p = this.polities[b.i];
    if (!p) return;
    this.ev.onToast(`${year < 0 ? `${-year} до н.э.` : year} — ${transitionLabel(p, b.kind)}`);
    if (this.reduced()) return;
    // мигает контур: для исчезнувшего — последний известный контур (из предыдущего источника)
    const src = (b.kind === 'vanish' ? this.prevRows : polys).filter((r) => r.properties.i === b.i);
    (this.map.getSource('t-flash') as GeoJSONSource).setData({ type: 'FeatureCollection', features: src.map((f) => ({ type: 'Feature', properties: {}, geometry: f.geometry })) as Feature[] });
    clearTimeout(this.flashTimer);
    this.map.setPaintProperty('t-flash', 'line-opacity-transition', { duration: 0, delay: 0 });
    this.map.setPaintProperty('t-flash', 'line-opacity', 1);
    this.flashTimer = window.setTimeout(() => {
      if (!this.on) return;
      this.map.setPaintProperty('t-flash', 'line-opacity-transition', { duration: 1400, delay: 0 });
      this.map.setPaintProperty('t-flash', 'line-opacity', 0);
    }, 120);
  }

  // ---------- выбранное государство ----------
  select(i: number | null) {
    this.selected = i;
    if (this.on) this.drawSelected();
  }
  private drawSelected() {
    const feats = this.selected == null ? [] : this.rows.filter((r) => r.properties.i === this.selected && r.properties.k === 0);
    (this.map.getSource('t-sel') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: feats.map((r) => ({ type: 'Feature', properties: {}, geometry: r.geometry })) });
  }

  // ---------- «История одной страны» ----------
  setHistoryOf(iso: string | null) {
    this.historyOf = iso;
    if (!this.on) return;
    this.key = '';
    void this.setYear(this.year);
  }

  // ---------- «Народы и культуры» и «Связи» ----------
  setPeoples(on: boolean) {
    this.peoples = on;
    if (!this.on) return;
    for (const id of ['t-peoples', 't-peoples-label']) this.map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    if (on) void this.updatePeoples(this.year);
  }
  private peoplesYear: FeatureCollection | null = null;
  private async updatePeoples(year: number) {
    const fc = await loadPeoples(year);
    if (!this.on || !fc || fc === this.peoplesYear) return;
    this.peoplesYear = fc;
    (this.map.getSource('t-peoples') as GeoJSONSource).setData(fc);
  }
  async setLinks(on: boolean) {
    this.links = on;
    if (!this.on) return;
    this.map.setLayoutProperty('t-links', 'visibility', on ? 'visible' : 'none');
    if (!on) return;
    const fc = await loadRelations();
    if (!this.on) return;
    (this.map.getSource('t-links') as GeoJSONSource).setData(fc);
    this.map.setFilter('t-links', ['all', ['<=', ['get', 'a'], this.year], ['>=', ['get', 'b'], this.year]]);
  }

  // ---------- наведение и нажатие ----------
  private pick(e: MapMouseEvent): MapGeoJSONFeature | undefined {
    const layers = ['t-labels', `t-${this.front}-fill`, ...(this.links ? ['t-links'] : []), ...(this.peoples ? ['t-peoples'] : [])].filter((l) => this.map.getLayer(l));
    return this.map.queryRenderedFeatures(e.point, { layers })[0];
  }
  private onMove = (e: MapMouseEvent) => {
    const f = this.pick(e);
    this.map.getCanvas().style.cursor = f && f.properties.i != null ? 'pointer' : '';
    if (!f) {
      this.tip.style.opacity = '0';
      return;
    }
    const p = f.properties as Record<string, string | number>;
    const text = p.i != null ? this.name(Number(p.i)) : p.NAME ? `${p.NAME} (народ / культура)` : '';
    if (!text) return;
    this.tip.textContent = text;
    this.tip.style.transform = `translate(${e.point.x + 14}px, ${e.point.y + 14}px)`;
    this.tip.style.opacity = '1';
  };
  private onClick = (e: MapMouseEvent) => {
    const f = this.pick(e);
    const i = f?.properties.i;
    this.ev.onSelect(i != null ? (this.polities[Number(i)] ?? null) : null);
  };
}
