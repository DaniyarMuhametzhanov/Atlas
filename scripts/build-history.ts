// Готовит данные машины времени.
//
//   • Cliopatria 0.21 (Seshat Global History Databank, CC BY 4.0): государства с −3400 по 2024 год.
//     Упрощаем границы (mapshaper, keep-shapes — острова не теряются; -filter-slivers не используем)
//     и режем на файлы по векам: public/data/history/polities/c<век>.json.
//     Для каждой строки заранее считаем точку подписи и «что сегодня на этой земле» (коды современных стран).
//   • Связи (союзы, подчинение, вассалитет, личные унии) — отдельный файл relations.json.
//   • historical-basemaps (A. Ourednik, GPL-3.0): племена и культуры — бледный слой «Народы и культуры»,
//     по файлу на год эпохи: public/data/history/peoples/<год>.json.
//   • content/history/polities.json — справочник: английское и русское имя, годы, площадь, «сегодня здесь».
//
// Запуск: npm run build:history (скачивает исходники в assets-src/, если их нет)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import polylabel from 'polylabel';
import mapshaper from 'mapshaper';
import * as topojson from 'topojson-client';
import * as topojsonServer from 'topojson-server';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';
import { buildBookletIndex } from './lib/booklets.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC_DIR = path.join(ROOT, 'assets-src/cliopatria');
const BM_DIR = path.join(ROOT, 'assets-src/basemaps');
const OUT = path.join(ROOT, 'public/data/history');
const CLIO_ZIP_URL = 'https://raw.githubusercontent.com/Seshat-Global-History-Databank/cliopatria/main/cliopatria.geojson.zip';
const BM_URL = 'https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson';
const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const writeJson = (file: string, v: unknown, pretty = false) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(v, null, pretty ? 2 : 0) + (pretty ? '\n' : ''));
};
const mb = (n: number) => (n / 1048576).toFixed(2) + ' МБ';

// ---------- 0. Исходники ----------
fs.mkdirSync(SRC_DIR, { recursive: true });
let clioFile = fs.readdirSync(SRC_DIR).find((f) => f.endsWith('.geojson'));
if (!clioFile) {
  console.log('Скачиваю Cliopatria…');
  const zip = path.join(SRC_DIR, 'cliopatria.geojson.zip');
  const res = await fetch(CLIO_ZIP_URL);
  if (!res.ok) throw new Error(`Cliopatria: ${res.status}`);
  fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  execFileSync('python3', ['-c', `import zipfile;zipfile.ZipFile(${JSON.stringify(zip)}).extractall(${JSON.stringify(SRC_DIR)})`]);
  clioFile = fs.readdirSync(SRC_DIR).find((f) => f.endsWith('.geojson'))!;
}
console.log('Cliopatria:', clioFile);
type ClioProps = { Name: string; FromYear: number; ToYear: number; Area: number; Type: string; Wikipedia: string; Wikidata: string; Components: string; MemberOf: string };
const clio = JSON.parse(fs.readFileSync(path.join(SRC_DIR, clioFile), 'utf8')) as FeatureCollection<Polygon | MultiPolygon, ClioProps>;

