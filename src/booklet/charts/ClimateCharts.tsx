// Климат столицы по месяцам: два маленьких графика с общей шкалой месяцев —
// температура (линии: минимум и максимум) и осадки (столбики). Не один график с двумя осями:
// у температуры и осадков разные единицы, на двойной оси их легко сравнить неверно.
import { useEffect, useRef } from 'react';
import type { Chart as ChartType } from 'chart.js';
import { useStore } from '../../store/store';
import s from './charts.module.css';

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
type Row = { month: number; tMin: number; tMax: number; rainMm: number };

export function ClimateCharts({ rows, city }: { rows: Row[]; city: string }) {
  const tRef = useRef<HTMLCanvasElement>(null);
  const rRef = useRef<HTMLCanvasElement>(null);
  const theme = useStore((st) => st.theme);
  const data = [...rows].sort((a, b) => a.month - b.month);

  useEffect(() => {
    let charts: ChartType[] = [];
    let alive = true;
    // Chart.js грузится отдельным файлом, только когда есть что рисовать
    import('chart.js/auto').then(({ default: Chart }) => {
      if (!alive || !tRef.current || !rRef.current) return;
      const cs = getComputedStyle(tRef.current);
      const v = (n: string) => cs.getPropertyValue(n).trim();
      const ink = v('--muted');
      const grid = v('--grid');
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const common = {
        responsive: true,
        maintainAspectRatio: false,
        animation: reduced ? (false as const) : { duration: 300 },
        interaction: { mode: 'index' as const, intersect: false },
        plugins: {
          tooltip: { backgroundColor: v('--ink'), titleColor: v('--paper'), bodyColor: v('--paper'), displayColors: true, boxPadding: 4 },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: ink, font: { size: 11 } }, border: { color: grid } },
          y: { grid: { color: grid }, ticks: { color: ink, font: { size: 11 }, maxTicksLimit: 5 }, border: { display: false } },
        },
      };
      charts = [
        new Chart(tRef.current, {
          type: 'line',
          data: {
            labels: MONTHS,
            datasets: [
              { label: 'Максимум, °C', data: data.map((r) => r.tMax), borderColor: v('--series-2'), backgroundColor: v('--series-2'), borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0.3 },
              { label: 'Минимум, °C', data: data.map((r) => r.tMin), borderColor: v('--series-1'), backgroundColor: v('--series-1'), borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0.3 },
            ],
          },
          options: { ...common, plugins: { ...common.plugins, legend: { labels: { color: v('--ink'), boxWidth: 12, boxHeight: 2, font: { size: 12 } } } } },
        }),
        new Chart(rRef.current, {
          type: 'bar',
          data: {
            labels: MONTHS,
            datasets: [{ label: 'Осадки, мм', data: data.map((r) => r.rainMm), backgroundColor: v('--series-1'), borderRadius: 4, borderSkipped: 'start', maxBarThickness: 18 }],
          },
          options: { ...common, plugins: { ...common.plugins, legend: { display: false } } },
        }),
      ];
    });
    return () => {
      alive = false;
      charts.forEach((c) => c.destroy());
    };
    // перерисовываем при смене темы, чтобы взять новые цвета
  }, [rows, theme]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={s.climate}>
      <p className={s.caption}>Температура, °C — {city}</p>
      <div className={s.box}>
        <canvas ref={tRef} role="img" aria-label={`Температура по месяцам в городе ${city}`} />
      </div>
      <p className={s.caption}>Осадки, мм</p>
      <div className={`${s.box} ${s.small}`}>
        <canvas ref={rRef} role="img" aria-label={`Осадки по месяцам в городе ${city}`} />
      </div>
      <details className={s.table}>
        <summary>Таблица</summary>
        <table>
          <thead>
            <tr><th>Месяц</th><th>Мин., °C</th><th>Макс., °C</th><th>Осадки, мм</th></tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.month}><td>{MONTHS[r.month - 1]}</td><td>{r.tMin}</td><td>{r.tMax}</td><td>{r.rainMm}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
