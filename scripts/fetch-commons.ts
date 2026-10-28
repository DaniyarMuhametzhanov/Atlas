// Работа с Wikimedia Commons. Три режима:
//
//   npm run fetch:commons            — для каждого фото из content/sources.json скачать миниатюру 1920 px
//                                      (или 1280 / 960, если оригинал меньше) в assets-src/commons/.
//                                      Отчёт: reports/commons-download.md
//   npm run fetch:commons -- --verify — сверить автора и лицензию через API (reports/commons-check.md)
//   npm run fetch:commons -- --search — найти фото для мест без фото (список в content/photo-wanted.json).
//                                      Итог: reports/commons-candidates.html — сетка на проверку владельцу.
//   npm run fetch:commons -- --apply  — подключить выбранные фото из content/photo-picks.json
//                                      (заполняется вручную по сетке), затем скачать их.
//
// Вежливость к Commons: User-Agent с адресом проекта, запросы по одному с паузой, maxlag.
// Уже скачанные файлы повторно не качаются.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {
  ORIGINALS, PICKS, ROOT, SOURCES, applyPicks, commonsTitle, commonsUrl, isFreeLicense, readJson, writeJson,
  type Pick, type Sources,
} from './lib/photos.ts';

// Node 22 не ходит через прокси из HTTPS_PROXY, пока не задано NODE_USE_ENV_PROXY=1 (так в облачной среде).
// На обычном компьютере прокси нет — ничего не меняется.
if (process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' },
  });
  process.exit(r.status ?? 1);
}

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'AtlasGuide/2.0 (https://github.com/daniyarmuhametzhanov/atlas) node-fetch';
const PAUSE_MS = 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
    } catch (e) {
      throw new Error(`Нет связи с ${new URL(url).host}: ${(e as Error).message}`);
    }
    // 429 / 503 — сервер просит подождать; maxlag тоже отвечает ошибкой с Retry-After
    if ((res.status === 429 || res.status === 503) && attempt < 5) {
      await sleep(Number(res.headers.get('retry-after') ?? 5) * 1000);
      continue;
    }
    if (res.status === 403) throw new Error(`403 от ${new URL(url).host} — доступ закрыт`);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res;
  }
}

type ImageInfo = {
  url: string;
  thumburl?: string;
  width: number;
  height: number;
  thumbwidth?: number;
  thumbheight?: number;
  extmetadata?: Record<string, { value: string }>;
};
type Page = { title: string; missing?: boolean; imageinfo?: ImageInfo[] };

async function api(params: Record<string, string>): Promise<{ query?: { pages?: Page[]; search?: { title: string }[] } }> {
  const q = new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params });
  const res = await get(`${API}?${q}`);
  await sleep(PAUSE_MS);
  return res.json();
}

/** Сведения о файлах, по 50 штук за запрос (больше API не принимает) */
async function imageInfo(titles: string[], width: number): Promise<Map<string, Page>> {
  const out = new Map<string, Page>();
  for (let i = 0; i < titles.length; i += 50) {
    const r = await api({
      action: 'query', titles: titles.slice(i, i + 50).join('|'), prop: 'imageinfo',
      iiprop: 'url|size|extmetadata', iiurlwidth: String(width),
      iiextmetadatafilter: 'Artist|LicenseShortName|ObjectName|Categories|ImageDescription',
    });
    for (const p of r.query?.pages ?? []) out.set(p.title, p);
    process.stdout.write(`  сведения: ${Math.min(i + 50, titles.length)} / ${titles.length}\r`);
  }
  process.stdout.write('\n');
  return out;
}

/** Текст без HTML-тегов: в extmetadata автор часто записан ссылкой */
const plain = (html = '') => html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();
const meta = (ii: ImageInfo, key: string) => plain(ii.extmetadata?.[key]?.value);
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// ---------- режим 1: скачать ----------
// API Commons с облачных адресов часто отвечает 429, поэтому файлы берём без него — готовыми миниатюрами
// стандартных ширин с upload.wikimedia.org. Адрес считается из имени файла:
//   thumb/{md5[0]}/{md5[0..1]}/{имя}/{ширина}px-{имя}
// 2000 px — нестандартная ширина (сервер отвечает 400), берём 1920. Если оригинал меньше — 1280, затем 960.
const THUMB_WIDTHS = [1920, 1280, 960];
const MAX_PASSES = 8;

