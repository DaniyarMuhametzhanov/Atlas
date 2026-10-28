import { useRef, type PointerEvent, type ReactNode } from 'react';
import { useStore, type SheetState } from '../store/store';
import s from './BottomSheet.module.css';

const ORDER: SheetState[] = ['collapsed', 'half', 'full'];
const LABEL: Record<SheetState, string> = { collapsed: 'свёрнута', half: 'на половину экрана', full: 'на весь экран' };

// Выдвижная панель снизу (bottom sheet) для телефона: свёрнута / половина экрана / весь экран.
// Переключается нажатием на ручку или перетаскиванием вверх-вниз.
export function BottomSheet({ title, children }: { title?: string; children: ReactNode }) {
  const sheet = useStore((st) => st.sheet);
  const setSheet = useStore((st) => st.setSheet);
  const drag = useRef<{ y: number; moved: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const step = (dir: 1 | -1) => setSheet(ORDER[Math.max(0, Math.min(2, ORDER.indexOf(sheet) + dir))]);

  const down = (e: PointerEvent) => {
    drag.current = { y: e.clientY, moved: false };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!drag.current || !ref.current) return;
    const dy = e.clientY - drag.current.y;
    if (Math.abs(dy) > 6) drag.current.moved = true;
    ref.current.style.transform = `translateY(${Math.max(dy, -window.innerHeight)}px)`;
  };
  const up = (e: PointerEvent) => {
    if (!drag.current || !ref.current) return;
    const dy = e.clientY - drag.current.y;
    ref.current.style.transform = '';
    if (!drag.current.moved) step(sheet === 'full' ? -1 : 1);
    else if (Math.abs(dy) > 40) step(dy < 0 ? 1 : -1);
    drag.current = null;
  };

  return (
    <div ref={ref} className={s.sheet} data-state={sheet} role="region" aria-label={`Буклет: ${title ?? ''}`}>
      <button
        type="button"
        className={s.handle}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') { e.preventDefault(); step(1); }
          if (e.key === 'ArrowDown') { e.preventDefault(); step(-1); }
        }}
        aria-label={`Панель ${LABEL[sheet]}. Нажмите или потяните, чтобы изменить`}
      >
        <span className={s.grip} aria-hidden="true" />
        <span className={s.title}>{title}</span>
      </button>
      <div className={s.body}>{children}</div>
    </div>
  );
}
