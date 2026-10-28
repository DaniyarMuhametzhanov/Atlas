// Подписи к резким изменениям границ: «1991 — распад СССР».
// Для самых известных событий — свои слова, для остальных — нейтральные: «появляется», «конец», «расширяется».
import type { Polity } from './data';

type Kind = 'appear' | 'vanish' | 'grow' | 'shrink';

const SPECIAL: Record<string, Partial<Record<Kind, string>>> = {
  'Union of Soviet Socialist Republics': { appear: 'образование СССР', vanish: 'распад СССР' },
  'Russian Empire': { appear: 'провозглашение Российской империи', vanish: 'конец Российской империи' },
  'Austria-Hungary': { vanish: 'распад Австро-Венгрии' },
  'Ottoman Empire': { vanish: 'конец Османской империи' },
  'Western Roman Empire': { vanish: 'падение Западной Римской империи' },
  'Roman Empire': { appear: 'начало Римской империи', vanish: 'раздел Римской империи на Западную и Восточную' },
  'Mongol Empire': { appear: 'Чингисхан объединяет монголов', vanish: 'распад Монгольской империи' },
  'Byzantine Empire': { vanish: 'падение Константинополя' },
  'British Raj': { vanish: 'независимость Индии' },
  'Qing Dynasty': { vanish: 'конец империи Цин' },
  'Socialist Federal Republic of Yugoslavia': { vanish: 'распад Югославии' },
  'Kazakh Khanate': { appear: 'основание Казахского ханства' },
  'Kazakhstan': { appear: 'независимость Казахстана' },
};

export function transitionLabel(p: Polity, kind: Kind): string {
  const special = SPECIAL[p.en]?.[kind];
  if (special) return special;
  const name = p.ru || p.en;
  switch (kind) {
    case 'appear':
      return `появляется «${name}»`;
    case 'vanish':
      return `конец государства «${name}»`;
    case 'grow':
      return `«${name}» расширяется`;
    default:
      return `«${name}» теряет земли`;
  }
}
