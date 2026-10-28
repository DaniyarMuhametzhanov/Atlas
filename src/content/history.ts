// Исторические буклеты: какое государство на карте открывает какой буклет, и загрузка буклета по требованию.
import type { HistoryBooklet } from './schema';
import index from '../../content/history/booklets-index.json';

const files = import.meta.glob<HistoryBooklet>('../../content/history/booklets/*.json', { import: 'default' });
const INDEX = index as Record<string, string>;

/** id буклета для имени из Cliopatria; имя в скобках — объединение под тем же названием */
export function bookletIdFor(en: string): string | null {
  return INDEX[en] ?? INDEX[en.replace(/^\((.*)\)$/, '$1')] ?? null;
}

export function loadBooklet(id: string): Promise<HistoryBooklet> {
  const f = files[`../../content/history/booklets/${id}.json`];
  return f ? f() : Promise.reject(new Error(`Нет буклета ${id}`));
}
