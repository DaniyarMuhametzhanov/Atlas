// Индекс исторических буклетов: id, название, имена государства на карте (keys) и синонимы.
// Клиент грузит только этот маленький файл, а сам буклет — при открытии.
import fs from 'node:fs';
import path from 'node:path';
import { HistoryBooklet } from '../../src/content/schema.ts';

export function buildBookletIndex(root: string) {
  const dir = path.join(root, 'content/history/booklets');
  const aliases = JSON.parse(fs.readFileSync(path.join(root, 'content/history/aliases.json'), 'utf8')) as Record<string, string>;
  const index: Record<string, string> = {}; // имя на карте → id буклета
  const problems: string[] = [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  for (const f of files) {
    const b = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const r = HistoryBooklet.safeParse(b);
    if (!r.success) problems.push(`${f}: ${r.error.issues[0].path.join('.')} — ${r.error.issues[0].message}`);
    if (b.id !== f.replace(/\.json$/, '')) problems.push(`${f}: id «${b.id}» не совпадает с именем файла`);
    for (const k of b.keys as string[]) {
      if (index[k] && index[k] !== b.id) problems.push(`имя «${k}» есть и в ${index[k]}, и в ${b.id}`);
      index[k] = b.id;
    }
  }
  for (const [alias, key] of Object.entries(aliases)) if (index[key] && !index[alias]) index[alias] = index[key];
  fs.writeFileSync(path.join(root, 'content/history/booklets-index.json'), JSON.stringify(index, null, 1) + '\n');
  return { count: files.length, names: Object.keys(index).length, problems };
}
