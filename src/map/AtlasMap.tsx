// Карта мира на MapLibre GL (рисует через видеокарту — WebGL).
import { useEffect, useRef, useState } from 'react';
import maplibregl, { type ExpressionSpecification, type GeoJSONSource, type Map as MlMap, type MapGeoJSONFeature } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useStore, type FlyTo, type LayerId } from '../store/store';
import { navigate } from '../app/router';
import { PHONE } from '../app/useMedia';
import { loadDetailedBorders, loadMapData, type MapData, type PointProps } from './data';
import { applyTheme, buildStyle, INTERACTIVE, KIND_BY_LAYER, LAYER_GROUPS, themeColors } from './style';
import { useMapKeyboard } from './useMapKeyboard';
import { MapControls } from './MapControls';
import { TimeLayers } from './time/timeLayers';
import { TimeBar } from './time/TimeBar';
import { loadPolities, type Polity } from './time/data';
import s from './MapView.module.css';

const BASE = import.meta.env.BASE_URL;
const REL_CLASS = { союз: 'alliance', дружба: 'friend', нейтрально: 'neutral', напряжённость: 'tension', конфликт: 'conflict' } as const;
const WORLD: [[number, number], [number, number]] = [[-170, -58], [190, 78]];
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Зелёный кружок с белой галочкой — «страна изучена» */
function checkBadge(): ImageData {
  const c = document.createElement('canvas');
  c.width = c.height = 36;
  const g = c.getContext('2d')!;
  g.beginPath();
  g.arc(18, 18, 15, 0, Math.PI * 2);
  g.fillStyle = '#1f7a4d';
  g.fill();
  g.lineWidth = 3.5;
  g.strokeStyle = '#fff';
  g.stroke();
  g.beginPath();
  g.moveTo(10.5, 18.5);
  g.lineTo(16, 24);
  g.lineTo(25.5, 12.5);
  g.lineWidth = 4;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.stroke();
  return g.getImageData(0, 0, 36, 36);
}

/** Значки грузим по требованию: MapLibre сообщает, какой картинки не хватает */
function setupImages(map: MlMap) {
  const pending = new Set<string>();
  // запасные кружки для мест без значка
  const dot = (color: string) => {
    const c = document.createElement('canvas');
    c.width = c.height = 40;
    const g = c.getContext('2d')!;
    g.beginPath();
    g.arc(20, 20, 15, 0, Math.PI * 2);
    g.fillStyle = color;
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = '#fff';
    g.stroke();
    return g.getImageData(0, 0, 40, 40);
  };
  map.on('styleimagemissing', (e) => {
    const id = e.id;
    if (id === 'explored-check') {
      if (!map.hasImage(id)) map.addImage(id, checkBadge(), { pixelRatio: 2 });
      return;
    }
    if (id.startsWith('dot-')) {
      const color = id === 'dot-wonder' ? '#c9a227' : id === 'dot-reserve' ? '#1b5e20' : '#1f7a4d';
      if (!map.hasImage(id)) map.addImage(id, dot(color), { pixelRatio: 1 });
      return;
    }
    if (pending.has(id) || map.hasImage(id)) return;
    pending.add(id);
    // картинка добавляется, когда загрузится; MapLibre сам перерисует значки
    map
      .loadImage(`${BASE}img/badges/${id}.png`)
      .then((img) => {
        if (!map.hasImage(id)) map.addImage(id, img.data, { pixelRatio: 1 });
      })
      .catch(() => {
        /* значка нет — останется подпись */
      });
  });
}

