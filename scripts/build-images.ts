// Готовит фото для сайта (sharp): из файлов, скачанных fetch-commons.ts в assets-src/commons/,
// делает WebP и AVIF шириной 480 / 1200 / 2000 px → public/img/<id>-<ширина>.webp|avif
// и записывает их в content/sources.json (sizes, files, avif, w, h).
// Больше исходника не растягиваем: если оригинал 1500 px, будут только 480 и 1200.
// У фото без оригинала остаются старые файлы (560 / 224 px), для них только записывается размер.
//
// Запуск: npm run build:images      (повторный запуск пропускает уже готовые файлы)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ORIGINALS, ROOT, SOURCES, readJson, writeJson, type Sources } from './lib/photos.ts';

const WIDTHS = [480, 1200, 2000];
// качество подобрано так, чтобы ~560 фото уложились в лимит хостинга
const QUALITY: Record<number, { webp: number; avif: number }> = {
  // ширина, которой нет в списке (например 1920), берёт качество ближайшей большей
  480: { webp: 78, avif: 55 },
  1200: { webp: 74, avif: 50 },
  2000: { webp: 70, avif: 45 },
};
const LIMIT_FILE = 16 * 1048576; // хостинг: один файл ≤ 16 МБ
const LIMIT_TOTAL = 256 * 1048576; // и всего ≤ 256 МБ
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(PUBLIC, 'img');

type Manifest = Record<string, { file: string }>;
const manifestFile = path.join(ORIGINALS, 'manifest.json');
const manifest: Manifest = fs.existsSync(manifestFile) ? readJson(manifestFile) : {};
const sources = readJson<Sources>(SOURCES);

let made = 0;
let fromCommons = 0;
for (const p of sources.photos) {
  const orig = manifest[p.id] && path.join(ORIGINALS, manifest[p.id].file);
  if (orig && fs.existsSync(orig)) {
    const img = sharp(orig, { failOn: 'none' }).rotate(); // rotate() — учесть поворот из EXIF
    const { width = 0, height = 0 } = await img.metadata();
    const widths = WIDTHS.filter((w) => w <= width);
    // исходник 1920 px (Commons не отдаёт 2000) — крупнейшей версией будет он сам
    if (!widths.length || (width < 2000 && width > widths[widths.length - 1] * 1.2)) widths.push(width);
    const files: Record<string, string> = {};
    const avif: Record<string, string> = {};
    for (const w of widths) {
      for (const fmt of ['webp', 'avif'] as const) {
        const rel = `img/${p.id}-${w}.${fmt}`;
        const dst = path.join(PUBLIC, rel);
        if (!fs.existsSync(dst) || fs.statSync(dst).mtimeMs < fs.statSync(orig).mtimeMs) {
          const q = QUALITY[WIDTHS.find((x) => x >= w) ?? 2000];
          const pipe = img.clone().resize({ width: w, withoutEnlargement: true });
          await (fmt === 'webp' ? pipe.webp({ quality: q.webp }) : pipe.avif({ quality: q.avif, effort: 4 })).toFile(dst);
          made++;
        }
        (fmt === 'webp' ? files : avif)[String(w)] = rel;
      }
    }
    const max = Math.max(...widths);
    p.sizes = widths;
    p.files = files;
    p.avif = avif;
    p.w = max;
    p.h = Math.round((height * max) / width);
    fromCommons++;
  } else if (Object.keys(p.files).length) {
    // старое фото: только размер самого большого файла (нужен просмотру на весь экран)
    const big = String(Math.max(...Object.keys(p.files).map(Number)));
    const m = await sharp(path.join(PUBLIC, p.files[big])).metadata();
    p.w = m.width;
    p.h = m.height;
  }
}
fs.mkdirSync(OUT, { recursive: true });
writeJson(SOURCES, sources);

// ---------- лимиты хостинга ----------
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
const mb = (b: number) => (b / 1048576).toFixed(1);
console.log(`Фото: ${sources.photos.length}, из них крупных с Commons: ${fromCommons}. Новых файлов: ${made}.`);
console.log(`Папка public/ (всё, что уходит на хостинг): ${mb(total)} МБ из ${mb(LIMIT_TOTAL)}.`);
if (big.length) console.error(`✖ Файлы больше 16 МБ: ${big.join(', ')}`);
if (total > LIMIT_TOTAL) console.error('✖ Превышен общий лимит: уменьшите QUALITY или уберите AVIF 2000.');
if (big.length || total > LIMIT_TOTAL) process.exit(1);