// ---------- 1. Имена и русские названия ----------
const legacy = readJson<{ en: string; ru: string }[]>('content/history/legacy/polities-v1.json');
const RU = new Map(legacy.filter((p) => p.ru).map((p) => [p.en, p.ru]));
for (const [en, ru] of Object.entries(readJson<Record<string, string>>('content/history/names-ru-extra.json'))) RU.set(en, ru);
const ruName = (en: string): string => {
  if (RU.has(en)) return RU.get(en)!;
  // связи собираем из имён участников: «(Alliance between A and B)» → «Союз: A и B»
  const m =
    /^\((Alliance) between (.+) and (.+)\)$/.exec(en) ??
    /^\((Allegiance) of (.+) to (.+)\)$/.exec(en) ??
    /^\((Vassalage) of (.+) to (.+)\)$/.exec(en) ??
    /^\((Personal union) (?:of|between) (.+?) (?:and|with) (.+)\)$/.exec(en);
  if (m) {
    const [, kind, a, b] = m;
    const A = RU.get(a) ?? a, B = RU.get(b) ?? b;
    return kind === 'Alliance' ? `Союз: ${A} и ${B}` : kind === 'Personal union' ? `Личная уния: ${A} и ${B}` : `${kind === 'Vassalage' ? 'Вассалитет' : 'Подчинение'}: ${A} → ${B}`;
  }
  return '';
};
const RELATION_KIND = (en: string) => (/^\(Alliance/.test(en) ? 'alliance' : /^\(Personal union/.test(en) ? 'union' : /^\(Vassalage/.test(en) ? 'vassal' : 'allegiance');

const names: string[] = [];
const nameIdx = new Map<string, number>();
const idx = (n: string) => {
  if (!nameIdx.has(n)) {
    nameIdx.set(n, names.length);
    names.push(n);
  }
  return nameIdx.get(n)!;
};

// ---------- 2. Современные страны (для «сегодня здесь») ----------
type CProps = { iso: string; has: number };
const ctopo = readJson<Topology<{ countries: GeometryCollection<CProps> }>>('public/data/map/countries-50m.topo.json');
const countries = (topojson.feature(ctopo, ctopo.objects.countries) as FeatureCollection<Polygon | MultiPolygon, CProps>).features
  .filter((f) => f.geometry && f.properties.has)
  .map((f) => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of polys) for (const [x, y] of p[0]) [w, s, e, n] = [Math.min(w, x), Math.min(s, y), Math.max(e, x), Math.max(n, y)];
    return { iso: f.properties.iso, polys, bbox: [w, s, e, n] as const };
  });
function inRing(x: number, y: number, ring: Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inPoly = (x: number, y: number, rings: Position[][]) => inRing(x, y, rings[0]) && !rings.slice(1).some((h) => inRing(x, y, h));
function countryAt(x: number, y: number): string | null {
  // у склеенных через 180° стран долгота может быть больше 180 — проверяем и сдвинутую точку
  for (const xx of [x, x + 360]) {
    for (const c of countries) {
      if (xx < c.bbox[0] || xx > c.bbox[2] || y < c.bbox[1] || y > c.bbox[3]) continue;
      if (c.polys.some((p) => inPoly(xx, y, p))) return c.iso;
    }
  }
  return null;
}

// ---------- 3. Точка подписи и «сегодня здесь» для каждой строки ----------
const R = 6378137;
const merc = ([lon, lat]: Position): [number, number] => {
  const φ = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return [(lon * Math.PI * R) / 180, R * Math.log(Math.tan(Math.PI / 4 + φ / 2))];
};
const unmerc = ([x, y]: Position): [number, number] => [(x / R / Math.PI) * 180, ((2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180) / Math.PI];
const ringArea = (r: Position[]) => {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return Math.abs(a / 2);
};
const r2 = (v: number) => Math.round(v * 100) / 100;

type Row = { i: number; a: number; b: number; g: number; ar: number; lx: number; ly: number; t: string; k: 0 | 1 };
const rows: { props: Row; geometry: Polygon | MultiPolygon }[] = [];
const relations: { props: { i: number; a: number; b: number; kind: string; m: string }; geometry: Polygon | MultiPolygon }[] = [];
const todayByName = new Map<number, Map<string, number>>();
let t0 = Date.now();
clio.features.forEach((f, n) => {
  const p = f.properties;
  if (!f.geometry) return;
  if (p.Type === 'RELATION') {
    relations.push({ props: { i: idx(p.Name), a: p.FromYear, b: p.ToYear, kind: RELATION_KIND(p.Name), m: p.Components }, geometry: f.geometry });
    return;
  }
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const main = polys.reduce((best, q) => (ringArea(q[0]) > ringArea(best[0]) ? q : best), polys[0]);
  const mm = main.map((ring) => ring.map(merc));
  let [w, s, e, nn] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of mm[0]) [w, s, e, nn] = [Math.min(w, x), Math.min(s, y), Math.max(e, x), Math.max(nn, y)];
  const pl = polylabel(mm as [number, number][][], Math.max(500, Math.hypot(e - w, nn - s) / 300));
  const [lx, ly] = unmerc([pl[0], pl[1]]);
  // «сегодня здесь»: точка подписи + сетка точек по всем частям, взвешенная площадью части
  const votes = new Map<string, number>();
  const vote = (x: number, y: number, wgt: number) => {
    const iso = countryAt(x, y);
    if (iso) votes.set(iso, (votes.get(iso) ?? 0) + wgt);
  };
  vote(lx, ly, 2);
  for (const q of polys) {
    const ar = ringArea(q[0]);
    let [qw, qs, qe, qn] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y] of q[0]) [qw, qs, qe, qn] = [Math.min(qw, x), Math.min(qs, y), Math.max(qe, x), Math.max(qn, y)];
    const N = ar > 50 ? 7 : ar > 2 ? 4 : 2;
    for (let ix = 0; ix < N; ix++)
      for (let iy = 0; iy < N; iy++) {
        const x = qw + ((ix + 0.5) / N) * (qe - qw), y = qs + ((iy + 0.5) / N) * (qn - qs);
        if (inPoly(x, y, q)) vote(x, y, ar / (N * N));
      }
  }
  const total = [...votes.values()].reduce((a, b) => a + b, 0);
  const today = [...votes].sort((a, b) => b[1] - a[1]).filter(([, v]) => v / total > 0.03).slice(0, 6).map(([iso]) => iso);
  const ni = idx(p.Name);
  const agg = todayByName.get(ni) ?? new Map<string, number>();
  for (const [iso, v] of votes) agg.set(iso, (agg.get(iso) ?? 0) + (v / total) * p.Area);
  todayByName.set(ni, agg);
  const group = p.MemberOf ? p.MemberOf.split(';')[0].trim() : '';
  rows.push({
    props: { i: ni, a: p.FromYear, b: p.ToYear, g: group ? idx(group) : -1, ar: Math.round(p.Area), lx: r2(lx), ly: r2(ly), t: today.join(' '), k: p.Name.startsWith('(') ? 1 : 0 },
    geometry: f.geometry,
  });
  if (n % 2000 === 0) console.log(`  строк ${n} / ${clio.features.length} (${((Date.now() - t0) / 1000).toFixed(0)} с)`);
});
console.log(`Государств (строк): ${rows.length}, связей: ${relations.length}, имён: ${names.length}`);

