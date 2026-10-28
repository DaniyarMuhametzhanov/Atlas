import { describe, expect, it } from 'vitest';
import { formatYear, parseYear } from '../../src/lib/years';

describe('годы', () => {
  it('отрицательный год — до нашей эры', () => {
    expect(formatYear(-500)).toBe('500 до н.э.');
    expect(formatYear(-3000)).toBe('3000 до н.э.');
    expect(formatYear(1991)).toBe('1991');
  });
  it('понимает разные записи', () => {
    expect(parseYear('500 до н.э.')).toBe(-500);
    expect(parseYear('500 до н. э.')).toBe(-500);
    expect(parseYear('−500')).toBe(-500);
    expect(parseYear('1991')).toBe(1991);
    expect(parseYear('0')).toBeNull();
    expect(parseYear('год')).toBeNull();
  });
});