export default function AtlasMap() {
  const box = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const dataRef = useRef<MapData | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const route = useStore((st) => st.route);
  const layers = useStore((st) => st.layers);
  const mapMode = useStore((st) => st.mapMode);
  const globe = useStore((st) => st.globe);
  const theme = useStore((st) => st.theme);
  const relationsMap = useStore((st) => st.relationsMap);
  const setRelationsMap = useStore((st) => st.setRelationsMap);
  const flyTo = useStore((st) => st.flyTo);
  const explored = useStore((st) => st.explored);
  const compareIds = route.name === 'compare' ? route.ids.join(',') : '';
  const selected = route.name === 'country' ? route.id : '';
  const timeMachine = route.name === 'time';
  const timePolity = route.name === 'time' ? route.polity : undefined;
  const year = useStore((st) => st.year);
  const peoples = useStore((st) => st.peoples);
  const links = useStore((st) => st.links);
  const historyOf = useStore((st) => st.historyOf);
  const timeRef = useRef<TimeLayers | null>(null);
  const politiesRef = useRef<Polity[]>([]);
  const [timeReady, setTimeReady] = useState(false);

  // ---------- создание карты ----------
  useEffect(() => {
    let map: MlMap | null = null;
    let cancelled = false;
    loadMapData()
      .then((data) => {
        if (cancelled || !box.current) return;
        dataRef.current = data;
        map = new maplibregl.Map({
          container: box.current,
          style: buildStyle(data, themeColors(), useStore.getState().mapMode),
          bounds: WORLD,
          minZoom: 0,
          maxZoom: 10,
          renderWorldCopies: true,
          attributionControl: { compact: true },
          dragRotate: false,
          pitchWithRotate: false,
          keyboard: false, // свои клавиши: WASD, Q/E и т.д.
          cooperativeGestures: false,
        });
        map.touchZoomRotate.disableRotation();
        mapRef.current = map;
        // для автотестов (Playwright): доступ к карте из консоли
        (window as unknown as { __atlasMap?: MlMap }).__atlasMap = map;
        setupImages(map);
        map.on('load', () => {
          if (useStore.getState().globe) map!.setProjection({ type: 'globe' });
          setReady(true);
        });
        map.on('error', (e) => console.warn('Карта:', e.error?.message ?? e));
        setupInteraction(map, tip.current!);
        setupDetail(map, data);
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // ---------- выбранная страна: обводка, её места поверх, перелёт ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setFilter('countries-selected', ['==', ['get', 'iso'], selected]);
    applyPlaceFilters(map, selected, useStore.getState().layers);
    if (!selected) return;
    // из поиска выбрали город или место этой страны — летим прямо к нему
    const ft = useStore.getState().flyTo;
    if (ft?.iso === selected) {
      flyCamera(map, ft);
      useStore.getState().setFlyTo(null);
      return;
    }
    const p = dataRef.current?.points.features.find((f) => f.properties.iso === selected);
    if (!p) return;
    const [, so, , n] = p.properties.bbox;
    let [w, , e] = p.properties.bbox;
    if (e < w) e += 360; // страна пересекает линию перемены дат (Россия, Фиджи)
    if (e - w > 200) [w, e] = [p.geometry.coordinates[0] - 40, p.geometry.coordinates[0] + 40];
    const phone = matchMedia(PHONE).matches;
    const h = map.getContainer().clientHeight;
    map.fitBounds(
      [[w, so], [e, n]],
      {
        padding: phone ? { top: 40, bottom: Math.round(h * 0.52) + 20, left: 30, right: 30 } : 50,
        maxZoom: 5.5,
        duration: reducedMotion() ? 0 : 1200,
        essential: false,
      },
    );
  }, [selected, ready]);

  // ---------- «Исследователь»: галочки у изученных стран ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setFilter('explored', ['in', ['get', 'iso'], ['literal', explored]]);
  }, [explored, ready]);

  // ---------- сравнение: обводка у всех сравниваемых стран, карта показывает их вместе ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !compareIds) return;
    const ids = compareIds.split(',');
    map.setFilter('countries-selected', ['in', ['get', 'iso'], ['literal', ids]]);
    const boxes = ids.flatMap((id) => {
      const p = dataRef.current?.points.features.find((f) => f.properties.iso === id);
      if (!p) return [];
      const [w, so, e, n] = p.properties.bbox;
      // страна через линию перемены дат (Россия) — вместо рамки берём окрестность её значка
      if (e < w || e - w > 200) {
        const [x, y] = p.geometry.coordinates;
        return [[x - 30, y - 12, x + 30, y + 12]];
      }
      return [[w, so, e, n]];
    });
    if (boxes.length) {
      const box = boxes.reduce((b, x) => [Math.min(b[0], x[0]), Math.min(b[1], x[1]), Math.max(b[2], x[2]), Math.max(b[3], x[3])]);
      map.fitBounds([[box[0], box[1]], [box[2], box[3]]], { padding: 50, maxZoom: 5, duration: reducedMotion() ? 0 : 1200 });
    }
    return () => {
      map.setFilter('countries-selected', ['==', ['get', 'iso'], '']);
    };
  }, [compareIds, ready]);

  // ---------- перелёт по запросу (поиск, экскурсия) ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !flyTo) return;
    if (flyTo.iso && flyTo.iso !== selected) return; // дождёмся выбора страны (эффект выше)
    flyCamera(map, flyTo);
    useStore.getState().setFlyTo(null);
  }, [flyTo, ready, selected]);

  // ---------- флажки слоёв ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || timeMachine) return;
    for (const [group, ids] of Object.entries(LAYER_GROUPS) as [LayerId, string[]][]) {
      for (const id of ids) map.setLayoutProperty(id, 'visibility', layers[group] ? 'visible' : 'none');
    }
    for (const id of ['countries-fill', 'countries-selected', 'hit-small']) map.setLayoutProperty(id, 'visibility', 'visible');
    applyPlaceFilters(map, selected, layers);
  }, [layers, ready, selected, timeMachine]);

  // ---------- тема и режим «Рельеф / Регионы» ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const apply = () => {
      const c = themeColors();
      applyTheme(map, c, mapMode);
      timeRef.current?.refreshTheme(mapMode, c.dark);
    };
    // атрибут data-theme ставится в эффекте App — ждём кадр
    const raf = requestAnimationFrame(apply);
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener('change', apply);
    };
  }, [mapMode, theme, ready]);

  // ---------- режим «Отношения» ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const ids = new Set<string>();
    if (relationsMap) {
      map.setFeatureState({ source: 'borders', id: relationsMap.iso }, { center: true });
      ids.add(relationsMap.iso);
      for (const [iso, status] of Object.entries(relationsMap.statuses)) {
        map.setFeatureState({ source: 'borders', id: iso }, { rel: status });
        ids.add(iso);
      }
    }
    return () => {
      for (const iso of ids) map.setFeatureState({ source: 'borders', id: iso }, { center: false, rel: null });
    };
  }, [relationsMap, ready]);

  // ---------- глобус ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setProjection({ type: globe ? 'globe' : 'mercator' });
  }, [globe, ready]);

  // ---------- машина времени ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !timeMachine) return;
    let alive = true;
    loadPolities().then((polities) => {
      if (!alive) return;
      politiesRef.current = polities;
      const st = useStore.getState();
      timeRef.current = new TimeLayers(map, polities, tip.current!, {
        onToast: (text) => useStore.getState().setTimeToast(text),
        onActive: (rows) => useStore.getState().setTimeActive(rows),
        onSelect: (p) => {
          const y = useStore.getState().year;
          useStore.getState().setPlaying(false);
          navigate({ name: 'time', year: y, ...(p ? { polity: p.en } : {}) });
        },
      });
      timeRef.current.enable(st.mapMode, themeColors().dark);
      timeRef.current.setPeoples(st.peoples);
      void timeRef.current.setLinks(st.links);
      timeRef.current.setHistoryOf(st.historyOf);
      void timeRef.current.setYear(st.year);
      setTimeReady(true);
    });
    return () => {
      alive = false;
      timeRef.current?.disable();
      timeRef.current = null;
      setTimeReady(false);
      useStore.getState().setPlaying(false);
    };
  }, [ready, timeMachine]);

  useEffect(() => {
    if (timeReady) void timeRef.current?.setYear(year);
  }, [year, timeReady]);
  useEffect(() => {
    if (timeReady) timeRef.current?.setPeoples(peoples);
  }, [peoples, timeReady]);
  useEffect(() => {
    if (timeReady) void timeRef.current?.setLinks(links);
  }, [links, timeReady]);
  useEffect(() => {
    if (timeReady) timeRef.current?.setMode(mapMode);
  }, [mapMode, timeReady]);
  useEffect(() => {
    if (!timeReady) return;
    const i = timePolity ? politiesRef.current.find((p) => p.en === timePolity)?.i ?? null : null;
    timeRef.current?.select(i);
  }, [timePolity, timeReady]);
  // «История одной страны»: показываем только её территорию и перелетаем к ней
  useEffect(() => {
    if (!timeReady) return;
    timeRef.current?.setHistoryOf(historyOf);
    const map = mapRef.current;
    const p = historyOf ? dataRef.current?.points.features.find((f) => f.properties.iso === historyOf) : null;
    if (!map || !p) return;
    const [w, so, e0, n] = p.properties.bbox;
    const e = e0 < w ? e0 + 360 : e0;
    map.fitBounds([[w, so], [e - w > 200 ? w + 80 : e, n]], { padding: 60, maxZoom: 5, duration: reducedMotion() ? 0 : 900 });
  }, [historyOf, timeReady]);

  useMapKeyboard(mapRef, box);

  return (
    <div className={s.map}>
      <div
        ref={box}
        className={s.canvas}
        tabIndex={0}
        role="application"
        aria-label="Карта мира. Клавиши: W A S D или стрелки — двигать, Q и E — масштаб, R — весь мир, G — глобус"
      />
      <div ref={tip} className={s.tip} role="status" aria-live="off" />
      {error ? <p className={s.error}>Карта не загрузилась: {error}</p> : null}
      {!ready && !error ? <p className={s.loading}>Загружаю карту…</p> : null}
      {timeMachine ? <TimeBar /> : null}
      {relationsMap && !timeMachine ? (
        <div className={s.relLegend} role="group" aria-label="Легенда режима «Отношения»">
          <b>Отношения</b>
          <span><i className={s.relCenter} />выбранная страна</span>
          {(['союз', 'дружба', 'нейтрально', 'напряжённость', 'конфликт'] as const).map((st) => (
            <span key={st}><i style={{ background: `var(--rel-${REL_CLASS[st]})` }} />{st}</span>
          ))}
          <button type="button" onClick={() => setRelationsMap(null)} aria-label="Выключить режим «Отношения»">✕</button>
        </div>
      ) : null}
      <MapControls
        onZoom={(d) => mapRef.current?.zoomTo(mapRef.current.getZoom() + d, { duration: reducedMotion() ? 0 : 250 })}
        onReset={() => mapRef.current?.fitBounds(WORLD, { duration: reducedMotion() ? 0 : 600 })}
      />
    </div>
  );
}

