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
export const getPhoto = (id: string | undefined) => (id ? PHOTOS.get(id) : undefined);

/** Ссылка на файл фото нужной ширины (берём ближайший больший размер, иначе самый большой) */
export function photoUrl(p: PhotoSource, width: number): string {
  const sizes = Object.keys(p.files).map(Number).sort((a, b) => a - b);
  const w = sizes.find((s) => s >= width) ?? sizes[sizes.length - 1];
  return import.meta.env.BASE_URL + p.files[String(w)];
}
