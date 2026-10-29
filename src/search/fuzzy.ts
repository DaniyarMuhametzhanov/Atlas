// Нечёткий поиск: прощает опечатки, неправильную раскладку и регистр.
// Своя маленькая реализация вместо Fuse.js: записей всего ≈2,5 тысячи, перебор за миллисекунды.

/** Строчные буквы, ё → е, без ударений и знаков препинания, одиночные пробелы */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

// Клавиши английской и русской раскладки по порядку (QWERTY ↔ ЙЦУКЕН)
const EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`";
const RU = 'йцукенгшщзхъфывапролджэячсмитьбюё';
const EN_TO_RU = new Map([...EN].map((c, i) => [c, RU[i]]));
const RU_TO_EN = new Map([...RU].map((c, i) => [c, EN[i]]));

/** Текст, набранный не в той раскладке: «rfpf[cnfy» → «казахстан», «кщьу» → «rome» */
export function switchLayout(s: string): string | null {
  const low = s.toLowerCase();
  const map = /[a-z[\];',.`]/.test(low) && !/[а-яё]/.test(low) ? EN_TO_RU : /[а-яё]/.test(low) && !/[a-z]/.test(low) ? RU_TO_EN : null;
  if (!map) return null;
  return [...low].map((c) => map.get(c) ?? c).join('');
}

/** Расстояние между словами: сколько букв вставить, убрать, заменить или переставить (Дамерау — Левенштейн) */
export function editDistance(a: string, b: string): number {
  return editRows(a, b)[b.length];
}

/** Сколько опечаток прощаем: в коротких словах ни одной, в средних одну, в длинных две */
const allowed = (len: number) => (len < 4 ? 0 : len < 8 ? 1 : 2);

/**
 * Похоже ли начало слова на запрос с опечатками; возвращает число опечаток или −1.
 * Одна таблица сравнения запроса с началом слова: её последняя строка сразу даёт ответ для начала любой длины.
 */
function fuzzyPrefix(q: string, word: string): number {
  const max = allowed(q.length);
  if (!max) return -1;
  // быстрый отсев: опечатка сразу в двух первых буквах почти не встречается
  if (word[0] !== q[0] && word[1] !== q[1] && word[0] !== q[1]) return -1;
  const w = word.slice(0, q.length + max);
  const d = editRows(q, w);
  let best = -1;
  for (let k = Math.max(1, q.length - max); k <= w.length; k++) if (d[k] <= max && (best < 0 || d[k] < best)) best = d[k];
  return best;
}

/** Последняя строка таблицы Дамерау — Левенштейна: расстояние от a до каждого начала b */
function editRows(a: string, b: string): Int32Array {
  const n = b.length;
  let prev2 = new Int32Array(n + 1);
  let prev = Int32Array.from({ length: n + 1 }, (_, j) => j);
  let cur = new Int32Array(n + 1);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
    }
    [prev2, prev, cur] = [prev, cur, prev2];
  }
  return prev;
}

/**
 * Насколько название подходит к запросу (оба уже прошли normalize): 0 — не подходит, 1 — совпадает целиком.
 * Порядок: точное совпадение → начало названия → начало слова → внутри слова → с опечатками.
 */
export function matchScore(q: string, name: string): number {
  if (!q || !name) return 0;
  if (name === q) return 1;
  if (name.startsWith(q)) return 0.9 + 0.05 * (q.length / name.length);
  const words = name.split(' ');
  // запрос из нескольких слов: каждое слово запроса — начало какого-то слова названия
  const qw = q.split(' ');
  if (qw.length > 1 && qw.every((w) => words.some((x) => x.startsWith(w)))) return 0.82;
  if (words.some((w) => w.startsWith(q))) return 0.8;
  if (q.length >= 3 && name.includes(q)) return 0.6;
  // опечатки: сравниваем с началом названия и с началом каждого слова
  let best = -1;
  for (const w of [name.replace(/ /g, ''), ...words]) {
    const d = fuzzyPrefix(q.replace(/ /g, ''), w);
    if (d >= 0 && (best < 0 || d < best)) best = d;
  }
  return best < 0 ? 0 : 0.55 - 0.12 * best;
}

/** Лучшее совпадение среди нескольких названий записи (русское, английское, другие) */
export function bestScore(q: string, names: string[]): number {
  let best = 0;
  for (const n of names) best = Math.max(best, matchScore(q, n));
  return best;
}
