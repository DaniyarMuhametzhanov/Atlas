import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { commonsTitle, isFreeLicense, keepBuilt } from '../../scripts/lib/photos';
import { photoFull, photoSrcset } from '../../src/content';
import { PhotoSource } from '../../src/content/schema';

const root = path.resolve(import.meta.dirname, '../..');
const sources = JSON.parse(fs.readFileSync(path.join(root, 'content/sources.json'), 'utf8')).photos as PhotoSource[];

const legacy: PhotoSource = {
  id: 'a', title: 'A', author: 'X', license: 'CC0', url: 'https://commons.wikimedia.org/wiki/File:A_b.jpg',
  sizes: [224, 560], files: { '224': 'img/legacy/a-thumb.webp', '560': 'img/legacy/a-cover.webp' }, w: 560, h: 280,
};
const built: PhotoSource = {
  ...legacy, sizes: [480, 1200, 2000], w: 2000, h: 1333,
  files: { '480': 'img/a-480.webp', '1200': 'img/a-1200.webp', '2000': 'img/a-2000.webp' },
};

describe('фото', () => {
  it('имя файла Commons из ссылки', () => {
    expect(commonsTitle('https://commons.wikimedia.org/wiki/File:Big_Ben_at_sunset_-_2014-10-27_17-30.jpg')).toBe('File:Big Ben at sunset - 2014-10-27 17-30.jpg');
    expect(commonsTitle('https://commons.wikimedia.org/wiki/File:%C3%85lesund.jpg')).toBe('File:Ålesund.jpg');
  });
  it('разрешены только свободные лицензии', () => {
    for (const l of ['CC0', 'CC BY 2.0', 'CC BY-SA 4.0', 'Public domain', 'PD-USGov']) expect(isFreeLicense(l), l).toBe(true);
    for (const l of ['CC BY-NC 2.0', 'CC BY-ND 3.0', 'Fair use', 'GFDL']) expect(isFreeLicense(l), l).toBe(false);
  });
  it('у всех фото в данных свободная лицензия и известен размер', () => {
    for (const p of sources) {
      // только лицензии из задания; FAL и GFDL заменены (content/photo-drop.json)
      expect(isFreeLicense(p.license), `${p.id}: ${p.license}`).toBe(true);
      if (p.sizes.length) expect(p.w && p.h, p.id).toBeTruthy();
    }
  });
  it('в буклет — до 1200 px, на весь экран — самый большой', () => {
    expect(photoSrcset(built.files)).toBe('/img/a-480.webp 480w, /img/a-1200.webp 1200w');
    expect(photoFull(built)).toEqual({ src: '/img/a-2000.webp', w: 2000, h: 1333 });
    expect(photoSrcset(legacy.files)).toBe('/img/legacy/a-thumb.webp 224w, /img/legacy/a-cover.webp 560w');
    expect(photoFull(legacy)).toEqual({ src: '/img/legacy/a-cover.webp', w: 1120, h: 560 }); // старое — вдвое крупнее
  });
  it('повторное извлечение не теряет крупные фото', () => {
    const [merged] = keepBuilt([{ ...legacy, w: undefined, h: undefined }], [built]);
    expect(merged.files).toEqual(built.files);
    expect(merged.w).toBe(2000);
    expect(keepBuilt([{ ...legacy, w: undefined }], [legacy])[0].w).toBe(560);
  });
});
