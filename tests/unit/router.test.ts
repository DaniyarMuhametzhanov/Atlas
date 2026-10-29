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

describe('роутер: машина времени', () => {
  it('год и государство в адресе', () => {
    expect(parseHash('#/time/1700')).toEqual({ name: 'time', year: 1700 });
    expect(parseHash('#/time/-500/Achaemenid%20Empire')).toEqual({ name: 'time', year: -500, polity: 'Achaemenid Empire' });
    expect(formatHash({ name: 'time', year: 1700, polity: 'Kazakh Khanate' })).toBe('#/time/1700/Kazakh%20Khanate');
  });
  it('нулевого года нет, годы ограничены данными', () => {
    expect(parseHash('#/time/0')).toEqual({ name: 'time', year: 1700 });
    expect(parseHash('#/time/9999')).toEqual({ name: 'time', year: 2024 });
  });
});

describe('роутер: сравнение', () => {
  it('до трёх стран, без повторов', () => {
    expect(parseHash('#/compare/kaz/RUS')).toEqual({ name: 'compare', ids: ['KAZ', 'RUS'] });
    expect(parseHash('#/compare/KAZ/KAZ/x/CHN/JPN/USA')).toEqual({ name: 'compare', ids: ['KAZ', 'CHN', 'JPN'] });
    expect(formatHash({ name: 'compare', ids: ['KAZ', 'RUS'] })).toBe('#/compare/KAZ/RUS');
    expect(formatHash({ name: 'compare', ids: [] })).toBe('#/compare');
  });
});
