// Вопросы викторины. Варианты ответа берём из того же региона — так интереснее, чем «Перу или Норвегия».
import type { Feature, Point } from 'geojson';
import { COUNTRY_BY_ID, loadCountry } from '../content';
import { loadBorders, loadPoints, type PointProps } from '../map/data';
import { activeRows, centuryOf, loadCentury, loadPolities } from '../map/time/data';
import { formatYear } from '../lib/years';
import { contains, outlinePath } from './geo';

export type QuestionKind = 'outline' | 'history' | 'fame' | 'find';
export type Choice = { id: string; label: string };
export type Question = {
  kind: QuestionKind;
  prompt: string;
  /** вариант ответа (для «Найди на карте» — код страны) */
  answer: string;
  choices: Choice[];
  /** страна вопроса: после ответа карта перелетает к ней */
  iso: string;
  /** пояснение после ответа */
  explain: string;
  /** контур страны (вопрос «по контуру») */
  path?: string;
};

export const KIND_TITLE: Record<QuestionKind, string> = {
  outline: 'Угадай страну по контуру',
  history: 'Чья это была земля?',
  fame: 'Чем знаменита страна',
  find: 'Найди на карте',
};

type Pt = Feature<Point, PointProps>;

/** Случайный порядок (Фишер — Йейтс); rnd — для повторяемых тестов */
export function shuffle<T>(list: T[], rnd = Math.random): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Три других страны: сначала из того же региона */
function distractors(ans: Pt, pool: Pt[], rnd: () => number): Pt[] {
  const others = pool.filter((p) => p.properties.iso !== ans.properties.iso);
  const same = shuffle(others.filter((p) => p.properties.region === ans.properties.region), rnd);
  const rest = shuffle(others.filter((p) => p.properties.region !== ans.properties.region), rnd);
  return [...same, ...rest].slice(0, 3);
}
const countryChoices = (ans: Pt, pool: Pt[], rnd: () => number): Choice[] =>
  shuffle([ans, ...distractors(ans, pool, rnd)], rnd).map((p) => ({ id: p.properties.iso, label: p.properties.name }));

/** Порядок видов вопросов: каждый вид хотя бы раз, остальное вперемешку */
export function plan(n: number, rnd = Math.random): QuestionKind[] {
  const all: QuestionKind[] = ['outline', 'history', 'fame', 'find'];
  const out = [...all];
  while (out.length < n) out.push(all[Math.floor(rnd() * all.length)]);
  return shuffle(out.slice(0, n), rnd);
}

const YEARS = [-1000, -300, 100, 500, 900, 1200, 1400, 1600, 1700, 1800, 1900, 1950];

export async function makeQuiz(n: number, rnd = Math.random): Promise<Question[]> {
  const [points, borders] = await Promise.all([loadPoints(), loadBorders()]);
  // известные страны с буклетом: мелкие острова по контуру и на карте не угадать
  const pool = points.features.filter((p) => p.properties.has === 1 && !p.properties.small && COUNTRY_BY_ID.has(p.properties.iso));
  const famous = pool.filter((p) => p.properties.rank <= 80);
  const used = new Set<string>();
  const pick = (list: Pt[]) => {
    const free = list.filter((p) => !used.has(p.properties.iso));
    const p = free[Math.floor(rnd() * free.length)];
    used.add(p.properties.iso);
    return p;
  };
  const geom = (iso: string) => borders.features.find((f) => f.properties?.iso === iso)?.geometry ?? null;

  const out: Question[] = [];
  for (const kind of plan(n, rnd)) {
    if (kind === 'outline') {
      const p = pick(famous);
      out.push({
        kind, iso: p.properties.iso, answer: p.properties.iso, prompt: 'Какая страна на рисунке?',
        path: outlinePath(geom(p.properties.iso)),
        choices: countryChoices(p, pool, rnd),
        explain: `Это ${p.properties.name}.`,
      });
    } else if (kind === 'find') {
      const p = pick(famous);
      out.push({
        kind, iso: p.properties.iso, answer: p.properties.iso, prompt: `Нажмите на карте: ${p.properties.name}`, choices: [],
        explain: `Страна «${p.properties.name}» обведена на карте.`,
      });
    } else if (kind === 'fame') {
      // «чем знаменита» не должно подсказывать название страны («Панамский канал»)
      let q: Question | null = null;
      for (let tries = 0; tries < 8 && !q; tries++) {
        const p = pick(famous);
        const c = await loadCountry(p.properties.iso);
        if (c.fame.toLowerCase().includes(c.name.toLowerCase().slice(0, 5))) continue;
        q = {
          kind, iso: p.properties.iso, answer: p.properties.iso, prompt: `Какая страна знаменита этим: «${c.fame}»?`,
          choices: countryChoices(p, pool, rnd), explain: `${c.name}: ${c.tagline}`,
        };
      }
      if (q) out.push(q);
    } else {
      out.push(await historyQuestion(famous, used, rnd));
    }
  }
  return out;
}

/** «Кому принадлежала земля, где сегодня Казахстан, в 1700 году?» — ответ по границам Cliopatria под значком страны */
async function historyQuestion(pool: Pt[], used: Set<string>, rnd: () => number): Promise<Question> {
  const polities = await loadPolities();
  const byI = new Map(polities.map((p) => [p.i, p]));
  for (let tries = 0; tries < 20; tries++) {
    const p = pool[Math.floor(rnd() * pool.length)];
    if (used.has(p.properties.iso)) continue;
    const year = YEARS[Math.floor(rnd() * YEARS.length)];
    const rows = activeRows(await loadCentury(centuryOf(year)), year).filter((r) => r.properties.k === 0);
    const here = rows.find((r) => contains(r.geometry, p.geometry.coordinates));
    const ans = here && byI.get(here.properties.i);
    if (!ans) continue;
    // другие крупные государства того же года — с другими названиями
    const names = new Set([ans.ru]);
    const others = shuffle(
      [...rows].sort((a, b) => b.properties.ar - a.properties.ar).slice(0, 14),
      rnd,
    )
      .map((r) => byI.get(r.properties.i))
      .filter((x) => x && !names.has(x.ru) && names.add(x.ru))
      .slice(0, 3);
    if (others.length < 3) continue;
    used.add(p.properties.iso);
    const when = year < 0 ? `в ${formatYear(year)}` : `в ${year} году`;
    return {
      kind: 'history',
      iso: p.properties.iso,
      answer: String(ans.i),
      prompt: `Какому государству ${when} принадлежала земля, где сегодня ${p.properties.name}?`,
      choices: shuffle([ans, ...others.map((x) => x!)], rnd).map((x) => ({ id: String(x.i), label: x.ru })),
      explain: `${when[0].toUpperCase()}${when.slice(1)} здесь было государство «${ans.ru}».`,
    };
  }
  throw new Error('Не получилось составить вопрос по истории');
}
