// Достаёт все данные из старого однофайлового атласа (legacy/atlas-v1.html)
// и раскладывает их по content/ (тексты) и public/ (картинки, карты).
// В конце сверяет числа и пишет отчёт reports/stage-2-extract.md.
//
// Запуск: npm run extract [-- путь/к/старому.html]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { z } from 'zod';
import {
  Country, MapPlace, PhotoSource, HistoryBooklet, Polity, WorldEvent, Find,
} from '../src/content/schema.ts';
import { applyPicks, keepBuilt, type Sources } from './lib/photos.ts';

const require = createRequire(import.meta.url);
const isoCountries = require('i18n-iso-countries') as { numericToAlpha3(n: string): string | undefined };

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.resolve(process.argv[2] ?? path.join(ROOT, 'legacy/atlas-v1.html'));
const CONTENT = path.join(ROOT, 'content');
const PUBLIC = path.join(ROOT, 'public');

// ---------- 1. Читаем старые данные ----------
// Данные — это глобальные переменные в третьем <script>, от `const C=` до начала кода карты (`const REG=`).
const html = fs.readFileSync(SRC, 'utf8');
const start = html.indexOf('const C=');
const end = html.indexOf('const REG=', start);
if (start < 0 || end < 0) throw new Error('Не нашёл блок данных в ' + SRC);
const dataSrc = html.slice(start, end);

const NAMES = ['C', 'X', 'P', 'FAME', 'MOT', 'ICONFIX', 'NAT', 'NTYPE', 'RES', 'WON', 'WKIND', 'PH', 'PC', 'PS', 'PN',
  'PI', 'PIN', 'WIC', 'HIST', 'HRU', 'EV', 'EVLANE', 'FINDS', 'FPH', 'HB', 'HBA', 'HSPAN', 'CLIO', 'CSPAN', 'RELIEF', 'TOPO'] as const;
const sandbox: Record<string, unknown> = {};
vm.createContext(sandbox);
vm.runInContext(`${dataSrc};\nglobalThis.__legacy={${NAMES.join(',')}};`, sandbox, { timeout: 60_000 });
const L = sandbox.__legacy as Record<(typeof NAMES)[number], any>;

type Photo = { a: string; l: string; u: string; c?: string; t?: string };
type Row = [string, string, string, number, number, string, number?, string?];

// ---------- 2. Помощники ----------
const TR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};
function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[а-яё]/g, (ch) => TR[ch] ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
// Уникальный id: если такой уже занят, добавляем -2, -3…
function uniq(base: string, used: Set<string>): string {
  let id = base || 'item';
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  used.add(id);
  return id;
}

const written = { files: 0, bytes: 0 };
function writeFile(file: string, data: string | Buffer) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  written.files++;
  written.bytes += Buffer.byteLength(data);
}
const writeJson = (file: string, value: unknown) => writeFile(file, JSON.stringify(value, null, 2) + '\n');

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
// data:image/jpeg;base64,… → файл в public/, возвращает путь относительно public/
function writeDataUri(uri: string, relNoExt: string): string {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(uri);
  if (!m) throw new Error('Не data URI: ' + relNoExt);
  const rel = `${relNoExt}.${EXT[m[1]] ?? 'bin'}`;
  writeFile(path.join(PUBLIC, rel), Buffer.from(m[2], 'base64'));
  return rel;
}
// Размер картинки из заголовка JPEG / PNG / WebP — чтобы проверить, что фото действительно 560×280 и т.п.
function imageSize(buf: Buffer): [number, number] | null {
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const kind = buf.toString('ascii', 12, 16);
    if (kind === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
    if (kind === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1];
    }
    if (kind === 'VP8X') return [buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1];
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
      i += 2 + len;
    }
  }
  return null;
}
const sizeOfFile = (rel: string) => imageSize(fs.readFileSync(path.join(PUBLIC, rel)));

// Ошибки проверки Zod собираем все сразу, а не падаем на первой
const problems: string[] = [];
function check<T>(schema: z.ZodType<T>, value: unknown, where: string): T {
  const r = schema.safeParse(value);
  if (!r.success) for (const i of r.error.issues) problems.push(`${where}: ${i.path.join('.') || '(корень)'} — ${i.message}`);
  return value as T;
}

