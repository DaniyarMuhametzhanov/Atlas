import { describe, expect, it } from 'vitest';
import { editDistance, matchScore, normalize, switchLayout } from '../../src/search/fuzzy';
import { buildItems, search } from '../../src/search/searchIndex';
import capitals from '../../public/data/map/capitals.json';
import cities from '../../public/data/map/cities.json';
import nature from '../../content/places/nature.json';
import reserves from '../../content/places/reserves.json';
import wonders from '../../content/places/wonders.json';
import polities from '../../content/history/polities.json';

type Args = Parameters<typeof buildItems>;
const items = buildItems(
  capitals as unknown as Args[0],
  cities as unknown as Args[1],
  { nature, reserves, wonders } as unknown as Args[2],
  polities as unknown as Args[3],
);
const first = (q: string) => search(items, q)[0]?.items[0];

describe('нечёткий поиск: основа', () => {
  it('приводит текст к одному виду', () => {
    expect(normalize('  Кот-д’Ивуар ')).toBe('кот д ивуар');
    expect(normalize('Ёлка')).toBe('елка');
    expect(normalize('São Tomé')).toBe('sao tome');
  });
  it('исправляет раскладку', () => {
    expect(switchLayout('rfpf[cnfy')).toBe('казахстан');
    expect(switchLayout('кщьу')).toBe('rome');
    expect(switchLayout('mix смесь')).toBeNull();
  });
  it('считает опечатки', () => {
    expect(editDistance('кахахстан', 'казахстан')).toBe(1);
    expect(editDistance('каазхстан', 'казахстан')).toBe(1); // переставленные буквы
    expect(editDistance('рим', 'рим')).toBe(0);
  });
  it('оценивает совпадения по порядку', () => {
    const exact = matchScore('рим', 'рим');
    const start = matchScore('рим', 'римская империя');
    const word = matchScore('байкал', 'озеро байкал');
    const typo = matchScore('кахахстан', 'казахстан');
    expect(exact).toBeGreaterThan(start);
    expect(start).toBeGreaterThan(word);
    expect(word).toBeGreaterThan(typo);
    expect(typo).toBeGreaterThan(0);
    expect(matchScore('рим', 'мир')).toBe(0); // в коротких словах опечаток не прощаем
  });
});

describe('поиск по атласу: сценарии из задания', () => {
  it('«Сокотра» — остров в Йемене', () => {
    const hit = first('Сокотра');
    expect(hit?.title).toMatch(/Сокотра/);
    expect(hit?.iso).toBe('YEM');
  });
  it('«Рим» — столица Италии', () => {
    const hit = first('Рим');
    expect(hit?.kind).toBe('capital');
    expect(hit?.iso).toBe('ITA');
  });
  it('«Золотая Орда» — историческое государство с годами', () => {
    const hit = first('Золотая Орда');
    expect(hit?.kind).toBe('polity');
    expect(hit?.polity?.en).toBe('Golden Horde');
    expect(hit?.sub).toMatch(/\d{4} — \d{4}/);
  });
  it('«Байкал» — озеро', () => {
    expect(first('Байкал')?.placeId).toBe('rus-ozero-baykal');
  });
  it('«Кахахстан» (опечатка) и «rfpf[cnfy» (раскладка) — Казахстан', () => {
    expect(first('Кахахстан')?.iso).toBe('KAZ');
    expect(first('Кахахстан')?.kind).toBe('country');
    expect(first('rfpf[cnfy')?.iso).toBe('KAZ');
  });
  it('современная страна не повторяется в истории', () => {
    expect(search(items, 'Казахстан').find((g) => g.id === 'history')).toBeUndefined();
  });
  it('понимает английский', () => {
    expect(first('Japan')?.iso).toBe('JPN');
    expect(first('Golden Horde')?.polity?.en).toBe('Golden Horde');
  });
  it('страна раньше одноимённой столицы', () => {
    const groups = search(items, 'Мексика');
    expect(groups[0].id).toBe('countries');
    expect(groups[0].items[0].iso).toBe('MEX');
  });
  it('пустой запрос — пусто, бессмыслица — пусто', () => {
    expect(search(items, '   ')).toEqual([]);
    expect(search(items, 'щщщщщщщщ')).toEqual([]);
  });
});
