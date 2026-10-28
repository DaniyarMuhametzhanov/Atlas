// Проверяет исторические буклеты по схеме и собирает индекс «имя на карте → буклет».
// Запуск: npm run build:booklets
import path from 'node:path';
import { buildBookletIndex } from './lib/booklets.ts';

const r = buildBookletIndex(path.resolve(import.meta.dirname, '..'));
console.log(`Буклетов: ${r.count}, имён на карте: ${r.names}`);
if (r.problems.length) {
  console.log('Ошибки:\n' + r.problems.map((p) => '  ' + p).join('\n'));
  process.exitCode = 1;
}
