// Общее для скриптов фото: чтение/запись content/sources.json и подключение выбранных фото к данным.
// Используют fetch-commons.ts, build-images.ts и extract-legacy.ts (чтобы повторное извлечение не стирало работу этапа 6).
import fs from 'node:fs';
import path from 'node:path';
import type { PhotoSource } from '../../src/content/schema.ts';

export const ROOT = path.resolve(import.meta.dirname, '../..');
export const CONTENT = path.join(ROOT, 'content');
export const SOURCES = path.join(CONTENT, 'sources.json');
export const PICKS = path.join(CONTENT, 'photo-picks.json');
/** Скачанные с Commons файлы (в git не попадают, см. .gitignore) */
export const ORIGINALS = path.join(ROOT, 'assets-src/commons');

export type Sources = { datasets: unknown[]; photos: PhotoSource[] };

/** Фото блюд готовит fetch-food-photos.ts (400 px); fetch-commons и build-images их не трогают */
export const isFoodPhoto = (p: { id: string }) => p.id.startsWith('food-');

export const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;
export const writeJson = (file: string, value: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
};

/** Имя файла на Commons из ссылки на его страницу: …/wiki/File:Abc_def.jpg → «File:Abc def.jpg» */
export function commonsTitle(url: string): string {
  const m = /\/wiki\/(File:.+)$/.exec(url);
  if (!m) throw new Error(`Не похоже на страницу файла Commons: ${url}`);
  return decodeURIComponent(m[1]).replace(/_/g, ' ');
}
export const commonsUrl = (title: string) => `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_')).replace(/%3A/g, ':')}`;

/** Разрешённые лицензии: CC0, CC BY, CC BY-SA, общественное достояние */
export function isFreeLicense(short: string): boolean {
  return /^(cc0|cc[- ]by(-sa)?[- ][\d.]+|public domain|pd\b|pd-)/i.test(short.trim());
}

/** Выбранное владельцем фото: куда его подключить */
export type Pick = {
  /** «cover:GNQ» · «sight:MYS:Пещеры Бату» · «place:kaz-ozero-balkhash» · «find:Смартфон» */
  target: string;
  id: string;
  title: string;
  author: string;
  license: string;
  url: string;
};

/**
 * Подключает выбранные фото: добавляет их в sources.json (если ещё нет) и прописывает id в данные.
 * Повторный запуск ничего не ломает.
 */
export function applyPicks(sources: Sources): number {
  if (!fs.existsSync(PICKS)) return 0;
  const picks = readJson<Pick[]>(PICKS);
  for (const p of picks) {
    const same = sources.photos.find((x) => x.id === p.id);
    if (same && same.url !== p.url) throw new Error(`Имя фото «${p.id}» уже занято другим файлом (${same.url}) — выберите другое`);
    if (!same) {
      // файлов пока нет — их сделает build-images.ts; до этого фото в sources.json есть, но без файлов не показывается
      sources.photos.push({ id: p.id, title: p.title, author: p.author, license: p.license, url: p.url, sizes: [], files: {} });
    }
    const [kind, a, b] = p.target.split(':');
    if (kind === 'cover' || kind === 'sight') {
      const file = path.join(CONTENT, `countries/${a}.json`);
      const c = readJson<{ photos: { cover?: string }; tourist: { sights: { name: string; photos?: string[] }[] } }>(file);
      if (kind === 'cover') c.photos.cover = p.id;
      else {
        const s = c.tourist.sights.find((x) => x.name === b);
        if (!s) throw new Error(`${p.target}: нет такого места`);
        s.photos = [p.id, ...(s.photos ?? []).filter((x) => x !== p.id)];
      }
      writeJson(file, c);
    } else if (kind === 'place') {
      const file = ['nature', 'reserves', 'wonders']
        .map((f) => path.join(CONTENT, `places/${f}.json`))
        .find((f) => readJson<{ id: string }[]>(f).some((x) => x.id === a));
      if (!file) throw new Error(`${p.target}: нет такого места`);
      writeJson(file, readJson<{ id: string; photo?: string }[]>(file).map((x) => (x.id === a ? { ...x, photo: p.id } : x)));
    } else if (kind === 'find') {
      const file = path.join(CONTENT, 'epochs/finds.json');
      const finds = readJson<{ title: string; photo?: string }[]>(file);
      if (!finds.some((x) => x.title === a)) throw new Error(`${p.target}: нет такой находки`);
      writeJson(file, finds.map((x) => (x.title === a ? { ...x, photo: p.id } : x)));
    } else throw new Error(`Непонятная цель: ${p.target}`);
  }
  return picks.length;
}