// Чистим старый результат, чтобы не осталось «осиротевших» файлов
for (const dir of ['countries', 'history', 'places', 'epochs']) fs.rmSync(path.join(CONTENT, dir), { recursive: true, force: true });
for (const dir of ['img/legacy', 'img/icons', 'data/history']) fs.rmSync(path.join(PUBLIC, dir), { recursive: true, force: true });

// ---------- 3. Коды стран ISO 3166-1 alpha-3 ----------
// В world-atlas у страны есть числовой код ISO (id: "398"). У трёх непризнанных территорий кода нет —
// для них берём коды из диапазона X**, который стандарт оставляет для собственных нужд.
const NO_ISO: Record<string, string> = { Kosovo: 'XKX', 'N. Cyprus': 'XNC', Somaliland: 'XSO' };
const legacyKeys: Record<string, string> = {};
for (const g of L.TOPO.objects.countries.geometries) {
  const name: string = g.properties.name;
  const iso = NO_ISO[name] ?? (g.id ? isoCountries.numericToAlpha3(String(g.id)) : undefined);
  if (!iso) throw new Error(`Нет кода ISO для ${name} (id ${g.id})`);
  if (Object.values(legacyKeys).includes(iso)) throw new Error(`Код ${iso} повторяется (${name})`);
  legacyKeys[name] = iso;
}
const iso = (key: string) => {
  const v = legacyKeys[key];
  if (!v) throw new Error('Неизвестная страна: ' + key);
  return v;
};
writeJson(path.join(CONTENT, 'legacy-keys.json'), legacyKeys);

// ---------- 4. Фото ----------
// Старые фото: c — обложка 560×280, t — миниатюра 224×112. Пишем как есть (JPEG/WebP),
// WebP/AVIF в трёх размерах сделает этап 6 (build-images.ts).
const photoIds = new Set<string>();
const photoIdByKey: Record<string, string> = {};
const sources: z.infer<typeof PhotoSource>[] = [];
const photoSizes = new Map<string, number>(); // "560×280" → сколько раз
function addPhoto(key: string, p: Photo, kind: 'place' | 'find'): string {
  if (photoIdByKey[`${kind}:${key}`]) return photoIdByKey[`${kind}:${key}`];
  const id = uniq(slug(key), photoIds);
  const files: Record<string, string> = {};
  for (const [field, uri] of [['c', p.c], ['t', p.t]] as const) {
    if (!uri) continue;
    const rel = writeDataUri(uri, `img/legacy/${id}-${field === 'c' ? 'cover' : 'thumb'}`);
    const wh = sizeOfFile(rel);
    const w = wh ? wh[0] : field === 'c' ? 560 : 224;
    files[String(w)] = rel;
    const k = wh ? `${wh[0]}×${wh[1]}` : '?';
    photoSizes.set(k, (photoSizes.get(k) ?? 0) + 1);
  }
  const src = {
    id, title: key, author: p.a, license: p.l, url: p.u,
    sizes: Object.keys(files).map(Number).sort((a, b) => a - b), files,
  };
  sources.push(check(PhotoSource, src, `фото «${key}»`));
  photoIdByKey[`${kind}:${key}`] = id;
  return id;
}
const PH = L.PH as Record<string, Photo>;
for (const [key, p] of Object.entries(PH)) addPhoto(key, p, 'place');
const FPH = L.FPH as Record<string, Photo>;
for (const [key, p] of Object.entries(FPH)) addPhoto(key, p, 'find');
const phId = (key: string | undefined) => (key && PH[key] ? photoIdByKey[`place:${key}`] : undefined);

