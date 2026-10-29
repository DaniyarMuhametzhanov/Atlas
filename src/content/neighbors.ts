// Соседи каждой страны по общей границе (готовит scripts/build-map.ts)
import { fetchAsset } from '../lib/asset';

let promise: Promise<Record<string, string[]>> | null = null;
export function loadNeighbors(): Promise<Record<string, string[]>> {
  promise ??= fetchAsset('data/map/neighbors.json').then((r) => {
    if (!r.ok) throw new Error(`neighbors.json: ${r.status}`);
    return r.json();
  });
  return promise;
}