/** Плавный перелёт к точке или рамке; на телефоне нижнюю половину закрывает буклет */
function flyCamera(map: MlMap, ft: FlyTo) {
  const phone = matchMedia(PHONE).matches;
  const h = map.getContainer().clientHeight;
  const padding = phone ? { top: 40, bottom: Math.round(h * 0.52) + 20, left: 30, right: 30 } : { top: 50, bottom: 50, left: 50, right: 50 };
  const duration = reducedMotion() ? 0 : 1600;
  if (ft.bbox) {
    const [w, so, e, n] = ft.bbox;
    map.fitBounds([[w, so], [e, n]], { padding, maxZoom: ft.zoom ?? 5, duration, essential: false });
  } else if (ft.center) {
    map.flyTo({ center: ft.center, zoom: ft.zoom ?? 6, padding, duration, essential: false });
  }
}

/** Места выбранной страны рисует верхний слой; из обычных слоёв их убираем, чтобы не было двойных значков */
function applyPlaceFilters(map: MlMap, sel: string, layers: Record<LayerId, boolean>) {
  const notSel: ExpressionSpecification = ['!=', ['get', 'country'], sel];
  const kinds = (Object.keys(KIND_BY_LAYER) as LayerId[]).filter((k) => layers[k]).map((k) => KIND_BY_LAYER[k]!);
  const kindOk: ExpressionSpecification = ['in', ['get', 'kind'], ['literal', kinds]];
  map.setFilter('pins-selected', ['all', ['==', ['get', 'country'], sel], kindOk]);
  map.setFilter('pins-z6', ['all', notSel, kindOk]);
  map.setFilter('wonders', notSel);
  map.setFilter('nature-main', notSel);
  map.setFilter('nature-rest', ['all', ['!', ['has', 'point_count']], notSel]);
  map.setFilter('reserves', ['all', ['!', ['has', 'point_count']], notSel]);
}