// ---------- 5. Природа, заповедники, чудеса света ----------
// В старом коде RES уже добавлены в конец NAT с типом "reserve"
const placeIds = new Set<string>();
const NAT = L.NAT as Row[];
const RES = L.RES as Row[];
const natRows = NAT.filter((r) => r[2] !== 'reserve');
const resRows = NAT.filter((r) => r[2] === 'reserve');
function toPlace(r: Row, iconMap: Record<string, string>, iconDir: string, photoKey?: string) {
  const id = uniq(`${iso(r[0]).toLowerCase()}-${slug(r[1])}`, placeIds);
  const place = {
    id, country: iso(r[0]), name: r[1], type: r[2], lon: r[3], lat: r[4], text: r[5], main: !!r[6],
    photo: phId(photoKey),
    icon: iconMap[r[1]] ? writeDataUri(iconMap[r[1]], `img/icons/${iconDir}/${id}`) : undefined,
  };
  return check(MapPlace, place, `место «${r[1]}»`);
}
const nature = natRows.map((r) => toPlace(r, L.PIN, 'nature', L.PN[r[1]]));
const reserves = resRows.map((r) => toPlace(r, L.PIN, 'nature', L.PN[r[1]] ?? r[7]));
const wonders = (L.WON as Row[]).map((r) => {
  const p = toPlace([r[0], r[1], r[2], r[3], r[4], r[5], 1], L.WIC, 'wonder', r[6] as unknown as string);
  return p;
});
writeJson(path.join(CONTENT, 'places/nature.json'), nature);
writeJson(path.join(CONTENT, 'places/reserves.json'), reserves);
writeJson(path.join(CONTENT, 'places/wonders.json'), wonders);
const NTYPE = L.NTYPE as Record<string, [string, string, string]>;
writeJson(
  path.join(CONTENT, 'places/nature-types.json'),
  Object.fromEntries(Object.entries(NTYPE).map(([k, [icon, land, ru]]) => [k, { ru, icon, land }])),
);
writeJson(path.join(CONTENT, 'places/wonder-kinds.json'), L.WKIND);

// ---------- 6. Страны ----------
const countryCount = { total: 0, sights: 0, sightPhotos: 0, covers: 0, icons: 0 };
// Короткий список стран для карты и поиска: грузится сразу, а полные файлы — по требованию
const countryIndex: { id: string; name: string; nameEn: string; region: string; capital: string }[] = [];
const byCountry = (list: { id: string; country: string }[], code: string) =>
  list.filter((p) => p.country === code).map((p) => p.id);
for (const [key, c] of Object.entries(L.C as Record<string, any>)) {
  const code = iso(key);
  const x = L.X[key];
  const p = L.P[key];
  const sights = (c.s as [string, string][]).map(([name, text]) => {
    const photo = phId(L.PS[`${key}|${name}`]);
    countryCount.sights++;
    if (photo) countryCount.sightPhotos++;
    return { name, text, ...(photo ? { photos: [photo] } : {}) };
  });
  const cover = phId(L.PC[key]);
  if (cover) countryCount.covers++;
  if (L.PI[key]) {
    writeDataUri(L.PI[key], `img/icons/country/${code}`);
    countryCount.icons++;
  }
  const country = {
    id: code,
    name: c.n,
    nameEn: key,
    region: c.r,
    capital: c.cap,
    tagline: c.tag,
    fame: L.FAME[key],
    updated: 'legacy-v1',
    icon: { motif: L.MOT[key], ...(L.ICONFIX[key] ? { fix: L.ICONFIX[key] } : {}) },
    overview: {
      intro: c.i,
      timeline: (c.h as [string, string][]).map(([year, text]) => ({ year, text })),
      funFact: c.f,
    },
    tourist: {
      sights,
      nature: byCountry(nature, code),
      reserves: byCountry(reserves, code),
      wonders: byCountry(wonders, code),
      danger: { level: p.d[0], text: p.d[1], asOf: 'не указано (старая версия)' },
    },
    politics: { system: p.p, mood: p.m, techInfra: p.t },
    culture: { character: x.men, traditions: x.cus },
    relations: { neighbors: x.rel },
    photos: cover ? { cover } : {},
  };
  writeJson(path.join(CONTENT, `countries/${code}.json`), check(Country, country, `страна ${code}`));
  countryIndex.push({ id: code, name: c.n, nameEn: key, region: c.r, capital: c.cap });
  countryCount.total++;
}
countryIndex.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
writeJson(path.join(CONTENT, 'countries-index.json'), countryIndex);

