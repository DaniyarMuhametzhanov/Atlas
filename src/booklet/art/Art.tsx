import { useMemo } from 'react';
import { scene } from './art';
import s from './Art.module.css';

/** Запасная картинка вместо фото: пейзаж (land) и силуэт (motif); seed делает рисунок узнаваемым и неизменным */
export function Art({ motif, land, seed, big }: { motif: string; land: string; seed: string; big?: boolean }) {
  // SVG собирается из констант кода (не из пользовательского ввода), поэтому вставка разметкой безопасна
  const html = useMemo(() => scene(motif, land, seed, { big }), [motif, land, seed, big]);
  return <span className={s.art} role="img" aria-label="Рисунок вместо фото" dangerouslySetInnerHTML={{ __html: html }} />;
}
