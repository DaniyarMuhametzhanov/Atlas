// Загрузка данных карты из public/data/map/ (их готовит scripts/build-map.ts)
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, Point } from 'geojson';
import { loadPlaces } from '../content/places';

const BASE = import.meta.env.BASE_URL;
const getJson = async <T,>(file: string): Promise<T> => {
  const res = await fetch(`${BASE}data/map/${file}`);
  if (!res.ok) throw new Error(`Не загрузился ${file}: ${res.status}`);
  return res.json() as Promise<T>;
};

export type CountryProps = { iso: string; name: string; region: string; has: 0 | 1 };
export type PointProps = CountryProps & { rank: number; small: 0 | 1; icon: string; bbox: [number, number, number, number] };
export type PlaceProps = { id: string; name: string; country: string; type: string; kind: 'nature' | 'reserve' | 'wonder'; main: 0 | 1; icon: string };

async function countries(file: string) {
  const topo = await getJson<Topology<{ countries: GeometryCollection<CountryProps> }>>(file);
  return topojson.feature(topo, topo.objects.countries) as FeatureCollection;
}

export async function loadMapData() {
  const [borders, points, capitals, cities, places] = await Promise.all([
    countries('countries-50m.topo.json'),
    getJson<FeatureCollection<Point, PointProps>>('country-points.json'),
    getJson<FeatureCollection<Point>>('capitals.json'),
    getJson<FeatureCollection<Point>>('cities.json'),
    loadPlaces(),
  ]);
  const toFc = (list: typeof places.nature, kind: PlaceProps['kind']): FeatureCollection<Point, PlaceProps> => ({
    type: 'FeatureCollection',
    features: list.map((p) => ({
      type: 'Feature',
      properties: { id: p.id, name: p.name, country: p.country, type: p.type, kind, main: p.main ? 1 : 0, icon: p.icon ? `p-${p.id}` : '' },
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    })),
  });
  const nature = toFc(places.nature, 'nature');
  const reserves = toFc(places.reserves, 'reserve');
  const wonders = toFc(places.wonders, 'wonder');
  return {
    borders,
    points,
    capitals,
    cities,
    natureMain: { ...nature, features: nature.features.filter((f) => f.properties.main) },
    natureRest: { ...nature, features: nature.features.filter((f) => !f.properties.main) },
    reserves,
    wonders,
    allPlaces: { type: 'FeatureCollection', features: [...wonders.features, ...nature.features, ...reserves.features] } as FeatureCollection<Point, PlaceProps>,
  };
}
export type MapData = Awaited<ReturnType<typeof loadMapData>>;

let detailed: Promise<FeatureCollection> | null = null;
/** Подробные границы 10m — только когда карту приблизили */
export const loadDetailedBorders = () => (detailed ??= countries('countries-10m.topo.json'));