// ---------- 7. Исторические буклеты и Cliopatria ----------
const hbIds = new Set<string>();
const hbPhotoMissing: string[] = [];
const booklets = (L.HB as any[]).map((h) => {
  const id = uniq(slug(h.n), hbIds);
  const photo = phId(h.ph) ?? (h.ph && FPH[h.ph] ? photoIdByKey[`find:${h.ph}`] : undefined);
  if (h.ph && !photo) hbPhotoMissing.push(`${h.n} (${h.ph})`);
  const b = {
    id, name: h.n, keys: h.k, years: h.yrs, capital: h.cap, intro: h.i,
    timeline: (h.h as [string, string][]).map(([year, text]) => ({ year, text })),
    heritage: h.z, ...(photo ? { photo } : {}),
  };
  writeJson(path.join(CONTENT, `history/booklets/${id}.json`), check(HistoryBooklet, b, `буклет «${h.n}»`));
  return b;
});
writeJson(path.join(CONTENT, 'history/aliases.json'), L.HBA);

const clioTopo = JSON.parse(zlib.gunzipSync(Buffer.from(L.CLIO.d, 'base64')).toString('utf8'));
const clioGeoms = (Object.values(clioTopo.objects)[0] as { geometries: any[] }).geometries;
writeFile(path.join(PUBLIC, 'data/history/cliopatria.topo.json'), JSON.stringify(clioTopo));
const CSPAN = L.CSPAN as Record<string, [number, number]>;
const polities = (L.CLIO.n as string[]).map((en, i) =>
  check(Polity, { i, en, ru: L.CLIO.r[i] ?? '', ...(CSPAN[en] ? { span: CSPAN[en] } : {}) }, `государство ${en}`),
);
writeJson(path.join(CONTENT, 'history/polities.json'), polities);
// Остатки версии на historical-basemaps: код их не читает, но они пригодятся для слоя «Народы и культуры»
writeJson(path.join(CONTENT, 'history/legacy/hb-spans.json'), L.HSPAN);
writeJson(path.join(CONTENT, 'history/legacy/hb-names-ru.json'), L.HRU);

// ---------- 8. Эпохи, события, находки ----------
writeJson(path.join(CONTENT, 'epochs/epochs.json'), (L.HIST as { y: number }[]).map((h) => h.y));
const events = (L.EV as [string, number, string, string][]).map(([lane, year, title, text], n) =>
  check(WorldEvent, { lane, year, title, text }, `событие №${n + 1}`),
);
writeJson(path.join(CONTENT, 'epochs/events.json'), { lanes: L.EVLANE, events });
const finds = (L.FINDS as [number, string, string, string][]).map(([year, title, text, key]) => {
  const photo = FPH[key] ? photoIdByKey[`find:${key}`] : undefined;
  return check(Find, { year, title, text, ...(photo ? { photo } : {}) }, `находка «${title}»`);
});
writeJson(path.join(CONTENT, 'epochs/finds.json'), finds);

// ---------- 9. Карты и рельеф ----------
const topo = structuredClone(L.TOPO);
for (const g of topo.objects.countries.geometries) g.properties.iso = legacyKeys[g.properties.name];
// Исходники, из которых scripts/build-map.ts делает данные карты. В сайт они не попадают.
const ASSETS_SRC = path.join(ROOT, 'assets-src');
writeFile(path.join(ASSETS_SRC, 'countries-110m.topo.json'), JSON.stringify(topo));
const reliefBuf = Buffer.from(String(L.RELIEF).split(',')[1], 'base64');
writeFile(path.join(ASSETS_SRC, 'relief-bluemarble.jpg'), reliefBuf);
const reliefSize = imageSize(reliefBuf);

// ---------- 10. Модуль ART (запасные SVG-картинки) — это код: перенесён вручную в src/booklet/art/art.ts ----------

// ---------- 11. Источники наборов данных ----------
// Если этап 6 уже сделал крупные фото и подключил выбранные — сохраняем это при повторном извлечении
const oldSources = fs.existsSync(path.join(CONTENT, 'sources.json'))
  ? (JSON.parse(fs.readFileSync(path.join(CONTENT, 'sources.json'), 'utf8')) as Sources).photos
  : [];
