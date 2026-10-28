// Соседи каждой страны по общей границе (готовит scripts/build-map.ts)
let promise: Promise<Record<string, string[]>> | null = null;
export function loadNeighbors(): Promise<Record<string, string[]>> {
  promise ??= fetch(`${import.meta.env.BASE_URL}data/map/neighbors.json`).then((r) => {
    if (!r.ok) throw new Error(`neighbors.json: ${r.status}`);
    return r.json();
  });
  return promise;
}
