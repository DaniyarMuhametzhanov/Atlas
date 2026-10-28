// Управление картой с клавиатуры:
//   W A S D / стрелки — двигать (Shift — быстрее), Q / E и − / + — масштаб, R — весь мир, G — глобус, F — поиск.
// Стрелки работают, когда мышь над картой или карта в фокусе, — иначе они нужны странице и вкладкам.
import { useEffect, type RefObject } from 'react';
import type { Map as MlMap } from 'maplibre-gl';
import { useStore } from '../store/store';

const DIR: Record<string, [number, number]> = {
  KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0],
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
};
const ZOOM: Record<string, number> = { KeyE: 1, KeyQ: -1, Equal: 1, NumpadAdd: 1, Minus: -1, NumpadSubtract: -1 };

export function useMapKeyboard(mapRef: RefObject<MlMap | null>, box: RefObject<HTMLElement>) {
  useEffect(() => {
    const held = new Set<string>();
    let raf = 0;
    let last = 0;
    let over = false;
    const el = box.current;
    const enter = () => (over = true);
    const leave = () => (over = false);
    el?.addEventListener('pointerenter', enter);
    el?.addEventListener('pointerleave', leave);

    const skip = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey) return true;
      if (document.documentElement.classList.contains('pswp-open')) return true; // открыто фото на весь экран
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return true;
      if (t?.closest('[role=tablist], [role=dialog]')) return true;
      return false;
    };
    const step = (ts: number) => {
      const map = mapRef.current;
      const dt = Math.min(50, ts - (last || ts));
      last = ts;
      let dx = 0, dy = 0;
      for (const c of held) if (DIR[c]) [dx, dy] = [dx + DIR[c][0], dy + DIR[c][1]];
      if (map && (dx || dy)) {
        const fast = held.has('ShiftLeft') || held.has('ShiftRight');
        const px = ((fast ? 900 : 450) * dt) / 1000;
        const n = Math.hypot(dx, dy);
        map.panBy([(dx / n) * px, (dy / n) * px], { duration: 0 });
      }
      raf = [...held].some((c) => DIR[c]) ? requestAnimationFrame(step) : 0;
      if (!raf) last = 0;
    };

    const down = (e: KeyboardEvent) => {
      const map = mapRef.current;
      if (!map || skip(e)) return;
      if (e.code.startsWith('Arrow') && !over && document.activeElement !== el) return;
      if (DIR[e.code]) {
        e.preventDefault();
        held.add(e.code);
        if (!raf) raf = requestAnimationFrame(step);
        return;
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') return void held.add(e.code);
      if (e.repeat) return;
      const instant = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (ZOOM[e.code]) {
        e.preventDefault();
        map.zoomTo(map.getZoom() + ZOOM[e.code] * 0.6, { duration: instant ? 0 : 250 });
      } else if (e.code === 'KeyR') {
        map.fitBounds([[-170, -58], [190, 78]], { duration: instant ? 0 : 500 });
      } else if (e.code === 'KeyG') {
        const st = useStore.getState();
        st.setGlobe(!st.globe);
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[type=search]')?.focus();
      }
    };
    const up = (e: KeyboardEvent) => held.delete(e.code);
    const blur = () => held.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      el?.removeEventListener('pointerenter', enter);
      el?.removeEventListener('pointerleave', leave);
      cancelAnimationFrame(raf);
    };
  }, [mapRef, box]);
}
