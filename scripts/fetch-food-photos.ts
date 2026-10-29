// Фото блюд для раздела «Кухня» (696 блюд у 174 стран).
//
//   npm run fetch:food            — найти, скачать и подключить фото; повторный запуск доделывает начатое
//   npm run fetch:food -- --dry   — только найти и показать сетку, ничего не подключать
//
// Как ищем: статья русской Википедии с названием блюда → её главное фото (Википедия отдаёт только свободные,
// pilicense=free) → сведения с Commons: автор, лицензия; карты, флаги и рисунки отбрасываем.
// Название статьи должно начинаться так же, как блюдо, — иначе поиск мог найти что-то постороннее.
//
// Фото маленькие: WebP шириной 400 px (≈15 КБ). В карточке блюда миниатюра 128 px, а места на сайте мало:
// лимит хостинга 256 МБ, занято ≈241 МБ.
//
// Итог: public/img/food/*.webp, записи в content/sources.json, id фото в content/enrich/<КОД>.json
// (затем npm run extract переносит в content/countries). Сетка на проверку — reports/food-photos.html.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { commonsUrl, isFreeLicense, readJson, ROOT, SOURCES, writeJson, type Sources } from './lib/photos.ts';

const UA = 'AtlasGuide/2.0 (https://github.com/daniyarmuhametzhanov/atlas) node-fetch';
const PAUSE_MS = 700;
const WIDTH = 400;
const ENRICH = path.join(ROOT, 'content/enrich');
const OUT = path.join(ROOT, 'public/img/food');
const CACHE_DIR = path.join(ROOT, 'assets-src/food');
const CACHE = path.join(CACHE_DIR, 'found.json');
const DRY = process.argv.includes('--dry');
/** --limit=20 — только первые N блюд (пробный запуск) */
const LIMIT = Number(/--limit=(\d+)/.exec(process.argv.join(' '))?.[1] ?? Infinity);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function getJson<T>(url: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
    await sleep(PAUSE_MS);
    if ((res.status === 429 || res.status === 503) && attempt < 6) {
      await sleep(Number(res.headers.get('retry-after') ?? 10) * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.json() as Promise<T>;
  }
}
const api = <T>(host: string, params: Record<string, string>) =>
  getJson<T>(`https://${host}/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params })}`);

const TR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};
const slug = (s: string) =>
  s.toLowerCase().replace(/[а-яё]/g, (c) => TR[c] ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const plain = (html = '') => html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();

/**
 * Статья подходит, если в её названии есть первое слово блюда (без последних букв — падежи, число).
 * start — слово должно стоять первым (поиск по части названия: «Бобы с бананами» не должен найти «Мармеладные бобы»).
 */
function titleFits(dish: string, title: string, start = false): boolean {
  const w = norm(dish).split(' ')[0];
  const stem = w.length >= 6 ? w.slice(0, -2) : w.length >= 4 ? w.slice(0, -1) : w;
  const words = norm(title).split(' ');
  return start ? words[0].startsWith(stem) : words.some((t) => t.startsWith(stem));
}

const REJECT = /\b(map|karte|carte|flag|coat of arms|wappen|diagram|logo|stamp|banknote|coin|locator|svg|drawing|illustration|portrait|signature)\b/i;

type Found = { file: string; article: string } | null;

/** Статьи о людях в Википедии называются «Фамилия, Имя»: «Рис-Майерс, Джонатан» нашёлся для блюд с рисом */
const isPerson = (title: string) => /^[^,(]+, [^,]+$/.test(title);

/**
 * Отклонено по сетке reports/food-photos.html (29.10.2026): фото не про блюдо.
 * Ключ — «КОД|блюдо», как в content/enrich.
 */
const REJECTED = new Set([
  'BEL|Мидии с картофелем фри', // пляж со сваями для мидий
  'IRL|«Гиннесс»', // логотип
  'KHM|Амок', // море
  'LSO|Мороко', // рыба
  'YEM|Сальта', // вид города Сальта
  'PRY|Тересе', // старинная гравюра
  'QAT|Карак', // непонятный предмет
  'RWA|Кофе и чай', // люди на приёме
  'ZMB|Капента', // рисунок рыбы
  'SDN|Кисра', // портрет
  'SSD|Кисра', // портрет
  'GBR|Чай с молоком', // стакан зелёного чая с листьями
  'FLK|Чай со сконами', // то же фото
]);
type Dish = { iso: string; country: string; countryEn: string; name: string };

/** Категории статьи про еду и питьё: иначе поиск находит однофамильцев («Манту» — учёный, «Кизак» — деревня) */
const FOOD = /кухн|блюд|напит|выпечк|десерт|хлеб|кофе|соус|закуск|алкогольн|пирог|кондитер|колбас|фрукт|овощ|пельмен|сладост|ликёр|водк|бренди|коньяк|ракия|коктейл|салат|приправ|пряност|специ|молочн|морепродукт|лапш|блин|торт|продукты питания|(?<!\p{L})(?:сыр|суп|чай(?!\p{L})|вин[оа](?!\p{L})|пив[оа](?!\p{L})|еда(?!\p{L}))/iu;

/** Главное свободное фото статьи русской Википедии про блюдо */
async function findOnWiki(d: Dish): Promise<Found> {
  // «Хумус и мутабаль», «Финики с кофе» — ещё попытка по первой части
  const first = d.name.split(/\s+(?:и|с|со)\s+|,\s*/)[0];
  const queries = [...new Set([d.name, `${d.name} блюдо`, first, `${first} блюдо`])];
  for (const q of queries) {
    const r = await api<{ query?: { pages?: { title: string; index: number; pageimage?: string; categories?: { title: string }[] }[] } }>('ru.wikipedia.org', {
      action: 'query', generator: 'search', gsrsearch: q, gsrlimit: '5', gsrnamespace: '0',
      prop: 'pageimages|categories', piprop: 'name', pilicense: 'free', clshow: '!hidden', cllimit: 'max',
    });
    const pages = (r.query?.pages ?? []).sort((a, b) => a.index - b.index);
    const hit = pages.find(
      (p) =>
        p.pageimage &&
        !/\.svg$/i.test(p.pageimage) &&
        !isPerson(p.title) &&
        titleFits(first, p.title.replace(/\s*\(.*\)$/, ''), first !== d.name) &&
        (p.categories ?? []).some((c) => FOOD.test(c.title)),
    );
    if (hit) return { file: `File:${hit.pageimage!.replace(/_/g, ' ')}`, article: hit.title };
  }
  return null;
}

const FOOD_EN = /cuisine|dishes|foods?\b|drinks|beverages|breads?\b|desserts|soups|stews|snacks|pastr|cakes|sauces|condiments|salads|porridge|dumplings|noodles|rice|cheeses|sausages|liqueurs|spirits|wines?\b|beers?\b|teas?\b|coffee|street food|meat|fish|seafood|confectioner|flatbread|pancakes|fermented|alcoholic/i;
const ascii = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Запасной путь: английская Википедия по латинскому написанию («Кабули-пулао» → kabuli pulao) */
async function findOnEnWiki(d: Dish, countryEn: string): Promise<Found> {
  const first = d.name.split(/\s+(?:и|с|со)\s+|,\s*/)[0];
  const lat = slug(first).replace(/-/g, ' ');
  for (const q of [lat, `${lat} ${countryEn} cuisine`]) {
    const r = await api<{ query?: { pages?: { title: string; index: number; pageimage?: string; categories?: { title: string }[] }[] } }>('en.wikipedia.org', {
      action: 'query', generator: 'search', gsrsearch: q, gsrlimit: '5', gsrnamespace: '0',
      prop: 'pageimages|categories', piprop: 'name', pilicense: 'free', clshow: '!hidden', cllimit: 'max',
    });
    const pages = (r.query?.pages ?? []).sort((a, b) => a.index - b.index);
    // первые три буквы названия статьи совпадают с латинским написанием блюда — иначе это что-то другое
    const hit = pages.find(
      (p) =>
        p.pageimage &&
        !/\.svg$/i.test(p.pageimage) &&
        !isPerson(p.title) &&
        ascii(p.title).split(' ').some((t) => t.slice(0, 3) === lat.slice(0, 3)) &&
        (p.categories ?? []).some((c) => FOOD_EN.test(c.title)),
    );
    if (hit) return { file: `File:${hit.pageimage!.replace(/_/g, ' ')}`, article: `en: ${hit.title}` };
  }
  return null;
}

type Info = { author: string; license: string; title: string; width: number; height: number; thumb: string };
/** Сведения с Commons; null — файла нет на Commons (лежит в самой Википедии) или лицензия не подходит */
async function commonsInfo(files: string[]): Promise<Map<string, Info | null>> {
  const out = new Map<string, Info | null>();
  for (let i = 0; i < files.length; i += 50) {
    const r = await api<{ query?: { normalized?: { from: string; to: string }[]; pages?: { title: string; missing?: boolean; imageinfo?: { thumburl?: string; url: string; width: number; height: number; extmetadata?: Record<string, { value: string }> }[] }[] } }>(
      'commons.wikimedia.org',
      { action: 'query', titles: files.slice(i, i + 50).join('|'), prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '500', iiextmetadatafilter: 'Artist|LicenseShortName|ObjectName|Categories' },
    );
    const back = new Map((r.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const p of r.query?.pages ?? []) {
      const key = back.get(p.title) ?? p.title;
      const ii = p.imageinfo?.[0];
      if (!ii || p.missing) {
        out.set(key, null);
        continue;
      }
      const m = (k: string) => plain(ii.extmetadata?.[k]?.value);
      const license = m('LicenseShortName');
      const bad = !isFreeLicense(license) || REJECT.test(p.title) || REJECT.test(m('Categories')) || ii.width < 300;
      out.set(key, bad ? null : {
        author: m('Artist') || 'неизвестен', license, title: m('ObjectName') || p.title.replace(/^File:|\.\w+$/g, ''),
        width: ii.width, height: ii.height, thumb: ii.thumburl ?? ii.url,
      });
    }
    process.stdout.write(`  Commons: ${Math.min(i + 50, files.length)} / ${files.length}\r`);
  }
  process.stdout.write('\n');
  return out;
}

async function main() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  const index = readJson<{ id: string; name: string; nameEn: string }[]>(path.join(ROOT, 'content/countries-index.json'));
  const byIso = new Map(index.map((c) => [c.id, c]));
  const dishes: Dish[] = [];
  for (const f of fs.readdirSync(ENRICH).sort()) {
    const iso = f.replace(/\.json$/, '');
    const e = readJson<{ tourist?: { food?: { name: string }[] } }>(path.join(ENRICH, f));
    for (const d of e.tourist?.food ?? []) dishes.push({ iso, country: byIso.get(iso)?.name ?? iso, countryEn: byIso.get(iso)?.nameEn ?? '', name: d.name });
  }
  dishes.splice(LIMIT);
  console.log(`Блюд: ${dishes.length}`);

  // 1. поиск статей (кэш: повторный запуск не спрашивает Википедию заново)
  const cache: Record<string, Found> = fs.existsSync(CACHE) ? readJson(CACHE) : {};
  // найденное раньше по старым правилам: статьи о людях ищем заново
  for (const [k, v] of Object.entries(cache)) if (v && isPerson(v.article)) delete cache[k];
  let n = 0;
  for (const d of dishes) {
    const key = `${d.iso}|${d.name}`;
    if (!(key in cache)) {
      cache[key] = (await findOnWiki(d)) ?? (await findOnEnWiki(d, d.countryEn));
      if (++n % 10 === 0) writeJson(CACHE, cache);
    }
    process.stdout.write(`  Википедия: ${Object.keys(cache).length} / ${dishes.length}\r`);
  }
  writeJson(CACHE, cache);
  process.stdout.write('\n');

  // 2. автор и лицензия с Commons
  const files = [...new Set(Object.values(cache).filter(Boolean).map((x) => x!.file))];
  const info = await commonsInfo(files);

  // 3. скачать, сжать, подключить
  const sources = readJson<Sources>(SOURCES);
  const byUrl = new Map(sources.photos.map((p) => [p.url, p]));
  const ids = new Set(sources.photos.map((p) => p.id));
  const rows: { d: Dish; article?: string; id?: string; why?: string; info?: Info }[] = [];
  const photoOf = new Map<string, string>(); // `${iso}|${блюдо}` → id фото
  let bytes = 0;
  for (const d of dishes) {
    const f = REJECTED.has(`${d.iso}|${d.name}`) ? null : cache[`${d.iso}|${d.name}`];
    if (REJECTED.has(`${d.iso}|${d.name}`)) {
      rows.push({ d, why: 'отклонено при проверке сетки' });
      continue;
    }
    if (!f) {
      rows.push({ d, why: 'статья с фото не найдена' });
      continue;
    }
    const ii = info.get(f.file);
    if (!ii) {
      rows.push({ d, article: f.article, why: 'фото не на Commons или не та лицензия' });
      continue;
    }
    const url = commonsUrl(f.file);
    let id = byUrl.get(url)?.id;
    if (!id) {
      // имя файла латиницей; у названий из одних иероглифов латиницы нет — тогда короткий отпечаток адреса
      const name = slug(f.file.replace(/^File:|\.\w+$/g, '')).slice(0, 40).replace(/-+$/, '');
      const base = `food-${name || createHash('md5').update(url).digest('hex').slice(0, 8)}`;
      id = base;
      for (let k = 2; ids.has(id); k++) id = `${base}-${k}`;
      ids.add(id);
    }
    const rel = `img/food/${id}-${WIDTH}.webp`;
    const out = path.join(ROOT, 'public', rel);
    if (!DRY && !fs.existsSync(out)) {
      const res = await fetch(ii.thumb, { headers: { 'User-Agent': UA } });
      await sleep(PAUSE_MS);
      if (!res.ok) {
        rows.push({ d, article: f.article, why: `не скачалось (${res.status})` });
        continue;
      }
      await sharp(Buffer.from(await res.arrayBuffer())).rotate().resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: 66 }).toFile(out);
    }
    if (!DRY) {
      bytes += fs.statSync(out).size;
      if (!byUrl.has(url)) {
        const m = await sharp(out).metadata();
        const p = { id, title: ii.title, author: ii.author, license: ii.license, url, sizes: [WIDTH], files: { [WIDTH]: rel }, w: m.width, h: m.height };
        sources.photos.push(p);
        byUrl.set(url, p);
      }
    }
    photoOf.set(`${d.iso}|${d.name}`, id);
    rows.push({ d, article: f.article, id, info: ii });
    process.stdout.write(`  фото: ${photoOf.size}, ${(bytes / 1048576).toFixed(1)} МБ\r`);
  }
  process.stdout.write('\n');

  if (!DRY) {
    // фото блюд, которые больше ни к чему не подключены, — из списка источников и с диска
    const used = new Set(photoOf.values());
    for (const p of sources.photos.filter((x) => x.id.startsWith('food-') && !used.has(x.id))) {
      for (const f of Object.values(p.files)) fs.rmSync(path.join(ROOT, 'public', f), { force: true });
      console.log(`  убрано фото ${p.id}`);
    }
    sources.photos = sources.photos.filter((x) => !x.id.startsWith('food-') || used.has(x.id));
    writeJson(SOURCES, sources);
    for (const f of fs.readdirSync(ENRICH)) {
      const iso = f.replace(/\.json$/, '');
      const file = path.join(ENRICH, f);
      const e = readJson<{ tourist?: { food?: { name: string; photo?: string }[] } }>(file);
      if (!e.tourist?.food) continue;
      e.tourist.food = e.tourist.food.map((x) => {
        const id = photoOf.get(`${iso}|${x.name}`);
        if (id) return { ...x, photo: id };
        // фото было, но его отклонили — убираем
        const rest: { name: string; photo?: string } = { ...x };
        delete rest.photo;
        return rest;
      });
      writeJson(file, e);
    }
  }

  // 4. сетка на проверку
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' }[c]};`);
  const ok = rows.filter((r) => r.id);
  const html = `<!doctype html><meta charset="utf-8"><title>Фото блюд на проверку</title>
<style>body{font:14px system-ui;margin:16px;background:#f7f2e8}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
figure{margin:0;background:#fff;border-radius:8px;overflow:hidden}img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}figcaption{padding:6px 8px;font-size:12px}
td{padding:2px 8px}</style>
<h1>Фото блюд: найдено ${ok.length} из ${rows.length}</h1>
<p>Если фото не подходит — напишите блюдо и страну, фото уберём или заменим. Статья — откуда взято фото.</p>
<div class="g">${ok.map((r) => `<figure><img src="../public/img/food/${r.id}-${WIDTH}.webp" loading="lazy" alt=""><figcaption><b>${esc(r.d.name)}</b> · ${esc(r.d.country)}<br>статья «${esc(r.article!)}»<br>${esc(r.info!.author)} · ${esc(r.info!.license)}</figcaption></figure>`).join('')}</div>
<h2>Без фото: ${rows.length - ok.length}</h2><table>${rows.filter((r) => !r.id).map((r) => `<tr><td>${esc(r.d.country)}</td><td>${esc(r.d.name)}</td><td>${esc(r.why!)}${r.article ? ` («${esc(r.article)}»)` : ''}</td></tr>`).join('')}</table>`;
  fs.writeFileSync(path.join(ROOT, 'reports/food-photos.html'), html);
  console.log(`Готово: фото у ${ok.length} блюд из ${rows.length}, ${(bytes / 1048576).toFixed(1)} МБ. Сетка: reports/food-photos.html`);
}

await main();
