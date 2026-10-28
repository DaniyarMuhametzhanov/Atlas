import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Country, MapPlace, PhotoSource } from '../../src/content/schema';

const root = path.resolve(import.meta.dirname, '../..');
const readJson = (p: string) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

describe('данные', () => {
  const files = fs.readdirSync(path.join(root, 'content/countries'));
  it('177 стран, все проходят схему', () => {
    expect(files).toHaveLength(177);
    for (const f of files) {
      const r = Country.safeParse(readJson(`content/countries/${f}`));
      expect(r.success, `${f}: ${r.success ? '' : r.error.issues[0].message}`).toBe(true);
    }
  });
  it('все ссылки на фото и места существуют', () => {
    const photos = new Set((readJson('content/sources.json').photos as unknown[]).map((p) => PhotoSource.parse(p).id));
    const places = new Set(
      ['nature', 'reserves', 'wonders'].flatMap((k) => (readJson(`content/places/${k}.json`) as unknown[]).map((p) => MapPlace.parse(p).id)),
    );
    for (const f of files) {
      const c = Country.parse(readJson(`content/countries/${f}`));
      if (c.photos.cover) expect(photos.has(c.photos.cover), `${c.id} cover`).toBe(true);
      for (const s of c.tourist.sights) for (const p of s.photos ?? []) expect(photos.has(p), `${c.id} ${s.name}`).toBe(true);
      for (const id of [...c.tourist.nature, ...c.tourist.reserves, ...c.tourist.wonders]) expect(places.has(id), id).toBe(true);
    }
  });
});
