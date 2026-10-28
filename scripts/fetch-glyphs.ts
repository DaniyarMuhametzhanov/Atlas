// Скачивает шрифты для подписей карты MapLibre (glyphs — буквы, заранее нарисованные в формате PBF).
// Шрифт Noto Sans (лицензия SIL OFL 1.1) из набора protomaps/basemaps-assets.
// Берём только нужные диапазоны: латиница, кириллица, знаки препинания.
//
// Запуск: npm run fetch:glyphs
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://raw.githubusercontent.com/protomaps/basemaps-assets/main/fonts';
const FONTS = ['Noto Sans Regular', 'Noto Sans Medium', 'Noto Sans Italic'];
const RANGES = ['0-255', '256-511', '512-767', '768-1023', '1024-1279', '1280-1535', '7680-7935', '8192-8447', '8448-8703', '9728-9983'];
const OUT = path.resolve(import.meta.dirname, '../public/data/glyphs');

let bytes = 0;
for (const font of FONTS) {
  fs.mkdirSync(path.join(OUT, font), { recursive: true });
  for (const range of RANGES) {
    const url = `${BASE}/${encodeURIComponent(font)}/${range}.pbf`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(path.join(OUT, font, `${range}.pbf`), buf);
    bytes += buf.length;
  }
}
console.log(`Шрифты карты: ${FONTS.length} начертания × ${RANGES.length} диапазонов, ${(bytes / 1048576).toFixed(2)} МБ.`);