// ---------- 4. Упрощение границ ----------
// keep-shapes — мелкие острова остаются; -filter-slivers не используем (он удаляет острова)
async function simplify<P>(items: { props: P; geometry: Polygon | MultiPolygon }[], pct: string) {
  const fc = { type: 'FeatureCollection', features: items.map((r, n) => ({ type: 'Feature', properties: { _n: n }, geometry: r.geometry })) };
  const out = await mapshaper.applyCommands(`-i in.json -simplify ${pct} keep-shapes -o out.json format=geojson`, { 'in.json': fc });
  const res = JSON.parse(out['out.json'].toString()) as FeatureCollection<Polygon | MultiPolygon, { _n: number }>;
  return res.features.filter((f) => f.geometry).map((f) => ({ props: items[f.properties._n].props, geometry: f.geometry }));
}
t0 = Date.now();
const simple = await simplify(rows, '25%');
const simpleRel = await simplify(relations, '15%');
console.log(`Упрощение: ${((Date.now() - t0) / 1000).toFixed(0)} с`);

// ---------- 5. Файлы по векам ----------
fs.rmSync(OUT, { recursive: true, force: true });
const century = (y: number) => Math.floor(y / 100) * 100;
const byCentury = new Map<number, Feature[]>();
for (const r of simple) {
  for (let c = century(r.props.a); c <= century(r.props.b); c += 100) {
    if (!byCentury.has(c)) byCentury.set(c, []);
    byCentury.get(c)!.push({ type: 'Feature', properties: r.props, geometry: r.geometry });
  }
}
const files: { c: number; size: number }[] = [];
for (const [c, feats] of [...byCentury].sort((a, b) => a[0] - b[0])) {
  const topo = topojsonServer.topology({ p: { type: 'FeatureCollection', features: feats } as never }, 1e5);
  const file = path.join(OUT, `polities/c${c}.json`);
  writeJson(file, topo);
  files.push({ c, size: fs.statSync(file).size });
}
const rtopo = topojsonServer.topology({ r: { type: 'FeatureCollection', features: simpleRel.map((r) => ({ type: 'Feature', properties: r.props, geometry: r.geometry })) } as never }, 1e5);
writeJson(path.join(OUT, 'relations.json'), rtopo);

