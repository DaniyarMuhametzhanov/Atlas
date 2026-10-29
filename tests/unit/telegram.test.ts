import { describe, expect, it } from 'vitest';
import { startParam } from '../../src/telegram/telegram';
import { parseHash } from '../../src/app/router';

describe('Telegram: параметр startapp', () => {
  it('адрес страницы → параметр и обратно (как в index.html: _ → /)', () => {
    for (const hash of ['#/country/KAZ/culture', '#/time/-500', '#/compare/KAZ/RUS', '#/quiz']) {
      const p = startParam(hash)!;
      expect(p).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(parseHash('#/' + p.split('_').join('/'))).toEqual(parseHash(hash));
    }
  });
  it('пробелы и русские буквы в ссылку не попадают', () => {
    expect(startParam('#/time/1334/Golden%20Horde')).toBeNull();
    expect(startParam('#/')).toBeNull();
  });
});
