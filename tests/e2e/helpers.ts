import { expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    __atlasMap?: import('maplibre-gl').Map;
  }
}

/** Открыть адрес и дождаться карты. Ошибки консоли копятся в errors — проверить в конце через expectClean. */
export async function open(page: Page, hash = '#/'): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(hash);
  await page.waitForFunction(() => window.__atlasMap?.loaded(), null, { timeout: 60_000 });
  return errors;
}

export const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1300) < 700;

/** Перевести карту к точке и вернуть её место на экране; на телефоне нижнюю половину закрывает панель */
export async function showPoint(page: Page, lngLat: [number, number], zoom: number): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ([lngLat, zoom, phone]) => {
      const m = window.__atlasMap!;
      const h = m.getContainer().clientHeight;
      // void: jumpTo возвращает саму карту — её нельзя передать обратно в тест
      void m.jumpTo({ center: lngLat, zoom, padding: phone ? { top: 0, bottom: Math.round(h * 0.6), left: 0, right: 0 } : { top: 0, bottom: 0, left: 0, right: 0 } });
      const p = m.project(lngLat);
      const r = m.getCanvas().getBoundingClientRect();
      return { x: r.left + p.x, y: r.top + p.y };
    },
    [lngLat, zoom, isPhone(page)] as const,
  );
}

/** Дождаться, пока карта дорисует всё после перемещения */
export const idle = (page: Page) =>
  page.evaluate(() => new Promise<void>((ok) => (window.__atlasMap!.loaded() ? ok() : window.__atlasMap!.once('idle', () => ok()))));

export function expectClean(errors: string[]) {
  expect(errors, 'ошибки в консоли').toEqual([]);
}

export const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
