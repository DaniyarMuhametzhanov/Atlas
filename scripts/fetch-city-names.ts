// Русские названия крупных городов для подписей карты.
// 1) Викиданные: город с тем же номером GeoNames (свойство P1566) → русская подпись (лицензия CC0).
// 2) Если номера не совпали — межъязыковая ссылка английской Википедии на русскую статью.
// 3) Остаток — пригороды и районы из GeoNames — переведены вручную (MANUAL).
// Результат: content/cities-ru.json ({ номер GeoNames: название }); его читает build-map.ts.
//
// Запуск: npm run fetch:cities-ru
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cities = require('all-the-cities') as { cityId: number; name: string; featureCode: string; population: number }[];
const OUT = path.resolve(import.meta.dirname, '../content/cities-ru.json');
const UA = { 'User-Agent': 'atlas-guide/2.0 (study project)' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MANUAL: Record<string, string> = {
  'Belém': 'Белен', Salvador: 'Салвадор', Cali: 'Кали', 'Guatemala City': 'Гватемала', Zhongshan: 'Чжуншань', Ordos: 'Ордос',
  'Zhu Cheng City': 'Чжучэн', Tarawa: 'Тарава', Teni: 'Тени', Pimpri: 'Пимпри', Najafgarh: 'Наджафгарх', Dombivli: 'Домбивли',
  'Shivaji Nagar': 'Шиваджи-Нагар', 'Al Mawşil al Jadīdah': 'Мосул', 'Al Başrah al Qadīmah': 'Басра', Yono: 'Ёно',
  'Ra’s Bayrūt': 'Бейрут', 'Gustavo Adolfo Madero': 'Густаво-А.-Мадеро', Budta: 'Будта', Malingao: 'Малингао',
  Camayenne: 'Камаен', Guankou: 'Гуанькоу', Dadonghai: 'Дадунхай', 'West Island': 'Уэст-Айленд',
};

const big = cities.filter((x) => x.population >= 1_000_000 || x.featureCode === 'PPLC');
const ru: Record<string, string> = {};

const ids = [...new Set(big.map((x) => String(x.cityId)))];
for (let i = 0; i < ids.length; i += 150) {
  const values = ids.slice(i, i + 150).map((x) => `"${x}"`).join(' ');
  const q = `SELECT ?g ?ru WHERE { VALUES ?g { ${values} } ?item wdt:P1566 ?g . ?item rdfs:label ?ru . FILTER(LANG(?ru) = "ru") }`;
  const res = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: UA });
  if (!res.ok) throw new Error(`Викиданные: ${res.status}`);
  for (const b of (await res.json()).results.bindings) ru[b.g.value] ??= b.ru.value;
  await sleep(1500);
}

const miss = big.filter((x) => !ru[x.cityId]);
for (let i = 0; i < miss.length; i += 40) {
  const part = miss.slice(i, i + 40);
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=langlinks&lllang=ru&lllimit=500&titles=${encodeURIComponent(part.map((x) => x.name).join('|'))}`;
  const j = await (await fetch(url, { headers: UA })).json();
  const alias = Object.fromEntries([...(j.query.normalized ?? []), ...(j.query.redirects ?? [])].map((n: { from: string; to: string }) => [n.from, n.to]));
  const pages = Object.fromEntries(j.query.pages.map((p: { title: string }) => [p.title, p]));
  for (const x of part) {
    let t = alias[x.name] ?? x.name;
    t = alias[t] ?? t;
    const title = pages[t]?.langlinks?.[0]?.title as string | undefined;
    if (title && !/значения|\(/.test(title)) ru[x.cityId] = title; // страницы-омонимы не берём
  }
  await sleep(1000);
}
for (const x of big) if (!ru[x.cityId] && MANUAL[x.name]) ru[x.cityId] = MANUAL[x.name];

const result = Object.fromEntries(big.filter((x) => ru[x.cityId]).map((x) => [x.cityId, ru[x.cityId]]));
fs.writeFileSync(OUT, JSON.stringify(result, null, 1) + '\n');
const left = big.filter((x) => !ru[x.cityId]).map((x) => x.name);
console.log(`Русские названия: ${Object.keys(result).length} из ${big.length}${left.length ? `; без перевода: ${left.join(', ')}` : ''}.`);
