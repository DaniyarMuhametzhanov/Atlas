// Геометрия для викторины: точка внутри границ и контур страны картинкой (SVG).
import type { Geometry, Position } from 'geojson';

type Ring = Position[];

/** Точка внутри кольца: луч вправо пересекает границу нечётное число раз */
function inRing([x, y]: Position, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Многоугольники геометрии: каждый — внешнее кольцо и дыры */
export function polygonsOf(g: Geometry | null): Ring[][] {
  if (!g) return [];
  if (g.type === 'Polygon') return [g.coordinates];
  if (g.type === 'MultiPolygon') return g.coordinates;
  return [];
}

export function contains(g: Geometry | null, pt: Position): boolean {
  return polygonsOf(g).some(([outer, ...holes]) => inRing(pt, outer) && !holes.some((h) => inRing(pt, h)));
}

/** Площадь кольца в квадратных градусах (для отбора главной части страны) */
const ringArea = (r: Ring) => Math.abs(r.reduce((s, [x, y], i) => { const [x2, y2] = r[(i + 1) % r.length]; return s + x * y2 - x2 * y; }, 0)) / 2;
const centerOf = (r: Ring) => [r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length];

/**
 * Контур страны для вопроса «Угадай по контуру»: путь SVG в рамке w×h.
 * Далёкие заморские кусочки (Французская Гвиана у Франции) и мелкие островки убираем — иначе контур не узнать.
 */
export function outlinePath(g: Geometry | null, w = 240, h = 180, pad = 8): string {
  let polys = polygonsOf(g);
  if (!polys.length) return '';
  // страна через линию перемены дат (Россия, Фиджи): западное полушарие сдвигаем на 360°
  const lons = polys.flatMap((p) => p[0].map((c) => c[0]));
  const wrap = Math.max(...lons) - Math.min(...lons) > 180;
  if (wrap) polys = polys.map((p) => p.map((r) => r.map(([x, y]) => [x < 0 ? x + 360 : x, y])));
  const main = polys.reduce((m, p) => (ringArea(p[0]) > ringArea(m[0]) ? p : m));
  const [mx, my] = centerOf(main[0]);
  const big = ringArea(main[0]);
  polys = polys.filter((p) => {
    const [cx, cy] = centerOf(p[0]);
    return p === main || (ringArea(p[0]) > big * 0.002 && Math.hypot(cx - mx, cy - my) < 25);
  });
  // равнопромежуточная проекция: долготы сжимаем на косинус широты середины страны
  const k = Math.cos((my * Math.PI) / 180);
  const pts = polys.flatMap((p) => p[0]);
  const xs = pts.map((c) => c[0] * k);
  const ys = pts.map((c) => -c[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = Math.min((w - 2 * pad) / (x1 - x0 || 1), (h - 2 * pad) / (y1 - y0 || 1));
  const ox = (w - (x1 - x0) * s) / 2;
  const oy = (h - (y1 - y0) * s) / 2;
  const f = (n: number) => n.toFixed(1);
  return polys
    .map((p) => p.map((r) => 'M' + r.map(([x, y]) => `${f(ox + (x * k - x0) * s)} ${f(oy + (-y - y0) * s)}`).join('L') + 'Z').join(''))
    .join('');
}
