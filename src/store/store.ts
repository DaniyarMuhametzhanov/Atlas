// Общее хранилище состояния (Zustand): его видят все компоненты.
// Адрес страницы — главный источник правды о том, что открыто; хранилище только повторяет его.
import { create } from 'zustand';
import { parseHash, type Route } from '../app/router';
import type { TabId } from '../booklet/tabs';
import { readStored, writeStored } from '../lib/storage';

export type Theme = 'system' | 'light' | 'dark';
export type SheetState = 'collapsed' | 'half' | 'full';
export type LayerId = 'countries' | 'nature' | 'reserves' | 'wonders' | 'capitals' | 'cities';
export type Layers = Record<LayerId, boolean>;
export type MapMode = 'relief' | 'regions';
export type RelationStatus = 'союз' | 'дружба' | 'нейтрально' | 'напряжённость' | 'конфликт';
/** Режим карты «Отношения»: выбранная страна в центре, остальные окрашены по статусу */
/**
 * Куда перелететь карте (поиск, экскурсия): точка с масштабом или рамка.
 * iso — перелёт ждёт, пока откроется эта страна (иначе карта сразу полетит к стране целиком).
 */
export type FlyTo = { center?: [number, number]; zoom?: number; bbox?: [number, number, number, number]; iso?: string; id: number };
export type RelationsMap = { iso: string; statuses: Record<string, RelationStatus> } | null;

const DEFAULT_LAYERS: Layers = {
  countries: true,
  nature: true,
  reserves: true,
  wonders: true,
  capitals: true,
  cities: false,
};

type State = {
  route: Route;
  lastTab: TabId;
  theme: Theme;
  layers: Layers;
  sheet: SheetState;
  timeMachine: boolean;
  year: number;
  playing: boolean;
  speed: number;
  /** слой «Народы и культуры» (historical-basemaps) */
  peoples: boolean;
  /** слой «Связи» (союзы, вассалитет…) */
  links: boolean;
  /** режим «История одной страны»: код современной страны */
  historyOf: string | null;
  /** подпись к резкому изменению границ («1991 — распад СССР») */
  timeToast: { text: string; id: number } | null;
  /** государства на карте в текущем году (для панели эпохи) */
  timeActive: import('../map/time/data').Row[];
  mapMode: MapMode;
  globe: boolean;
  /** место, на которое нажали на карте: буклет прокручивает к его карточке */
  focusPlace: string | null;
  relationsMap: RelationsMap;
  flyTo: FlyTo | null;
  setRoute: (r: Route) => void;
  setTheme: (t: Theme) => void;
  toggleLayer: (id: LayerId) => void;
  setSheet: (s: SheetState) => void;
  setTimeMachine: (on: boolean) => void;
  setYear: (y: number) => void;
  setPlaying: (on: boolean) => void;
  setSpeed: (v: number) => void;
  setPeoples: (on: boolean) => void;
  setLinks: (on: boolean) => void;
  setHistoryOf: (iso: string | null) => void;
  setTimeToast: (text: string | null) => void;
  setTimeActive: (rows: import('../map/time/data').Row[]) => void;
  setMapMode: (m: MapMode) => void;
  setGlobe: (on: boolean) => void;
  setFocusPlace: (id: string | null) => void;
  setRelationsMap: (r: RelationsMap) => void;
  setFlyTo: (f: Omit<FlyTo, 'id'> | null) => void;
};

export const useStore = create<State>((set) => ({
  route: parseHash(location.hash),
  lastTab: readStored<TabId>('atlas.lastTab', 'overview'),
  theme: readStored<Theme>('atlas.theme', 'system'),
  layers: { ...DEFAULT_LAYERS, ...readStored<Partial<Layers>>('atlas.layers', {}) },
  sheet: 'collapsed',
  timeMachine: false,
  year: 1700,
  playing: false,
  speed: 1,
  peoples: readStored<boolean>('atlas.peoples', true),
  links: readStored<boolean>('atlas.links', false),
  historyOf: null,
  timeToast: null,
  timeActive: [],
  mapMode: readStored<MapMode>('atlas.mapMode', 'relief'),
  globe: readStored<boolean>('atlas.globe', false),
  focusPlace: null,
  relationsMap: null,
  flyTo: null,

  setRoute: (route) =>
    set((s) => {
      if (route.name === 'country' && route.tab && route.tab !== s.lastTab) {
        writeStored('atlas.lastTab', route.tab);
        return { route, lastTab: route.tab };
      }
      return { route };
    }),
  setTheme: (theme) => {
    writeStored('atlas.theme', theme);
    set({ theme });
  },
  toggleLayer: (id) =>
    set((s) => {
      const layers = { ...s.layers, [id]: !s.layers[id] };
      writeStored('atlas.layers', layers);
      return { layers };
    }),
  setSheet: (sheet) => set({ sheet }),
  setTimeMachine: (timeMachine) => set({ timeMachine }),
  setYear: (year) => set({ year }),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  setPeoples: (peoples) => {
    writeStored('atlas.peoples', peoples);
    set({ peoples });
  },
  setLinks: (links) => {
    writeStored('atlas.links', links);
    set({ links });
  },
  setHistoryOf: (historyOf) => set({ historyOf }),
  setTimeToast: (text) => set((st) => ({ timeToast: text ? { text, id: (st.timeToast?.id ?? 0) + 1 } : null })),
  setTimeActive: (timeActive) => set({ timeActive }),
  setMapMode: (mapMode) => {
    writeStored('atlas.mapMode', mapMode);
    set({ mapMode });
  },
  setGlobe: (globe) => {
    writeStored('atlas.globe', globe);
    set({ globe });
  },
  setFocusPlace: (focusPlace) => set({ focusPlace }),
  setRelationsMap: (relationsMap) => set({ relationsMap }),
  setFlyTo: (f) => set((st) => ({ flyTo: f ? { ...f, id: (st.flyTo?.id ?? 0) + 1 } : null })),
}));
