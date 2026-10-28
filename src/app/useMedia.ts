import { useSyncExternalStore } from 'react';

/** true, если медиазапрос сейчас выполняется (например, '(max-width: 699px)') */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}

export const PHONE = '(max-width: 699px)';
