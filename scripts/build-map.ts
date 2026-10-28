// Готовит данные для карты MapLibre:
//   • границы стран Natural Earth 50m и 10m (TopoJSON) с кодами ISO и русскими названиями;
//   • точки значков стран в «полюсе недоступности» (точка внутри страны, дальше всего от границ);
//   • соседей каждой страны (по общим границам);
//   • столицы и крупные города (GeoNames);
//   • круглые значки для булавок;
//   • плитки рельефа Blue Marble в проекции Меркатора (zoom 0–4).
//
// Запуск: npm run build:map  (после npm run extract)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import polylabel from 'polylabel';
import { geoArea, geoBounds, geoNaturalEarth1 } from 'd3-geo';
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson';
import type { CountryIndexItem } from '../src/content/index.ts';
import type { MapPlace } from '../src/content/schema.ts';

const require = createRequire(import.meta.url);
const isoLib = require('i18n-iso-countries');
isoLib.registerLocale(require('i18n-iso-countries/langs/ru.json'));
const cities = require('all-the-cities') as {
  name: string; country: string; featureCode: string; population: number; loc: { coordinates: [number, number] };
}[];

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public/data/map');
const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const writeJson = (p: string, v: unknown) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v));
};
fs.rmSync(OUT, { recursive: true, force: true });
fs.rmSync(path.join(ROOT, 'public/img/badges'), { recursive: true, force: true });
fs.rmSync(path.join(ROOT, 'public/data/relief'), { recursive: true, force: true });

const index = readJson<CountryIndexItem[]>('content/countries-index.json');
const byIso = new Map(index.map((c) => [c.id, c]));
const legacyKeys = readJson<Record<string, string>>('content/legacy-keys.json');

// У этих территорий нет кода ISO — даём свои из диапазона X**
const EXTRA: Record<string, { iso: string; ru: string }> = {
  'Indian Ocean Ter.': { iso: 'XIO', ru: 'Австралийские территории в Индийском океане' },
  'Siachen Glacier': { iso: 'XSG', ru: 'Ледник Сиачен' },
};

// ---------- 1. Границы: коды ISO и русские названия ----------
type Props = { iso: string; name: string; region: string; has: 0 | 1 };
function prepareTopology(file: string) {
  const topo = structuredClone(require(file)) as Topology<{ countries: GeometryCollection<{ name: string }> }>;
  const used = new Set<string>();
  const geoms = topo.objects.countries.geometries;
  for (const g of geoms) {
    const en = g.properties!.name;
    let iso = legacyKeys[en] ?? EXTRA[en]?.iso ?? (g.id != null ? isoLib.numericToAlpha3(String(g.id)) : undefined);
    if (!iso || used.has(iso)) iso = `X${String(used.size).padStart(2, '0')}`; // запасной код для повторов
    used.add(iso);
    const c = byIso.get(iso);
    const props: Props = {
      iso,
      name: c?.name ?? EXTRA[en]?.ru ?? isoLib.getName(iso, 'ru') ?? en,
      region: c?.region ?? '',
      has: c ? 1 : 0,
    };
    (g as unknown as { properties: Props }).properties = props;
    delete (g as { id?: unknown }).id;
  }
  return topo as unknown as Topology<{ countries: GeometryCollection<Props> }>;
}
const t50 = prepareTopology('world-atlas/countries-50m.json');
const t10 = prepareTopology('world-atlas/countries-10m.json');
writeJson(path.join(OUT, 'countries-50m.topo.json'), t50);
writeJson(path.join(OUT, 'countries-10m.topo.json'), t10);
const features = (topojson.feature(t50, t50.objects.countries).features as Feature<Polygon | MultiPolygon, Props>[]).filter(
  (f) => f.geometry,
);
const missing = index.filter((c) => !features.some((f) => f.properties.iso === c.id)).map((c) => c.id);
if (missing.length) throw new Error('Нет границ 50m для: ' + missing.join(', '));

