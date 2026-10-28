import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';
import { HistoryBooklet } from '../../src/content/schema';
import { posToYear, yearToPos, EPOCHS } from '../../src/map/time/data';

const root = path.resolve(import.meta.dirname, '../..');
const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
type Props = { i: number; a: number; b: number; k: number };
const polities = readJson<{ i: number; en: string; ru: string }[]>('content/history/polities.json');

function inRing(x: number, y: number, ring: Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** Какое государство (не объединение) было в этой точке в этом году — по файлам машины времени */
function polityAt(year: number, lon: number, lat: number): string | null {
  const c = Math.floor(year / 100) * 100;
  const topo = readJson<Topology<{ p: GeometryCollection<Props> }>>(`public/data/history/polities/c${c}.json`);
  const fc = topojson.feature(topo, topo.objects.p) as FeatureCollection<Polygon | MultiPolygon, Props>;
  for (const f of fc.features) {
    const p = f.properties;
    if (p.k !== 0 || p.a > year || p.b < year || !f.geometry) continue;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    if (polys.some((rings) => inRing(lon, lat, rings[0]) && !rings.slice(1).some((h) => inRing(lon, lat, h)))) return polities[p.i].en;
  }
  return null;
}

describe('машина времени: данные', () => {
  it.each([
    [1700, 67, 48, 'Kazakh Khanate'],
    [1900, 67, 48, 'Russian Empire'],
    [1950, 67, 48, 'Union of Soviet Socialist Republics'],
    [2000, 67, 48, 'Kazakhstan'],
    [2000, 53.9, 12.5, 'Republic of Yemen'], // Сокотра в 2000 году — в составе Йемена
  ])('%i год, точка (%f, %f) — %s', (year, lon, lat, want) => {
    expect(polityAt(year, lon, lat)).toBe(want);
  });

  it('у всех государств есть русское название', () => {
    expect(polities.filter((p) => !p.ru).map((p) => p.en)).toEqual([]);
  });

  it('файлы по векам не больше 3 МБ', () => {
    const dir = path.join(root, 'public/data/history/polities');
    const big = fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).size > 3 * 1024 * 1024);
    expect(big).toEqual([]);
  });
});

describe('машина времени: шкала лет', () => {
  it('год → позиция → год возвращает тот же год', () => {
    for (const y of [-3000, -1500, -1, 1, 100, 1279, 1700, 1991, 2024]) expect(posToYear(yearToPos(y))).toBe(y);
  });
  it('каждая эпоха занимает равный отрезок', () => {
    expect(yearToPos(EPOCHS[1]) - yearToPos(EPOCHS[0])).toBe(1000);
    expect(yearToPos(EPOCHS[30]) - yearToPos(EPOCHS[29])).toBe(1000);
  });
});

describe('исторические буклеты', () => {
  const dir = path.join(root, 'content/history/booklets');
  const files = fs.readdirSync(dir);
  const names = new Set(polities.map((p) => p.en));
  it('не меньше 137 буклетов (77 старых + 60 новых), все проходят схему', () => {
    expect(files.length).toBeGreaterThanOrEqual(137);
    for (const f of files) {
      const r = HistoryBooklet.safeParse(readJson(`content/history/booklets/${f}`));
      expect(r.success, f).toBe(true);
    }
  });
  it('каждый буклет открывается хотя бы с одного государства на карте', () => {
    const index = readJson<Record<string, string>>('content/history/booklets-index.json');
    const reachable = new Set(Object.entries(index).filter(([n]) => names.has(n) || names.has(`(${n})`)).map(([, id]) => id));
    expect(files.map((f) => f.replace('.json', '')).filter((id) => !reachable.has(id))).toEqual([]);
  });
});
