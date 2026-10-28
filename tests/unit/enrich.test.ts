import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Country } from '../../src/content/schema';

const root = path.resolve(import.meta.dirname, '../..');
const readJson = (p: string) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const ids = fs.readdirSync(path.join(root, 'content/enrich')).map((f) => f.replace('.json', ''));
const all = new Set(fs.readdirSync(path.join(root, 'content/countries')).map((f) => f.replace('.json', '')));

describe('наполнение текстами (этап 8)', () => {
  it('50 самых популярных стран заполнены целиком', () => {
    expect(ids).toHaveLength(50);
    for (const id of ids) {
      const c = Country.parse(readJson(`content/countries/${id}.json`));
      const t = c.tourist;
      expect(c.updated, id).toBe('2026-10');
      expect(c.overview.facts, id).toBeTruthy();
      expect(t.practical?.phrases, id).toHaveLength(5);
      expect(t.climate, id).toHaveLength(12);
      expect(t.food?.length, id).toBeGreaterThanOrEqual(3);
      expect(t.etiquette?.do.length, id).toBeGreaterThanOrEqual(3);
      expect(c.politics.freedom?.[0].year, id).toBe(2026);
      expect(c.politics.asOf && c.relations.asOf && t.practical?.asOf, id).toBeTruthy();
      expect(c.culture.holidays?.length, id).toBeGreaterThanOrEqual(3);
      expect(c.culture.people?.length, id).toBeGreaterThanOrEqual(3);
      expect(c.relations.world?.length, id).toBeGreaterThanOrEqual(5);
      expect(c.stereotypes?.about.length, id).toBeGreaterThanOrEqual(2);
      expect(c.stereotypes?.held.length, id).toBeGreaterThanOrEqual(2);
      if (c.culture.ethnic) {
        expect(c.culture.ethnicSource, id).toBeTruthy();
        if (!c.culture.ethnicMulti) expect(c.culture.ethnic.reduce((n, g) => n + g.percent, 0), id).toBeLessThanOrEqual(100.5);
      }
    }
  });
  it('связи «С миром» ведут на существующие страны', () => {
    for (const id of ids) for (const w of Country.parse(readJson(`content/countries/${id}.json`)).relations.world ?? []) expect(all.has(w.country), `${id} → ${w.country}`).toBe(true);
  });
  it('поля этапа 8 переживают повторный запуск extract (лежат в content/enrich)', () => {
    for (const id of ids) {
      const e = readJson(`content/enrich/${id}.json`);
      const c = readJson(`content/countries/${id}.json`);
      expect(e.updated).toBe('2026-10');
      // готовый файл страны совпадает с текстами из enrich — значит, extract их наложил, а не затёр
      expect(c.politics.leaders, id).toBe(e.politics.leaders);
      expect(c.sources, id).toEqual(e.sources);
    }
  });
  it('у каждой страны есть источники, в текстах нет заглушек «уточните»', () => {
    for (const id of ids) {
      const raw = fs.readFileSync(path.join(root, `content/enrich/${id}.json`), 'utf8');
      expect(raw, id).not.toMatch(/уточните|undefined|TODO/i);
      expect(Country.parse(readJson(`content/countries/${id}.json`)).sources?.length, id).toBeGreaterThanOrEqual(5);
    }
  });
});
