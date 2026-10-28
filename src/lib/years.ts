// Годы хранятся числами: отрицательные — до нашей эры (−500 = 500 до н.э.). Нулевого года нет.

/** −500 → «500 до н.э.», 1991 → «1991» */
export function formatYear(y: number): string {
  if (!Number.isInteger(y)) throw new Error(`Год должен быть целым: ${y}`);
  return y < 0 ? `${-y} до н.э.` : String(y);
}

/** «500 до н.э.» / «500 до н. э.» / «-500» / «1991» → число, или null, если не понял */
export function parseYear(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ');
  const m = /^([-−]?)(\d{1,4})( ?до н\.? ?э\.?)?$/.exec(t);
  if (!m) return null;
  const n = Number(m[2]);
  if (n === 0) return null;
  return m[1] || m[3] ? -n : n;
}
