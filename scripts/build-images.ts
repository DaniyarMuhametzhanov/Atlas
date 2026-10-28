// Готовит фото для сайта (sharp): из файлов, скачанных fetch-commons.ts в assets-src/commons/, делает
//   • для буклета: WebP шириной 480 и 1200 px;
//   • для просмотра на весь экран: WebP шириной до 1920 px.
// → public/img/<id>-<ширина>.webp, и записывает их в content/sources.json (sizes, files, w, h).
// Только WebP: AVIF экономил ~15%, а хранить два формата — вдвое больше места (лимит хостинга 256 МБ).
// Больше исходника не растягиваем. У фото без оригинала остаются старые файлы (560 / 224 px).
//
// Лимит хостинга — 256 МБ на всё. Если не влезает, скрипт сам подбирает размер и качество фото «на весь экран»:
// пробует варианты на выборке из 30 фото и берёт самый качественный, который укладывается.
//
// Запуск: npm run build:images      (повторный запуск пропускает уже готовые файлы)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ORIGINALS, ROOT, SOURCES, readJson, writeJson, type Sources } from './lib/photos.ts';

const BOOKLET = [480, 1200];
const Q_BOOKLET: Record<number, number> = { 480: 78, 1200: 74 };
/** Варианты фото на весь экран — от лучшего к более лёгкому */
const FULL = [
  { w: 1920, q: 72 },
  { w: 1920, q: 64 },
  { w: 1600, q: 68 },
  { w: 1600, q: 60 },
  { w: 1600, q: 52 },
  { w: 1440, q: 52 },
];
const LIMIT_FILE = 16 * 1048576; // хостинг: один файл ≤ 16 МБ
const LIMIT_TOTAL = 256 * 1048576; // и всего ≤ 256 МБ
const RESERVE = 12 * 1048576; // запас на рост кода и данных
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(PUBLIC, 'img');
const STAMP = path.join(OUT, 'fullscreen.json'); // какой вариант «на весь экран» сделан сейчас

type Manifest = Record<string, { file: string }>;
const manifestFile = path.join(ORIGINALS, 'manifest.json');
const manifest: Manifest = fs.existsSync(manifestFile) ? readJson(manifestFile) : {};
const sources = readJson<Sources>(SOURCES);
fs.mkdirSync(OUT, { recursive: true });

const mb = (b: number) => (b / 1048576).toFixed(1);
const origOf = (id: string) => {
  const f = manifest[id] && path.join(ORIGINALS, manifest[id].file);
  return f && fs.existsSync(f) ? f : null;
};
const withOrig = sources.photos.filter((p) => origOf(p.id));
const load = (file: string) => sharp(file, { failOn: 'none' }).rotate(); // rotate() — учесть поворот из EXIF
/** ширина фото на весь экран; 0 — отдельной версии не нужно, хватит 1200 */
const fullWidth = (orig: number, w: number) => (Math.min(orig, w) > 1300 ? Math.min(orig, w) : 0);
const encodeFull = (file: string, w: number, q: number) => load(file).resize({ width: w, withoutEnlargement: true }).webp({ quality: q });

// ---------- 0. AVIF от прошлых запусков больше не нужен (иначе он съел бы место при подсчёте) ----------
let removed = 0;
for (const f of fs.readdirSync(OUT)) {
  if (f.endsWith('.avif')) {
    fs.unlinkSync(path.join(OUT, f));
    removed++;
  }
}

// ---------- 1. версии для буклета ----------
let made = 0;
const widthOf = new Map<string, number>();
const heightOf = new Map<string, number>();
for (const p of withOrig) {
  const orig = origOf(p.id)!;
  const { width = 0, height = 0 } = await load(orig).metadata();
  widthOf.set(p.id, width);
  heightOf.set(p.id, height);
  for (const w of BOOKLET) {
    const ww = Math.min(w, width);
    const dst = path.join(OUT, `${p.id}-${w}.webp`);
    if (fs.existsSync(dst) && fs.statSync(dst).mtimeMs >= fs.statSync(orig).mtimeMs) continue;
    await load(orig).resize({ width: ww, withoutEnlargement: true }).webp({ quality: Q_BOOKLET[w] }).toFile(dst);
    made++;
  }
  process.stdout.write(`  буклет: ${made} новых файлов\r`);
}

// ---------- 2. сколько места остаётся на фото «на весь экран» ----------
const sizeOf = (dir: string): number =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce((s, e) => {
    const f = path.join(dir, e.name);
    return s + (e.isDirectory() ? sizeOf(f) : fs.statSync(f).size);
  }, 0);
const isFullFile = (name: string) => {
  const m = /^(.+)-(\d+)\.(webp|avif)$/.exec(name);
  return !!m && Number(m[2]) > 1200 && withOrig.some((p) => p.id === m[1]);
};
const fullNow = fs.readdirSync(OUT).filter(isFullFile).reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0);
const budget = LIMIT_TOTAL - RESERVE - (sizeOf(PUBLIC) - fullNow);