// ---------- 6. «Народы и культуры» (historical-basemaps) ----------
const epochs = readJson<number[]>('content/epochs/epochs.json');
const HRU = readJson<Record<string, string>>('content/history/legacy/hb-names-ru.json');
fs.mkdirSync(BM_DIR, { recursive: true });
const bmName = (y: number) => `world_${y < 0 ? 'bc' + -y : y}.geojson`;
const peoples: number[] = [];
let peopleBytes = 0;
for (const y of epochs) {
  const raw = path.join(BM_DIR, bmName(y));
  if (!fs.existsSync(raw)) {
    const res = await fetch(`${BM_URL}/${bmName(y)}`);
    if (!res.ok) {
      console.log(`  historical-basemaps: нет файла для ${y} (${res.status})`);
      continue;
    }
    fs.writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  }
  const fc = JSON.parse(fs.readFileSync(raw, 'utf8')) as FeatureCollection<Polygon | MultiPolygon, { NAME?: string }>;
  fc.features = fc.features.filter((f) => f.geometry && f.properties?.NAME);
  for (const f of fc.features) f.properties = { NAME: HRU[f.properties.NAME!] ?? f.properties.NAME };
  const out = await mapshaper.applyCommands('-i in.json -simplify 12% keep-shapes -o out.json format=topojson quantization=10000', { 'in.json': fc });
  const file = path.join(OUT, `peoples/${y}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out['out.json']);
  peoples.push(y);
  peopleBytes += fs.statSync(file).size;
}

// ---------- 7. Справочник государств ----------
const span = new Map<number, [number, number]>();
const maxArea = new Map<number, number>();
for (const r of rows) {
  const s = span.get(r.props.i) ?? [Infinity, -Infinity];
  span.set(r.props.i, [Math.min(s[0], r.props.a), Math.max(s[1], r.props.b)]);
  maxArea.set(r.props.i, Math.max(maxArea.get(r.props.i) ?? 0, r.props.ar));
}
for (const r of relations) {
  const s = span.get(r.props.i) ?? [Infinity, -Infinity];
  span.set(r.props.i, [Math.min(s[0], r.props.a), Math.max(s[1], r.props.b)]);
}
const wikidata = new Map(clio.features.map((f) => [f.properties.Name, f.properties.Wikidata]));
const missingRu: string[] = [];
const polities = names.map((en, i) => {
  const ru = ruName(en);
  if (!ru) missingRu.push(en);
  const today = [...(todayByName.get(i) ?? new Map())].sort((a, b) => b[1] - a[1]);
  const tot = today.reduce((s, [, v]) => s + v, 0);
  return {
    i,
    en,
    ru,
    kind: relations.some((r) => r.props.i === i) ? 'relation' : en.startsWith('(') ? 'group' : 'polity',
    span: span.get(i),
    area: maxArea.get(i) ?? 0,
    wd: wikidata.get(en) || undefined,
    today: today.filter(([, v]) => v / tot > 0.02).slice(0, 8).map(([iso]) => iso),
  };
});
writeJson(path.join(ROOT, 'content/history/polities.json'), polities, true);

const allSize = [...files.map((f) => f.size), fs.statSync(path.join(OUT, 'relations.json')).size, peopleBytes].reduce((a, b) => a + b, 0);
writeJson(path.join(OUT, 'index.json'), { centuries: files.map((f) => f.c), peoples, min: -3400, max: 2024 });

// ---------- 8. Проверка буклетов: у каждого должно найтись хотя бы одно имя ----------
const aliases = readJson<Record<string, string>>('content/history/aliases.json');
const booklets = fs.readdirSync(path.join(ROOT, 'content/history/booklets')).map((f) => readJson<{ name: string; keys: string[] }>(`content/history/booklets/${f}`));
// имя в скобках — объединение под тем же названием: «(Delhi Sultanate)» подходит буклету «Delhi Sultanate»
const lost = booklets.filter((b) => !b.keys.some((k) => nameIdx.has(k) || nameIdx.has(`(${k})`)) && !Object.entries(aliases).some(([a, k]) => b.keys.includes(k) && (nameIdx.has(a) || nameIdx.has(`(${a})`)))).map((b) => b.name);

buildBookletIndex(ROOT);
const biggest = [...files].sort((a, b) => b.size - a.size)[0];
console.log(`Файлов по векам: ${files.length}, самый большой: c${biggest.c} — ${mb(biggest.size)}`);
console.log(`Народы и культуры: ${peoples.length} лет, ${mb(peopleBytes)}`);
console.log(`Всего машина времени: ${mb(allSize)}`);
console.log(`Без русского имени: ${missingRu.length}${missingRu.length ? ' — ' + missingRu.join('; ') : ''}`);
console.log(`Буклеты без совпадения имён: ${lost.length ? lost.join(', ') : 'нет'}`);
