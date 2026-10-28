// Шесть вкладок буклета. Порядок здесь = порядок на экране и клавиши 1–6.
export const TABS = [
  { id: 'overview', icon: '📖', label: 'Обзор' },
  { id: 'tourist', icon: '🧳', label: 'Туристу' },
  { id: 'politics', icon: '🏛', label: 'Политика' },
  { id: 'culture', icon: '🎭', label: 'Культура и народы' },
  { id: 'relations', icon: '🤝', label: 'Отношения' },
  { id: 'stereotypes', icon: '💭', label: 'Стереотипы' },
] as const;

export type TabId = (typeof TABS)[number]['id'];

export const isTabId = (s: string | undefined): s is TabId => TABS.some((t) => t.id === s);
