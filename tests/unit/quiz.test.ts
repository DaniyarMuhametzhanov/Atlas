import { describe, expect, it } from 'vitest';
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection } from 'geojson';
import { contains, outlinePath } from '../../src/quiz/geo';
import { plan, shuffle } from '../../src/quiz/questions';
import { pickTour, STOPS } from '../../src/tour/pickTour';
import topo from '../../public/data/map/countries-50m.topo.json';
import points from '../../public/data/map/country-points.json';
import nature from '../../content/places/nature.json';
import reserves from '../../content/places/reserves.json';
import wonders from '../../content/places/wonders.json';

const t = topo as unknown as Topology<{ countries: GeometryCollection<{ iso: string }> }>;
const borders = topojson.feature(t, t.objects.countries) as FeatureCollection;
const geom = (iso: string) => borders.features.find((f) => f.properties?.iso === iso)!.geometry;
const pt = (iso: string) => points.features.find((f) => f.properties.iso === iso)!.geometry.coordinates;

/** Повторяемые «случайные» числа для тестов */
function seeded(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

describe('геометрия викторины', () => {
  it('точка внутри границ', () => {
    expect(contains(geom('KAZ'), pt('KAZ'))).toBe(true);
    expect(contains(geom('KAZ'), pt('MNG'))).toBe(false);
    expect(contains(geom('IDN'), pt('IDN'))).toBe(true); // острова — MultiPolygon
  });
  it('контур страны вписан в рамку 240×180', () => {
    for (const iso of ['KAZ', 'RUS', 'FRA', 'USA', 'FJI', 'CHL']) {
      const d = outlinePath(geom(iso));
      expect(d.length).toBeGreaterThan(50);
      const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
      const xs = nums.filter((_, i) => i % 2 === 0);
      const ys = nums.filter((_, i) => i % 2 === 1);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...xs)).toBeLessThanOrEqual(240);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...ys)).toBeLessThanOrEqual(180);
    }
  });
  it('у Франции нет Гвианы: контур занимает рамку, а не точку в углу', () => {
    const d = outlinePath(geom('FRA'));
    const xs = d.match(/-?\d+(\.\d+)?/g)!.map(Number).filter((_, i) => i % 2 === 0);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(100);
  });
});

describe('состав викторины', () => {
  it('каждый вид вопроса хотя бы раз', () => {
    for (const n of [5, 10]) {
      const p = plan(n, seeded(n));
      expect(p).toHaveLength(n);
      expect(new Set(p)).toEqual(new Set(['outline', 'history', 'fame', 'find']));
    }
  });
  it('перемешивание не теряет и не дублирует', () => {
    const a = [1, 2, 3, 4, 5, 6];
    expect(shuffle(a, seeded(7)).sort()).toEqual(a);
  });
});

describe('случайная экскурсия', () => {
  it('5 мест из разных стран, одно — чудо света, с запада на восток', () => {
    for (let seed = 1; seed < 20; seed++) {
      const tour = pickTour({ nature, reserves, wonders } as never, seeded(seed));
      expect(tour).toHaveLength(STOPS);
      expect(new Set(tour.map((p) => p.country)).size).toBe(STOPS);
      expect(tour.some((p) => wonders.some((w) => w.id === p.id))).toBe(true);
      expect(tour.map((p) => p.lon)).toEqual([...tour.map((p) => p.lon)].sort((a, b) => a - b));
    }
  });
});
