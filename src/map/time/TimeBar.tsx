// Проигрыватель машины времени: табло года, пуск / пауза, скорость, шкала лет с метками событий,
// «перейти к году», слои «Народы и культуры» и «Связи», режим «История одной страны».
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useStore } from '../../store/store';
import { navigate, replaceSilently } from '../../app/router';
import { COUNTRIES } from '../../content';
import { formatYear } from '../../lib/years';
import eventsJson from '../../../content/epochs/events.json';
import { EPOCHS, MAX_YEAR, MIN_YEAR, SCALE_MAX, posToYear, yearToPos } from './data';
import s from './TimeBar.module.css';

const SPEEDS = [0.5, 1, 2, 4, 8];
/** Одна эпоха (отрезок шкалы) длится 2,6 с на скорости 1× — как в старой версии */
const EPOCH_MS = 2600;
type Ev = { lane: string; year: number; title: string; text: string };
const EVENTS = (eventsJson.events as Ev[]).filter((e) => e.year >= MIN_YEAR && e.year <= MAX_YEAR).sort((a, b) => a.year - b.year);

export function TimeBar() {
  const year = useStore((st) => st.year);
  const setYear = useStore((st) => st.setYear);
  const playing = useStore((st) => st.playing);
  const setPlaying = useStore((st) => st.setPlaying);
  const speed = useStore((st) => st.speed);
  const setSpeed = useStore((st) => st.setSpeed);
  const peoples = useStore((st) => st.peoples);
  const setPeoples = useStore((st) => st.setPeoples);
  const links = useStore((st) => st.links);
  const setLinks = useStore((st) => st.setLinks);
  const historyOf = useStore((st) => st.historyOf);
  const setHistoryOf = useStore((st) => st.setHistoryOf);
  const toast = useStore((st) => st.timeToast);
  const route = useStore((st) => st.route);
  const polity = route.name === 'time' ? route.polity : undefined;
  const [shownToast, setShownToast] = useState<string | null>(null);
  const [goYear, setGoYear] = useState('');
  const [era, setEra] = useState<'bc' | 'ad'>('ad');
  const pos = useRef(yearToPos(year));
  const fps = useFps();

  // ---------- проигрывание ----------
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = 0;
    pos.current = yearToPos(useStore.getState().year);
    if (pos.current >= SCALE_MAX) pos.current = 0;
    const step = (ts: number) => {
      const dt = Math.min(100, last ? ts - last : 0);
      last = ts;
      pos.current += (dt / (EPOCH_MS / useStore.getState().speed)) * 1000;
      if (pos.current >= SCALE_MAX) {
        pos.current = SCALE_MAX;
        setYear(MAX_YEAR);
        setPlaying(false);
        return;
      }
      const y = posToYear(pos.current);
      if (y !== useStore.getState().year) setYear(y);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, setYear, setPlaying]);

  // адрес страницы повторяет год, но только на паузе (во время проигрывания не засоряем историю)
  useEffect(() => {
    if (playing) return;
    const t = setTimeout(() => replaceSilently({ name: 'time', year, ...(polity ? { polity } : {}) }), 300);
    return () => clearTimeout(t);
  }, [year, playing, polity]);

  // всплывающая подпись к резкому изменению
  useEffect(() => {
    if (!toast) return;
    setShownToast(toast.text);
    const t = setTimeout(() => setShownToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const jump = (y: number) => {
    setPlaying(false);
    pos.current = yearToPos(y);
    setYear(Math.max(MIN_YEAR, Math.min(MAX_YEAR, y)));
  };
  const go = (e: FormEvent) => {
    e.preventDefault();
    const v = Math.abs(Number.parseInt(goYear, 10));
    if (!v) return;
    jump(era === 'bc' ? -v : v);
    setGoYear('');
  };
  const epochStep = (dir: 1 | -1) => {
    const i = EPOCHS.findIndex((y) => y > year);
    const cur = i < 0 ? EPOCHS.length - 1 : i - 1;
    jump(EPOCHS[Math.max(0, Math.min(EPOCHS.length - 1, cur + dir))]);
  };
  const ticks = useMemo(() => EVENTS.map((e) => ({ ...e, left: (yearToPos(e.year) / SCALE_MAX) * 100 })), []);
  const countries = useMemo(() => COUNTRIES.filter((c) => c.id !== 'ATA' && c.id !== 'ATF'), []);

  return (
    <>
      {fps ? <div className={s.fps}>{fps}</div> : null}
      <div className={s.board} aria-live="off">
        <span className={s.num}>{Math.abs(year)}</span>
        {year < 0 ? <small>до н.э.</small> : null}
      </div>
      {shownToast ? (
        <div className={s.toast} role="status">
          {shownToast}
        </div>
      ) : null}
      <div className={s.bar} role="group" aria-label="Машина времени">
        <div className={s.row}>
          <button type="button" className={s.play} onClick={() => setPlaying(!playing)} aria-label={playing ? 'Пауза (пробел)' : 'Пуск (пробел)'}>
            {playing ? '❚❚' : '▶'}
          </button>
          <button type="button" className={s.round} onClick={() => epochStep(-1)} aria-label="Эпоха назад ([)" title="Эпоха назад ([)">⟨</button>
          <div className={s.scale}>
            <input
              type="range"
              min={0}
              max={SCALE_MAX}
              step={1}
              value={Math.round(yearToPos(year))}
              onChange={(e) => jump(posToYear(Number(e.target.value)))}
              aria-label="Год"
              aria-valuetext={formatYear(year)}
            />
            <div className={s.ticks}>
              {ticks.map((t) => (
                <button
                  key={`${t.year}-${t.title}`}
                  type="button"
                  className={s.tick}
                  style={{ left: `${t.left}%` }}
                  onClick={() => jump(t.year)}
                  title={`${formatYear(t.year)} — ${t.title}`}
                  aria-label={`${formatYear(t.year)} — ${t.title}`}
                  tabIndex={-1}
                />
              ))}
            </div>
          </div>
          <button type="button" className={s.round} onClick={() => epochStep(1)} aria-label="Эпоха вперёд (])" title="Эпоха вперёд (])">⟩</button>
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Скорость" className={s.speed}>
            {SPEEDS.map((v) => (
              <option key={v} value={v}>{v}×</option>
            ))}
          </select>
        </div>
        <div className={s.row}>
          <form className={s.go} onSubmit={go}>
            <input type="number" min={1} max={3400} inputMode="numeric" placeholder="Год" value={goYear} onChange={(e) => setGoYear(e.target.value)} aria-label="Перейти к году" />
            <select value={era} onChange={(e) => setEra(e.target.value as 'bc' | 'ad')} aria-label="Эра">
              <option value="ad">н.э.</option>
              <option value="bc">до н.э.</option>
            </select>
            <button type="submit">Перейти</button>
          </form>
          <label className={s.chk}>
            <input type="checkbox" checked={peoples} onChange={() => setPeoples(!peoples)} /> Народы и культуры
          </label>
          <label className={s.chk}>
            <input type="checkbox" checked={links} onChange={() => setLinks(!links)} /> Связи
          </label>
          <select value={historyOf ?? ''} onChange={(e) => setHistoryOf(e.target.value || null)} aria-label="История одной страны" className={s.country}>
            <option value="">🌍 Весь мир</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>История: {c.name}</option>
            ))}
          </select>
          <button type="button" className={s.close} onClick={() => navigate({ name: 'home' })}>✕ Закрыть</button>
        </div>
      </div>
    </>
  );
}

/** Счётчик кадров для проверки скорости на своём компьютере: откройте сайт с ?fps в адресе */
function useFps(): string | null {
  const on = typeof location !== 'undefined' && new URLSearchParams(location.search).has('fps');
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    let last = 0;
    let frames: number[] = [];
    let shown = performance.now();
    const loop = (t: number) => {
      if (last) frames.push(t - last);
      last = t;
      if (t - shown > 500 && frames.length) {
        const sorted = [...frames].sort((a, b) => a - b);
        const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
        setText(`${Math.round(1000 / avg)} кадр/с · самый долгий кадр ${Math.round(sorted[sorted.length - 1])} мс`);
        frames = [];
        shown = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  return text;
}