const stamp = fs.existsSync(STAMP) ? readJson<{ w: number; q: number }>(STAMP) : null;
let pick = FULL[FULL.length - 1];
// уже выбранный вариант оставляем, пока он помещается: добавили пару фото — не пересжимаем все 560
let keepStamp = false;
if (stamp) {
  let have = 0;
  let haveN = 0;
  let missing = 0;
  for (const p of withOrig) {
    const fw = fullWidth(widthOf.get(p.id)!, stamp.w);
    if (!fw) continue;
    const f = path.join(OUT, `${p.id}-${fw}.webp`);
    if (fs.existsSync(f)) {
      have += fs.statSync(f).size;
      haveN++;
    } else missing++;
  }
  const estimate = have + (haveN ? have / haveN : 0) * missing;
  keepStamp = haveN > 0 && estimate <= budget;
  if (keepStamp) {
    pick = { w: stamp.w, q: stamp.q };
    console.log(`\n  оставляем ${stamp.w} px, качество ${stamp.q}: ≈ ${mb(estimate)} МБ (можно ${mb(budget)} МБ)`);
  }
}
// оценка по выборке: 30 фото, равномерно по списку
const sample = withOrig.filter((_, i) => i % Math.max(1, Math.floor(withOrig.length / 30)) === 0).slice(0, 30);
for (const v of keepStamp ? [] : FULL) {
  let bytes = 0;
  for (const p of sample) {
    const w = fullWidth(widthOf.get(p.id)!, v.w);
    if (w) bytes += (await encodeFull(origOf(p.id)!, w, v.q).toBuffer()).length;
  }
  const estimate = (bytes / Math.max(1, sample.length)) * withOrig.length;
  console.log(`\n  вариант ${v.w} px, качество ${v.q}: ≈ ${mb(estimate)} МБ (можно ${mb(budget)} МБ)`);
  if (estimate <= budget) { // неточность оценки по выборке покрывает запас RESERVE (12 МБ)
    pick = v;
    break;
  }
}
console.log(`Фото на весь экран: ${pick.w} px, качество ${pick.q}.`);

// ---------- 3. версии на весь экран + запись в sources.json ----------
const redo = !stamp || stamp.w !== pick.w || stamp.q !== pick.q;
const keep = new Set<string>(['fullscreen.json']);
for (const p of withOrig) {
  const orig = origOf(p.id)!;
  const width = widthOf.get(p.id)!;
  const height = heightOf.get(p.id)!;
  const files: Record<string, string> = {};
  const sizes: number[] = [];
  for (const w of BOOKLET) {
    files[String(w)] = `img/${p.id}-${w}.webp`;
    sizes.push(w);
  }
  const fw = fullWidth(width, pick.w);
  if (fw) {
    const rel = `img/${p.id}-${fw}.webp`;
    const dst = path.join(PUBLIC, rel);
    if (redo || !fs.existsSync(dst) || fs.statSync(dst).mtimeMs < fs.statSync(orig).mtimeMs) {
      await encodeFull(orig, fw, pick.q).toFile(dst);
      made++;
    }
    files[String(fw)] = rel;
    sizes.push(fw);
  }
  for (const f of Object.values(files)) keep.add(path.basename(f));
  const max = Math.max(...sizes);
  const real = Math.min(max, width); // 1200 у маленького оригинала может быть меньше
  Object.assign(p, { sizes, files, w: real, h: Math.round((height * real) / width) });
  delete p.avif;
  process.stdout.write(`  на весь экран: ${made} новых файлов\r`);
}
writeJson(STAMP, pick);

// удаляем версии от прошлых вариантов «на весь экран»
for (const f of fs.readdirSync(OUT)) {
  if (fs.statSync(path.join(OUT, f)).isDirectory() || keep.has(f)) continue;
  const m = /^(.+)-\d+\.(webp|avif)$/.exec(f);
  if (m && withOrig.some((p) => p.id === m[1])) {
    fs.unlinkSync(path.join(OUT, f));
    removed++;
  }
}

// старые фото без оригинала: только размер самого большого файла (нужен просмотру на весь экран)
for (const p of sources.photos) {
  if (origOf(p.id) || !Object.keys(p.files).length) continue;
  const big = String(Math.max(...Object.keys(p.files).map(Number)));
  const m = await sharp(path.join(PUBLIC, p.files[big])).metadata();
  p.w = m.width;
  p.h = m.height;
}
writeJson(SOURCES, sources);

// ---------- 4. лимиты хостинга ----------
let total = 0;
const big: string[] = [];
const walk = (dir: string) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f);
    else {
      const size = fs.statSync(f).size;
      total += size;
      if (size > LIMIT_FILE) big.push(path.relative(ROOT, f));
    }
  }
};
walk(PUBLIC);
console.log(`\nФото: ${sources.photos.length}, из них крупных с Commons: ${withOrig.length}. Новых файлов: ${made}, удалено лишних: ${removed}.`);
console.log(`Папка public/ (всё, что уходит на хостинг): ${mb(total)} МБ из ${mb(LIMIT_TOTAL)}.`);
if (big.length) console.error(`✖ Файлы больше 16 МБ: ${big.join(', ')}`);
if (total > LIMIT_TOTAL) console.error('✖ Превышен общий лимит: добавьте в FULL вариант полегче или снизьте Q_BOOKLET.');
if (big.length || total > LIMIT_TOTAL) process.exit(1);