// ---------- 2. Полюс недоступности ----------
// Считаем в координатах Меркатора — так, как страна выглядит на карте. Для стран из нескольких частей — самая большая.
const R = 6378137;
const merc = ([lon, lat]: Position): Position => {
  const φ = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return [(lon * Math.PI * R) / 180, R * Math.log(Math.tan(Math.PI / 4 + φ / 2))];
};
const unmerc = ([x, y]: Position): Position => [(x / R / Math.PI) * 180, ((2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180) / Math.PI];
function largestPolygon(g: Polygon | MultiPolygon): Position[][] {
  if (g.type === 'Polygon') return g.coordinates;
  let best = g.coordinates[0];
  let bestA = -1;
  for (const rings of g.coordinates) {
    const a = geoArea({ type: 'Polygon', coordinates: rings });
    if (a > bestA) [best, bestA] = [rings, a];
  }
  return best;
}
function poleOfInaccessibility(g: Polygon | MultiPolygon): Position {
  const rings = largestPolygon(g).map((ring) => ring.map(merc));
  const p = polylabel(rings, 500); // точность 500 м
  return unmerc([p[0], p[1]]).map((v) => Math.round(v * 1e4) / 1e4);
}

const ranked = [...features].sort((a, b) => geoArea(b) - geoArea(a));
const rankOf = new Map(ranked.map((f, i) => [f.properties.iso, i + 1]));
const SMALL = 3e-4; // ≈ 12 000 км²: такие страны получают невидимый круг, по которому легко попасть
const points = features.map((f) => {
  const { iso, name, region, has } = f.properties;
  const area = geoArea(f);
  const [[w, s], [e, n]] = geoBounds(f);
  return {
    type: 'Feature',
    properties: {
      iso, name, region, has,
      rank: rankOf.get(iso)!,
      small: area < SMALL ? 1 : 0,
      icon: fs.existsSync(path.join(ROOT, `public/img/icons/country/${iso}.jpg`)) ? `c-${iso}` : '',
      bbox: [w, s, e, n].map((v) => Math.round(v * 100) / 100),
    },
    geometry: { type: 'Point', coordinates: poleOfInaccessibility(f.geometry) },
  };
});
writeJson(path.join(OUT, 'country-points.json'), { type: 'FeatureCollection', features: points });

// ---------- 3. Соседи (общая граница в 50m) ----------
const geomList = t50.objects.countries.geometries;
const nb = topojson.neighbors(geomList as never);
const neighbors: Record<string, string[]> = {};
geomList.forEach((g, i) => {
  const iso = g.properties!.iso;
  if (!byIso.has(iso)) return;
  neighbors[iso] = nb[i]
    .map((j) => geomList[j].properties!.iso)
    .filter((x) => byIso.has(x))
    .sort((a, b) => byIso.get(a)!.name.localeCompare(byIso.get(b)!.name, 'ru'));
});
writeJson(path.join(OUT, 'neighbors.json'), neighbors);

// ---------- 4. Столицы и крупные города (GeoNames через all-the-cities, CC BY 4.0) ----------
// Столиц спорных и непризнанных территорий нет среди PPLC в GeoNames — координаты вручную
const MANUAL_CAPITALS: Record<string, [number, number, string]> = {
  ESH: [-13.2, 27.15, 'Laayoune'],
  ISR: [35.2137, 31.7683, 'Jerusalem'],
  XKX: [21.1655, 42.6629, 'Pristina'],
  PSE: [35.2034, 31.9038, 'Ramallah'],
  XNC: [33.3642, 35.1856, 'North Nicosia'],
  XSO: [44.065, 9.56, 'Hargeisa'],
};
const capitals = [];
const capitalMissing: string[] = [];
for (const c of index) {
  const a2 = isoLib.alpha3ToAlpha2(c.id);
  const cands = cities.filter((x) => x.country === a2 && x.featureCode === 'PPLC').sort((a, b) => b.population - a.population);
  const manual = MANUAL_CAPITALS[c.id];
  if (manual) cands.unshift({ name: manual[2], country: a2, featureCode: 'PPLC', population: 0, loc: { coordinates: [manual[0], manual[1]] } });
  if (!cands.length) {
    capitalMissing.push(`${c.name} (${c.capital})`);
    continue;
  }
  const [lon, lat] = cands[0].loc.coordinates;
  capitals.push({
    type: 'Feature',
    properties: { iso: c.id, name: c.capital, en: cands[0].name, rank: rankOf.get(c.id)! },
    geometry: { type: 'Point', coordinates: [lon, lat] },
  });
}
writeJson(path.join(OUT, 'capitals.json'), { type: 'FeatureCollection', features: capitals });
const bigCities = cities
  .filter((x) => x.population >= 1_000_000 && x.featureCode !== 'PPLC')
  .sort((a, b) => b.population - a.population)
  .map((x) => ({
    type: 'Feature',
    properties: { name: x.name, pop: x.population },
    geometry: { type: 'Point', coordinates: x.loc.coordinates },
  }));
writeJson(path.join(OUT, 'cities.json'), { type: 'FeatureCollection', features: bigCities });

// ---------- 5. Круглые значки с цветным ободком ----------
const RING: Record<string, string> = {
  eu: '#a5285a', me: '#8a5f05', as: '#a8491a', af: '#2f7a2c', am: '#3550b8', oc: '#16766b',
  nature: '#1f7a4d', reserve: '#1b5e20', wonder: '#c9a227',
};
const SIZE = 72;
async function badge(src: string, out: string, ring: string, ringW: number) {
  const r = SIZE / 2;
  const mask = Buffer.from(`<svg width="${SIZE}" height="${SIZE}"><circle cx="${r}" cy="${r}" r="${r - ringW}" fill="#fff"/></svg>`);
  const ringSvg = Buffer.from(
    `<svg width="${SIZE}" height="${SIZE}"><circle cx="${r}" cy="${r}" r="${r - ringW / 2 - 0.5}" fill="none" stroke="#fff" stroke-width="${ringW + 1.5}"/>` +
      `<circle cx="${r}" cy="${r}" r="${r - ringW / 2 - 0.5}" fill="none" stroke="${ring}" stroke-width="${ringW}"/></svg>`,
  );
  const photo = await sharp(src).resize(SIZE, SIZE, { fit: 'cover' }).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: photo }, { input: ringSvg }])
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(out);
}
let badges = 0;
for (const p of points) {
  if (!p.properties.icon) continue;
  await badge(path.join(ROOT, `public/img/icons/country/${p.properties.iso}.jpg`), path.join(ROOT, `public/img/badges/c-${p.properties.iso}.png`), RING[p.properties.region] ?? '#555', 3);
  badges++;
}
for (const kind of ['nature', 'reserves', 'wonders'] as const) {
  for (const pl of readJson<MapPlace[]>(`content/places/${kind}.json`)) {
    if (!pl.icon) continue;
    const ring = kind === 'wonders' ? RING.wonder : kind === 'reserves' ? RING.reserve : RING.nature;
    await badge(path.join(ROOT, 'public', pl.icon), path.join(ROOT, `public/img/badges/p-${pl.id}.png`), ring, kind === 'wonders' ? 4 : 3);
    badges++;
  }
}