/** Подсказка при наведении, подсветка страны, нажатия */
function setupInteraction(map: MlMap, tip: HTMLDivElement) {
  let hovered: string | null = null;
  const layers = () => INTERACTIVE.filter((id) => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none');
  const pick = (pt: maplibregl.PointLike): MapGeoJSONFeature | undefined => {
    const fs = map.queryRenderedFeatures(pt, { layers: layers() });
    // порядок важности: булавки и значки раньше заливки страны
    return fs.sort((a, b) => INTERACTIVE.indexOf(a.layer.id) - INTERACTIVE.indexOf(b.layer.id))[0];
  };
  const isoOf = (f: MapGeoJSONFeature): string | undefined => (f.properties.iso as string) ?? (f.properties.country as string);
  const setHover = (iso: string | null) => {
    if (iso === hovered) return;
    if (hovered) map.setFeatureState({ source: 'borders', id: hovered }, { hover: false });
    hovered = iso;
    if (iso) map.setFeatureState({ source: 'borders', id: iso }, { hover: true });
  };
  const label = (f: MapGeoJSONFeature) => {
    const p = f.properties as Record<string, string | number>;
    if (p.point_count) return `${p.point_count} мест — приблизить`;
    if (p.kind) return `${p.name}${p.kind === 'wonder' ? ' ★' : ''}`;
    if (f.layer.id.startsWith('capitals')) return `${p.name} — столица`;
    return `${p.name}${p.has === 0 ? ' (буклета пока нет)' : ''}`;
  };

  map.on('mousemove', (e) => {
    if (useStore.getState().route.name === 'time') return; // в машине времени свои подсказки
    const f = pick(e.point);
    map.getCanvas().style.cursor = f ? 'pointer' : '';
    setHover(f && !f.properties.point_count ? (isoOf(f) ?? null) : null);
    if (!f) {
      tip.style.opacity = '0';
      return;
    }
    tip.textContent = label(f);
    tip.style.transform = `translate(${e.point.x + 14}px, ${e.point.y + 14}px)`;
    tip.style.opacity = '1';
  });
  map.getCanvas().addEventListener('mouseleave', () => {
    tip.style.opacity = '0';
    setHover(null);
  });
  map.on('movestart', () => (tip.style.opacity = '0'));

  map.on('click', async (e) => {
    if (useStore.getState().route.name === 'time') return;
    const f = pick(e.point);
    if (!f) return;
    const p = f.properties as Record<string, string | number>;
    if (p.point_count) {
      const src = map.getSource(f.source) as GeoJSONSource;
      const zoom = await src.getClusterExpansionZoom(p.cluster_id as number);
      map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: zoom + 0.2, duration: reducedMotion() ? 0 : 500 });
      return;
    }
    const iso = isoOf(f);
    if (!iso) return;
    const pt = f.properties as Partial<PointProps>;
    if (pt.has === 0) return; // страна без буклета (Мальта, Сингапур…)
    if (p.kind) {
      useStore.getState().setFocusPlace(p.id as string);
      navigate({ name: 'country', id: iso, tab: 'tourist' });
    } else {
      useStore.getState().setFocusPlace(null);
      navigate({ name: 'country', id: iso });
    }
  });
}

/** С zoom 5 и ближе — подробные границы 10m */
function setupDetail(map: MlMap, data: MapData) {
  let detailed = false;
  const check = async () => {
    const z = map.getZoom();
    const src = map.getSource('borders') as GeoJSONSource | undefined;
    if (!src) return;
    if (z >= 5 && !detailed) {
      detailed = true;
      src.setData(await loadDetailedBorders());
    } else if (z < 4.5 && detailed) {
      detailed = false;
      src.setData(data.borders);
    }
  };
  map.on('zoomend', check);
}
