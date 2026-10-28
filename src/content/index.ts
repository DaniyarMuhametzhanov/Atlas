// Загрузка текстов из content/.
// Короткий список стран (код, название, регион, столица) грузится сразу — он нужен карте и поиску.
// Полный файл страны подгружается, только когда её открывают.
import type { Country, PhotoSource, RegionId } from './schema';
import sourcesJson from '../../content/sources.json';

export type CountryIndexItem = { id: string; name: string; nameEn: string; region: RegionId; capital: string };

import countriesIndex from '../../content/countries-index.json';

const full = import.meta.glob<Country>('../../content/countries/*.json', { import: 'default' });

export const COUNTRIES = countriesIndex as CountryIndexItem[];

export const COUNTRY_BY_ID = new Map(COUNTRIES.map((c) => [c.id, c]));

const cache = new Map<string, Promise<Country>>();
export function loadCountry(id: string): Promise<Country> {
  if (import.meta.env.DEV) {
    const fx = (window as unknown as { __atlasFixtures?: Record<string, Country> }).__atlasFixtures?.[id];
    if (fx) return Promise.resolve(fx);
  }
  const loader = full[`../../content/countries/${id}.json`];
  if (!loader) return Promise.reject(new Error(`Нет страны с кодом ${id}`));
  if (!cache.has(id)) cache.set(id, loader());
  return cache.get(id)!;
}

const PHOTOS = new Map((sourcesJson.photos as unknown as PhotoSource[]).map((p) => [p.id, p]));
export const DATASETS = sourcesJson.datasets;
export const photoCount = PHOTOS.size;
/** Фото по id; без файлов (выбрано, но ещё не подготовлено) — считаем, что фото нет */
export const getPhoto = (id: string | undefined) => {
  const p = id ? PHOTOS.get(id) : undefined;
  return p && Object.keys(p.files).length ? p : undefined;
};

/** Самый большой размер для буклета; крупнее — только для просмотра на весь экран */
const BOOKLET_MAX = 1200;

/** Значение для srcset: «/img/a-480.webp 480w, /img/a-1200.webp 1200w» */
export function photoSrcset(files: Record<string, string>): string {
  return Object.keys(files)
    .map(Number)
    .filter((w, _, all) => w <= BOOKLET_MAX || all.every((x) => x > BOOKLET_MAX))
    .sort((a, b) => a - b)
    .map((w) => `${import.meta.env.BASE_URL}${files[String(w)]} ${w}w`)
    .join(', ');
}

/**
 * Файл для просмотра на весь экран и его размер.
 * Старые фото маленькие (560 px) — объявляем их вдвое крупнее, чтобы они заняли больше экрана (будут мягче).
 */
export function photoFull(p: PhotoSource): { src: string; w: number; h: number } {
  const big = Math.max(...Object.keys(p.files).map(Number));
  const w = p.w ?? big;
  const h = p.h ?? Math.round(w / 2);
  const k = p.avif ? 1 : 2;
  return { src: import.meta.env.BASE_URL + p.files[String(big)], w: w * k, h: h * k };
}