const sourcesJson: Sources = {
  datasets: [
    { id: 'world-atlas', name: 'Границы стран Natural Earth 50m и 10m (пакет world-atlas)', license: 'Public Domain / ISC', url: 'https://github.com/topojson/world-atlas' },
    { id: 'geonames', name: 'Столицы и крупные города GeoNames (пакет all-the-cities)', license: 'CC BY 4.0', url: 'https://www.geonames.org' },
    { id: 'noto-sans', name: 'Шрифт подписей карты Noto Sans (protomaps/basemaps-assets)', license: 'SIL OFL 1.1', url: 'https://github.com/protomaps/basemaps-assets' },
    { id: 'cliopatria', name: 'Исторические границы Cliopatria (Seshat Global History Databank)', license: 'CC BY 4.0', url: 'https://github.com/Seshat-Global-History-Databank/cliopatria' },
    { id: 'blue-marble', name: 'Рельеф NASA Blue Marble', license: 'Public Domain', url: 'https://visibleearth.nasa.gov/collection/1484/blue-marble' },
    { id: 'commons', name: 'Фото Wikimedia Commons', license: 'у каждого фото своя', url: 'https://commons.wikimedia.org' },
  ],
  photos: keepBuilt(sources, oldSources),
};
applyPicks(sourcesJson);
writeJson(path.join(CONTENT, 'sources.json'), sourcesJson);

// ---------- 12. Сверка чисел и отчёт ----------
const count = (dir: string) => fs.readdirSync(path.join(ROOT, dir)).length;
const legacyNat = NAT.length;
const rows: [string, number | string, number | string, number | string][] = [
  // [что, ждали по промпту, было в старом файле, перенесено]
  ['Страны', 177, Object.keys(L.C).length, count('content/countries')],
  ['Природные места (без заповедников)', 158, legacyNat - RES.length, nature.length],
  ['Заповедники', 57, RES.length, reserves.length],
  ['Чудеса света', 21, L.WON.length, wonders.length],
  ['Исторические буклеты', 77, L.HB.length, Math.min(booklets.length, count('content/history/booklets'))],
  ['Синонимы имён для буклетов', '—', Object.keys(L.HBA).length, Object.keys(L.HBA).length],
  ['Государства Cliopatria (имена)', '≈1550', L.CLIO.n.length, polities.length],
  ['Куски границ Cliopatria', '—', clioGeoms.length, clioGeoms.length],
  ['Годы жизни государств (CSPAN)', '—', Object.keys(CSPAN).length, polities.filter((p) => p.span).length],
  ['Годы эпох', 48, L.HIST.length, L.HIST.length],
  ['События', '—', L.EV.length, events.length],
  ['Находки', 49, L.FINDS.length, finds.length],
  ['Фото мест (PH)', '—', Object.keys(PH).length, Object.keys(photoIdByKey).filter((k) => k.startsWith('place:')).length],
  ['Фото находок (FPH)', '—', Object.keys(FPH).length, Object.keys(photoIdByKey).filter((k) => k.startsWith('find:')).length],
  ['Файлы фото (обложки + миниатюры)', '—', [...Object.values(PH), ...Object.values(FPH)].reduce((n, p) => n + (p.c ? 1 : 0) + (p.t ? 1 : 0), 0), count('public/img/legacy')],
  ['Обложки стран (PC)', '—', Object.keys(L.PC).length, countryCount.covers],
  ['Достопримечательности', '—', countryCount.sights, countryCount.sights],
  ['…из них с фото (PS)', '—', Object.keys(L.PS).length, countryCount.sightPhotos],
  ['Значки стран (PI)', '—', Object.keys(L.PI).length, count('public/img/icons/country')],
  ['Значки природы и заповедников (PIN)', '—', Object.keys(L.PIN).length, count('public/img/icons/nature')],
  ['Значки чудес света (WIC)', '—', Object.keys(L.WIC).length, count('public/img/icons/wonder')],
  ['Старые переводы имён (HRU)', '—', Object.keys(L.HRU).length, Object.keys(L.HRU).length],
  ['Имена historical-basemaps с годами (HSPAN)', '—', Object.keys(L.HSPAN).length, Object.keys(L.HSPAN).length],
];
const mismatches = rows.filter(([, , was, now]) => was !== now);

