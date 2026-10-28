// Природные места, заповедники и чудеса света. Грузятся отдельным файлом, когда нужны.
import type { MapPlace } from './schema';

export type PlaceKind = 'nature' | 'reserves' | 'wonders';
export type PlacesData = Record<PlaceKind, MapPlace[]> & { byId: Map<string, MapPlace> };

let promise: Promise<PlacesData> | null = null;
export function loadPlaces(): Promise<PlacesData> {
  promise ??= Promise.all([
    import('../../content/places/nature.json'),
    import('../../content/places/reserves.json'),
    import('../../content/places/wonders.json'),
  ]).then(([n, r, w]) => {
    const data = { nature: n.default as MapPlace[], reserves: r.default as MapPlace[], wonders: w.default as MapPlace[] };
    return { ...data, byId: new Map([...data.nature, ...data.reserves, ...data.wonders].map((p) => [p.id, p])) };
  });
  return promise;
}