function thumbUrl(title: string, width: number): string {
  const name = title.replace(/^File:/, '').replace(/ /g, '_');
  const md5 = createHash('md5').update(name).digest('hex');
  const enc = encodeURIComponent(name);
  const base = `https://upload.wikimedia.org/wikipedia/commons/thumb/${md5[0]}/${md5.slice(0, 2)}/${enc}`;
  // у TIFF и PDF миниатюра — JPEG первой страницы: …/lossy-page1-1920px-Имя.tiff.jpg
  if (/\.(tiff?|pdf)$/i.test(name)) return `${base}/lossy-page1-${width}px-${enc}.jpg`;
  return `${base}/${width}px-${enc}`;
}

type Manifest = Record<string, { file: string; width: number; height: number }>;

async function download(sources: Sources) {
  fs.mkdirSync(ORIGINALS, { recursive: true });
  const manifestFile = path.join(ORIGINALS, 'manifest.json');
  const manifest: Manifest = fs.existsSync(manifestFile) ? readJson(manifestFile) : {};
  let todo = sources.photos.filter((p) => !manifest[p.id] || !fs.existsSync(path.join(ORIGINALS, manifest[p.id].file)));
  console.log(`Фото в sources.json: ${sources.photos.length}, нужно скачать: ${todo.length}`);
  const missing: string[] = [];
  let bytes = 0;
  let got = 0;
  for (let pass = 1; pass <= MAX_PASSES && todo.length; pass++) {
    const later: typeof todo = [];
    for (const p of todo) {
      const title = commonsTitle(p.url);
      let done = false;
      let limited = false;
      for (const w of THUMB_WIDTHS) {
        const res = await fetch(thumbUrl(title, w), { headers: { 'User-Agent': UA } }).catch(() => null);
        await sleep(PAUSE_MS);
        if (!res) {
          limited = true;
          break;
        }
        if (res.status === 429) {
          // сервер просит подождать — ждём сколько сказано и откладываем фото на следующий проход
          await sleep(Math.max(10, Number(res.headers.get('retry-after') ?? 10)) * 1000);
          limited = true;
          break;
        }
        if (!res.ok) continue; // 400/404 — такой ширины нет (оригинал меньше), пробуем меньшую
        const buf = Buffer.from(await res.arrayBuffer());
        const file = `${p.id}.jpg`;
        fs.writeFileSync(path.join(ORIGINALS, file), buf);
        const m = await sharp(buf).metadata();
        manifest[p.id] = { file, width: m.width ?? w, height: m.height ?? 0 };
        bytes += buf.length;
        got++;
        done = true;
        break;
      }
      if (!done && limited) later.push(p);
      else if (!done) missing.push(`| ${p.id} | нет миниатюры 960 px и больше (файл удалён, переименован или слишком мал) | ${p.url} |`);
      if (got % 10 === 0) writeJson(manifestFile, manifest); // чтобы обрыв не терял сделанное
      process.stdout.write(`  проход ${pass}: скачано ${got}, отложено ${later.length}, ${(bytes / 1048576).toFixed(0)} МБ\r`);
    }
    writeJson(manifestFile, manifest);
    console.log(`\nПроход ${pass}: осталось ${later.length}`);
    todo = later;
  }
  for (const p of todo) missing.push(`| ${p.id} | не скачано: сервер ${MAX_PASSES} раз ответил «слишком много запросов» | ${p.url} |`);
  fs.writeFileSync(
    path.join(ROOT, 'reports/commons-download.md'),
    `# Скачивание фото с Wikimedia Commons\n\nСкачано за этот запуск: ${got}. Всего в папке: ${Object.keys(manifest).length} из ${sources.photos.length}. Не скачано: ${missing.length}.\n\n` +
      (missing.length ? `| id | почему | страница |\n|---|---|---|\n${missing.join('\n')}\n` : ''),
  );
  console.log(`Готово. Не скачано: ${missing.length} (reports/commons-download.md). Повторный запуск докачает отложенные.`);
}

// ---------- режим 1б: сверить автора и лицензию через API (--verify) ----------
async function verify(sources: Sources) {
  const info = await imageInfo(sources.photos.map((p) => commonsTitle(p.url)), 960);
  const problems: string[] = [];
  for (const p of sources.photos) {
    const ii = info.get(commonsTitle(p.url))?.imageinfo?.[0];
    if (!ii) {
      problems.push(`| ${p.id} | файл не найден на Commons (удалён или переименован) | ${p.url} |`);
      continue;
    }
    const author = meta(ii, 'Artist');
    const license = meta(ii, 'LicenseShortName');
    if (!isFreeLicense(license)) problems.push(`| ${p.id} | лицензия на Commons «${license}» — не из разрешённых | ${p.url} |`);
    if (norm(license) !== norm(p.license)) problems.push(`| ${p.id} | лицензия: у нас «${p.license}», на Commons «${license}» | ${p.url} |`);
    if (author && !norm(author).includes(norm(p.author)) && !norm(p.author).includes(norm(author)))
      problems.push(`| ${p.id} | автор: у нас «${p.author}», на Commons «${author}» | ${p.url} |`);
  }
  fs.writeFileSync(
    path.join(ROOT, 'reports/commons-check.md'),
    `# Сверка фото с Wikimedia Commons\n\nПроверено: ${sources.photos.length}. Замечаний: ${problems.length}.\n\n` +
      (problems.length ? `| id | что не так | страница |\n|---|---|---|\n${problems.join('\n')}\n` : 'Всё совпало.\n'),
  );
  console.log(`Сверка: замечаний ${problems.length} (reports/commons-check.md)`);
}

