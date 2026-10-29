// Файлы сайта (данные карты, история, фото, значки).
// Веб-версия берёт их с сервера. Версия без интернета (npm run build:offline) — один HTML-файл:
// все файлы встроены в него как текст base64 в window.__ATLAS_ASSETS (путь → содержимое).
// Браузер не загружает соседние файлы со страницы, открытой с диска, поэтому всё идёт через эти функции.

const EMBEDDED = (globalThis as { __ATLAS_ASSETS?: Record<string, string> }).__ATLAS_ASSETS;
/** Открыта версия без интернета */
export const OFFLINE = !!EMBEDDED;

const MIME: Record<string, string> = {
  json: 'application/json', pbf: 'application/x-protobuf', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif',
};
const mimeOf = (path: string) => MIME[path.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream';

function bytesOf(path: string): Uint8Array<ArrayBuffer> | null {
  const b64 = EMBEDDED?.[path];
  if (b64 == null) return null;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Есть ли файл (в веб-версии — считаем, что есть всё) */
export const hasAsset = (path: string) => !EMBEDDED || path in EMBEDDED;

const blobs = new Map<string, string>();
/** Адрес файла для <img>, srcset и загрузки картинок карты */
export function assetUrl(path: string): string {
  if (!EMBEDDED) return import.meta.env.BASE_URL + path;
  let url = blobs.get(path);
  if (!url) {
    const bytes = bytesOf(path);
    // файла нет в сборке (например, фото 1600 px) — пустая картинка вместо ошибки
    url = bytes ? URL.createObjectURL(new Blob([bytes], { type: mimeOf(path) })) : 'data:,';
    blobs.set(path, url);
  }
  return url;
}

/** Загрузить файл: с сервера или из встроенных данных */
export async function fetchAsset(path: string): Promise<Response> {
  if (!EMBEDDED) return fetch(import.meta.env.BASE_URL + path);
  const bytes = bytesOf(path);
  return bytes ? new Response(bytes, { headers: { 'Content-Type': mimeOf(path) } }) : new Response(null, { status: 404 });
}

/** Содержимое файла для карты (свой адрес embed:// — рельеф и шрифты подписей) */
export function embeddedBytes(path: string): ArrayBuffer | null {
  return bytesOf(path)?.buffer ?? null;
}