export const DROP = path.join(CONTENT, 'photo-drop.json');

/**
 * Убирает фото отовсюду — из источников, обложек, достопримечательностей, мест и находок (content/photo-drop.json):
 * лицензия не из списка задания (FAL, GFDL) или фото заменено другим. Старая версия атласа приносит их при каждом
 * извлечении, поэтому список применяется после applyPicks и keepBuilt. Возвращает, сколько фото убрано из источников.
 */
export function dropPhotos(sources: Sources): number {
  if (!fs.existsSync(DROP)) return 0;
  const drop = new Set(readJson<{ id: string }[]>(DROP).map((d) => d.id));
  const before = sources.photos.length;
  sources.photos = sources.photos.filter((p) => !drop.has(p.id));
  type C = { photos: { cover?: string; gallery?: string[] }; tourist: { sights: { photos?: string[] }[] } };
  for (const f of fs.readdirSync(path.join(CONTENT, 'countries'))) {
    const file = path.join(CONTENT, 'countries', f);
    const c = readJson<C>(file);
    const was = JSON.stringify(c);
    if (c.photos.cover && drop.has(c.photos.cover)) delete c.photos.cover;
    if (c.photos.gallery) c.photos.gallery = c.photos.gallery.filter((x) => !drop.has(x));
    for (const s of c.tourist.sights) {
      if (!s.photos) continue;
      s.photos = s.photos.filter((x) => !drop.has(x));
      if (!s.photos.length) delete s.photos;
    }
    if (JSON.stringify(c) !== was) writeJson(file, c);
  }
  for (const f of ['places/nature.json', 'places/reserves.json', 'places/wonders.json', 'epochs/finds.json']) {
    const file = path.join(CONTENT, f);
    const list = readJson<{ photo?: string }[]>(file);
    if (!list.some((x) => x.photo && drop.has(x.photo))) continue;
    writeJson(file, list.map((x) => {
      if (!x.photo || !drop.has(x.photo)) return x;
      const rest = { ...x };
      delete rest.photo;
      return rest;
    }));
  }
  return before - sources.photos.length;
}

/** Переносит из старого sources.json то, что сделал этап 6 (крупные файлы, размеры), в новый */
export function keepBuilt(fresh: PhotoSource[], old: PhotoSource[]): PhotoSource[] {
  const byId = new Map(old.map((p) => [p.id, p]));
  const freshIds = new Set(fresh.map((p) => p.id));
  const mapped = fresh.map((p) => {
    const o = byId.get(p.id);
    if (!o) return p;
    const size = o.w && o.h ? { w: o.w, h: o.h } : {};
    // файлы не из img/legacy/ сделал build-images.ts — их и оставляем
    const built = Object.values(o.files).some((f) => !f.startsWith('img/legacy/'));
    return built ? { ...p, sizes: o.sizes, files: o.files, ...(o.avif ? { avif: o.avif } : {}), ...size } : { ...p, ...size };
  });
  // фото, добавленные выбором владельца (их нет в старом атласе), со всеми сделанными файлами
  const added = old.filter((o) => !freshIds.has(o.id) && Object.keys(o.files).length > 0);
  return [...mapped, ...added];
}