const noIcon = Object.keys(L.C).filter((k) => !L.PI[k]).map((k) => `${L.C[k].n} (${iso(k)})`);
const noCover = Object.keys(L.C).filter((k) => !L.PC[k]).map((k) => `${L.C[k].n} (${iso(k)})`);
const noPlacePhoto = [...nature, ...reserves].filter((p) => !p.photo).map((p) => p.name);
const noPlaceIcon = [...nature, ...reserves].filter((p) => !p.icon).map((p) => p.name);
const noSightPhoto = Object.entries(L.C as Record<string, any>).flatMap(([k, c]) =>
  (c.s as [string, string][]).filter(([n]) => !L.PS[`${k}|${n}`]).map(([n]) => `${c.n}: ${n}`),
);
const noFindPhoto = finds.filter((f) => !f.photo).map((f) => f.title);

const fileSizes = (dir: string): [string, number][] => {
  const out: [string, number][] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push([path.relative(ROOT, p), fs.statSync(p).size]);
    }
  };
  walk(path.join(ROOT, dir));
  return out;
};
const pub = fileSizes('public');
const pubTotal = pub.reduce((s, [, n]) => s + n, 0);
const biggest = [...pub].sort((a, b) => b[1] - a[1]).slice(0, 5);
const mb = (n: number) => (n / 1048576).toFixed(2) + ' МБ';

const list = (xs: string[]) => (xs.length ? xs.join(', ') : 'нет');
const report = `# Этап 2 — извлечение данных из старого атласа

Создано скриптом \`scripts/extract-legacy.ts\` (${new Date().toISOString().slice(0, 10)}).
Источник: \`${path.relative(ROOT, SRC)}\` (${mb(fs.statSync(SRC).size)}).

## Сверка чисел

| Что | Ждали по промпту | Было в старом файле | Перенесено | |
|---|---|---|---|---|
${rows.map(([what, exp, was, now]) => `| ${what} | ${exp} | ${was} | ${now} | ${was === now ? '✅' : '❌'} |`).join('\n')}

${mismatches.length ? `**Расхождения при переносе: ${mismatches.length}**` : '**Всё, что было в старом файле, перенесено: расхождений нет.**'}

## Проверка схемами Zod

${problems.length ? `Ошибок: ${problems.length}\n\n${problems.map((p) => '- ' + p).join('\n')}` : 'Все файлы прошли проверку: страны, места, фото, буклеты, государства, события, находки.'}

## Чего не было уже в старой версии (это не потеря при переносе)

- Страны без значка: ${list(noIcon)}
- Страны без обложки: ${list(noCover)}
- Природные места без фото: ${list(noPlacePhoto)}
- Природные места без значка: ${list(noPlaceIcon)}
- Достопримечательности без фото: ${list(noSightPhoto)}
- Находки без фото: ${list(noFindPhoto)}
- Буклеты со ссылкой на несуществующее фото: ${list(hbPhotoMissing)}

## Размеры фото в старой версии

${[...photoSizes].map(([k, n]) => `- ${k}: ${n} шт.`).join('\n')}

Рельеф: ${reliefSize ? reliefSize.join('×') : '?'}.

## Коды стран

Ключи старой версии (английские имена world-atlas) заменены кодами ISO 3166-1 alpha-3, таблица — \`content/legacy-keys.json\`.
У трёх территорий нет кода ISO, им даны коды из пользовательского диапазона X**: ${Object.entries(NO_ISO).map(([k, v]) => `${k} → ${v}`).join(', ')}.

## Размер public/

Всего ${mb(pubTotal)} в ${pub.length} файлах. Самые большие:
${biggest.map(([f, n]) => `- \`${f}\` — ${mb(n)}`).join('\n')}

Ограничение хостинга — 16 МБ на файл: ${biggest[0][1] <= 16 * 1048576 ? 'соблюдено ✅' : 'превышено ❌'}.
`;
writeFile(path.join(ROOT, 'reports/stage-2-extract.md'), report);

console.log(`Готово: ${written.files} файлов, ${mb(written.bytes)}.`);
console.log(`Расхождений: ${mismatches.length}, ошибок схем: ${problems.length}. Отчёт: reports/stage-2-extract.md`);
if (mismatches.length || problems.length) process.exitCode = 1;
