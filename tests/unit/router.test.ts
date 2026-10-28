import { describe, expect, it } from 'vitest';
import { formatHash, parseHash } from '../../src/app/router';

describe('роутер', () => {
  it('разбирает адрес страны и вкладки', () => {
    expect(parseHash('#/country/KAZ/culture')).toEqual({ name: 'country', id: 'KAZ', tab: 'culture' });
    expect(parseHash('#/country/kaz')).toEqual({ name: 'country', id: 'KAZ' });
    expect(parseHash('#/country/KAZ/nonsense')).toEqual({ name: 'country', id: 'KAZ' });
  });
  it('всё непонятное — карта мира', () => {
    expect(parseHash('')).toEqual({ name: 'home' });
    expect(parseHash('#/country/')).toEqual({ name: 'home' });
    expect(parseHash('#/what')).toEqual({ name: 'home' });
  });
  it('адрес собирается обратно', () => {
    for (const h of ['#/', '#/sources', '#/country/KAZ/tourist']) expect(formatHash(parseHash(h))).toBe(h);
  });
});
