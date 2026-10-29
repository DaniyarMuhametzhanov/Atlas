import type { PlacesData } from '../content/places';
import type { MapPlace } from '../content/schema';
import { shuffle } from '../quiz/questions';

export const STOPS = 5;

/** 5 мест из разных стран, одно из них — чудо света; порядок — с запада на восток */
export function pickTour(data: Pick<PlacesData, 'nature' | 'reserves' | 'wonders'>, rnd = Math.random): MapPlace[] {
  const out: MapPlace[] = [shuffle(data.wonders, rnd)[0]];
  for (const p of shuffle([...data.nature, ...data.reserves], rnd)) {
    if (out.length >= STOPS) break;
    if (out.some((x) => x.country === p.country)) continue;
    out.push(p);
  }
  return out.sort((a, b) => a.lon - b.lon);
}