// ---------- 6. Плитки рельефа ----------
// Старый снимок 3840×2000 нарисован в проекции Natural Earth (вписан в 960×500 с полями 6 px, масштаб ×4).
// Перепроецируем в Меркатор. Разрешения снимка хватает до zoom 4 (4096 px на весь мир) — дальше MapLibre сам увеличивает.
const ne = geoNaturalEarth1().fitExtent([[6, 6], [954, 494]], { type: 'Sphere' });
const { data: src, info } = await sharp(path.join(ROOT, 'public/data/relief-bluemarble.jpg')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const SW = info.width, SH = info.height, K = SW / 960;
const T = 256;
const MAXZ = 4;
let tiles = 0;
for (let z = 0; z <= MAXZ; z++) {
  const n = 2 ** z;
  for (let tx = 0; tx < n; tx++) {
    for (let ty = 0; ty < n; ty++) {
      const out = Buffer.alloc(T * T * 3);
      for (let py = 0; py < T; py++) {
        const my = Math.PI * (1 - (2 * (ty * T + py + 0.5)) / (n * T));
        const lat = (Math.atan(Math.sinh(my)) * 180) / Math.PI;
        for (let px = 0; px < T; px++) {
          const lon = ((tx * T + px + 0.5) / (n * T)) * 360 - 180;
          const [x, y] = ne([lon, lat])!;
          // билинейная интерполяция
          const fx = Math.min(SW - 1.001, Math.max(0, x * K - 0.5));
          const fy = Math.min(SH - 1.001, Math.max(0, y * K - 0.5));
          const x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
          const o = (py * T + px) * 3;
          for (let ch = 0; ch < 3; ch++) {
            const i00 = (y0 * SW + x0) * 3 + ch, i01 = i00 + 3, i10 = i00 + SW * 3, i11 = i10 + 3;
            out[o + ch] = Math.round(
              src[i00] * (1 - ax) * (1 - ay) + src[i01] * ax * (1 - ay) + src[i10] * (1 - ax) * ay + src[i11] * ax * ay,
            );
          }
        }
      }
      const file = path.join(ROOT, `public/data/relief/${z}/${tx}/${ty}.jpg`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      await sharp(out, { raw: { width: T, height: T, channels: 3 } }).jpeg({ quality: 82, mozjpeg: true }).toFile(file);
      tiles++;
    }
  }
}

const size = (p: string) => (fs.statSync(path.join(OUT, p)).size / 1048576).toFixed(2) + ' МБ';
console.log(`Границы: ${features.length} стран и территорий (50m ${size('countries-50m.topo.json')}, 10m ${size('countries-10m.topo.json')}).`);
console.log(`Точки значков: ${points.length}, из них мелких стран: ${points.filter((p) => p.properties.small).length}.`);
console.log(`Столицы: ${capitals.length}${capitalMissing.length ? ', не найдены: ' + capitalMissing.join(', ') : ''}. Города от 1 млн: ${bigCities.length}.`);
console.log(`Значки: ${badges}. Плитки рельефа: ${tiles} (zoom 0–${MAXZ}).`);
