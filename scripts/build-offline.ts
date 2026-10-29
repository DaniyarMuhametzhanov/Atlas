// Версия без интернета: один HTML-файл dist-offline/atlas.html, который открывается двойным щелчком с диска.
//
//   npm run build:offline
//
// 1. Vite собирает сайт в режиме offline: код, стили и шрифты интерфейса — внутри index.html (vite-plugin-singlefile).
// 2. Этот скрипт дописывает в страницу все файлы из public/ как текст base64: window.__ATLAS_ASSETS = { путь: содержимое }.
//    Сайт берёт их через src/lib/asset.ts вместо запросов к серверу.
// Фото — только 480 и 1200 px (как в задании) и миниатюры блюд; версии 1600 px для просмотра на весь экран не берём.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT_DIR = path.join(ROOT, 'dist-offline');
const OUT = path.join(OUT_DIR, 'atlas.html');

/** Что не встраиваем: фото 1600 px и исходные значки мест (на сайте используются готовые круглые из img/badges) */
const SKIP = (rel: string) => /-1600\.webp$/.test(rel) || rel.startsWith('img/icons/');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
}

const r = spawnSync('npx vite build --mode offline', { cwd: ROOT, stdio: 'inherit', shell: true });
if (r.status !== 0) process.exit(r.status ?? 1);

const html = fs.readFileSync(path.join(OUT_DIR, 'index.html'), 'utf8');
const at = html.lastIndexOf('</body>');
if (at < 0) throw new Error('В собранной странице нет </body>');

const files = walk(PUBLIC)
  .map((f) => path.relative(PUBLIC, f).split(path.sep).join('/'))
  .filter((rel) => !SKIP(rel))
  .sort();

// пишем потоком: файл получается больше 100 МБ, держать его целиком в памяти незачем
const out = fs.createWriteStream(OUT);
out.write(html.slice(0, at));
out.write('<script>window.__ATLAS_ASSETS={');
let bytes = 0;
for (const [i, rel] of files.entries()) {
  const buf = fs.readFileSync(path.join(PUBLIC, rel));
  bytes += buf.length;
  out.write(`${i ? ',' : ''}${JSON.stringify(rel)}:"${buf.toString('base64')}"\n`);
}
out.write('};</script>\n');
out.write(html.slice(at));
await new Promise<void>((ok, fail) => out.end((e?: Error | null) => (e ? fail(e) : ok())));
fs.rmSync(path.join(OUT_DIR, 'index.html'));

const mb = (n: number) => (n / 1048576).toFixed(1);
console.log(`Встроено файлов: ${files.length} (${mb(bytes)} МБ). Итог: dist-offline/atlas.html, ${mb(fs.statSync(OUT).size)} МБ`);
