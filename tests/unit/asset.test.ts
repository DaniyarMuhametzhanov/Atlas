import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PhotoSource } from '../../src/content/schema';

const photo: PhotoSource = {
  id: 'a', title: 'A', author: 'X', license: 'CC0', url: 'https://commons.wikimedia.org/wiki/File:A.jpg',
  sizes: [480, 1200, 1600], w: 1600, h: 1000,
  files: { '480': 'img/a-480.webp', '1200': 'img/a-1200.webp', '1600': 'img/a-1600.webp' },
};

afterEach(() => {
  delete (globalThis as { __ATLAS_ASSETS?: unknown }).__ATLAS_ASSETS;
  vi.resetModules();
});

describe('файлы сайта', () => {
  it('веб-версия: обычные адреса, на весь экран — 1600 px', async () => {
    const { fetchAsset, OFFLINE } = await import('../../src/lib/asset');
    const { photoFull } = await import('../../src/content');
    expect(OFFLINE).toBe(false);
    expect(photoFull(photo)).toEqual({ src: '/img/a-1600.webp', w: 1600, h: 1000 });
    expect(typeof fetchAsset).toBe('function');
  });

  it('версия без интернета: файлы из встроенных данных, на весь экран — самое большое из встроенных', async () => {
    (globalThis as { __ATLAS_ASSETS?: Record<string, string> }).__ATLAS_ASSETS = {
      'data/map/x.json': Buffer.from('{"ok":1}').toString('base64'),
      'img/a-480.webp': 'AA==',
      'img/a-1200.webp': 'AA==',
    };
    const { fetchAsset, hasAsset, OFFLINE } = await import('../../src/lib/asset');
    const { photoFull, photoSrcset } = await import('../../src/content');
    expect(OFFLINE).toBe(true);
    expect(await (await fetchAsset('data/map/x.json')).json()).toEqual({ ok: 1 });
    expect((await fetchAsset('data/map/missing.json')).status).toBe(404);
    expect(hasAsset('img/a-1600.webp')).toBe(false);
    const full = photoFull(photo);
    expect(full.w).toBe(1200);
    expect(full.h).toBe(750);
    expect(photoSrcset(photo.files).split(', ')).toHaveLength(2);
  });
});
