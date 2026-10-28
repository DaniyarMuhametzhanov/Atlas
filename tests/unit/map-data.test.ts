import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { geoContains } from 'd3-geo';
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, Point } from 'geojson';

const root = path.resolve(import.meta.dirname, '../..');
const readJson = (p: string) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

describe('данные карты', () => {
  const topo = readJson('public/data/map/countries-50m.topo.json') as Topology<{ countries: GeometryCollection<{ iso: string }> }>;
  const borders = topojson.feature(topo, topo.objects.countries) as FeatureCollection;
  const byIso = new Map(borders.features.map((f) => [(f.properties as { iso: string }).iso, f]));
  const points = readJson('public/data/map/country-points.json') as FeatureCollection<Point, { iso: string; has: number }>;
  const index = readJson('content/countries-index.json') as { id: string }[];

  it('у каждой из 177 стран есть граница и точка значка', () => {
    for (const c of index) {
      expect(byIso.has(c.id), `граница ${c.id}`).toBe(true);
      expect(points.features.some((p) => p.properties.iso === c.id), `точка ${c.id}`).toBe(true);
    }
  });

  it('значок каждой страны лежит внутри её границ (полюс недоступности)', () => {
    const outside = points.features
      .filter((p) => !geoContains(byIso.get(p.properties.iso) as Feature, p.geometry.coordinates as [number, number]))
      .map((p) => p.properties.iso);
    expect(outside).toEqual([]);
  });

  it('у границ нет скачков через линию перемены дат (кроме кольца Антарктиды у полюса)', () => {
    const jumps: string[] = [];
    for (const f of borders.features) {
      const g = f.geometry;
      if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) continue;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      for (const poly of polys)
        for (const ring of poly)
          for (let i = 1; i < ring.length; i++)
            if (Math.abs(ring[i][0] - ring[i - 1][0]) > 180 && Math.abs(ring[i][1]) < 85) jumps.push((f.properties as { iso: string }).iso);
    }
    expect([...new Set(jumps)]).toEqual([]);
  });
  it('крупные города подписаны по-русски', () => {
    const cities = readJson('public/data/map/cities.json') as FeatureCollection<Point, { name: string; en: string }>;
    const latin = cities.features.filter((f) => !/[а-яё]/i.test(f.properties.name)).map((f) => f.properties.en);
    expect(latin).toEqual([]);
  });
});
