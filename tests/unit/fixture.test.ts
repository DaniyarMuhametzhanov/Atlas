import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Country } from '../../src/content/schema';

describe('тестовая страна со всеми разделами', () => {
  it('проходит схему — значит, схема описывает все разделы вкладок', () => {
    const fx = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../fixtures/KAZ-full.json'), 'utf8'));
    const r = Country.safeParse(fx);
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues[0])).toBe(true);
  });
});
