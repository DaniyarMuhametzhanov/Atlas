import { lazy, Suspense } from 'react';
import { MapErrorBoundary } from './MapErrorBoundary';
import s from './MapView.module.css';

// Библиотека карты большая (~250 КБ в сжатом виде), поэтому грузится отдельным файлом —
// страница и буклет появляются, не дожидаясь её.
const AtlasMap = lazy(() => import('./AtlasMap'));

export function MapView() {
  return (
    <MapErrorBoundary>
      <Suspense fallback={<div className={s.map}><p className={s.loading}>Загружаю карту…</p></div>}>
        <AtlasMap />
      </Suspense>
    </MapErrorBoundary>
  );
}