// ---------- режим 2: поиск недостающих ----------
type Candidate = Pick & { thumb: string; size: string };
type Wanted = { target: string; label: string; query: string };
/** Отбраковка по названию и категориям: карты, флаги, схемы, гербы, гравюры, логотипы, марки, деньги */
const REJECT = /\b(map|karte|carte|flag|coat of arms|wappen|diagram|scheme|logo|engraving|gravure|lithograph|stamp|banknote|coin|locator|svg|drawing|illustration|portrait)\b/i;

async function search() {
  const wanted = readJson<Wanted[]>(path.join(ROOT, 'content/photo-wanted.json'));
  const result: { target: string; label: string; candidates: Candidate[] }[] = [];
  for (const w of wanted) {
    const r = await api({ action: 'query', list: 'search', srnamespace: '6', srlimit: '30', srsearch: `${w.query} filetype:bitmap` });
    const titles = (r.query?.search ?? []).map((x) => x.title).filter((t) => !REJECT.test(t));
    const info = await imageInfo(titles, 480);
    const good: Candidate[] = [];
    for (const t of titles) {
      const ii = info.get(t)?.imageinfo?.[0];
      if (!ii) continue;
      const license = meta(ii, 'LicenseShortName');
      const cats = meta(ii, 'Categories');
      const ratio = ii.width / ii.height;
      if (!isFreeLicense(license) || REJECT.test(cats) || ii.width < 1600 || ratio < 1.2 || ratio > 2.4) continue;
      good.push({
        target: w.target, id: '', title: meta(ii, 'ObjectName') || t.replace(/^File:|\.\w+$/g, ''),
        author: meta(ii, 'Artist') || 'неизвестен', license, url: commonsUrl(t), thumb: ii.thumburl ?? ii.url,
        size: `${ii.width}×${ii.height}`,
      });
      if (good.length === 6) break;
    }
    console.log(`${w.label}: ${good.length} подходящих`);
    result.push({ target: w.target, label: w.label, candidates: good });
  }
  writeJson(path.join(ROOT, 'reports/commons-candidates.json'), result);
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' }[c]};`);
  const html = `<!doctype html><meta charset="utf-8"><title>Фото на проверку</title>
<style>body{font:14px system-ui;margin:16px;background:#f7f2e8}h2{margin:24px 0 8px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
figure{margin:0;background:#fff;border-radius:8px;overflow:hidden}img{width:100%;aspect-ratio:2/1;object-fit:cover;display:block}figcaption{padding:6px 8px;font-size:12px}</style>
<h1>Найденные фото — выберите по одному на каждое место</h1>
${result.map((r) => `<h2>${esc(r.label)} <small>(${esc(r.target)})</small></h2><div class="g">${
    r.candidates.length
      ? r.candidates.map((c, i) => `<figure><img src="${esc(String(c.thumb))}" loading="lazy" alt=""><figcaption><b>${i + 1}.</b> ${esc(c.title)}<br>${esc(c.author)} · ${esc(c.license)}<br><a href="${esc(c.url)}">страница на Commons</a></figcaption></figure>`).join('')
      : '<p>Ничего подходящего — нужен другой запрос.</p>'
  }</div>`).join('\n')}`;
  fs.writeFileSync(path.join(ROOT, 'reports/commons-candidates.html'), html);
  console.log('Сетка: reports/commons-candidates.html. Выбранные — в content/photo-picks.json, затем --apply.');
}

// ---------- запуск ----------
const sources = readJson<Sources>(SOURCES);
try {
  if (process.argv.includes('--search')) await search();
  else if (process.argv.includes('--verify')) await verify(sources);
  else {
    if (process.argv.includes('--apply')) {
      if (!fs.existsSync(PICKS)) throw new Error('Нет content/photo-picks.json — сначала --search и выбор владельца');
      console.log(`Подключено выбранных фото: ${applyPicks(sources)}`);
      writeJson(SOURCES, sources);
    }
    await download(sources);
  }
} catch (e) {
  console.error(`\n✖ ${(e as Error).message}`);
  process.exit(2);
}
