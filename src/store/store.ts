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
  mapMode: MapMode;
  globe: boolean;
  /** место, на которое нажали на карте: буклет прокручивает к его карточке */
  focusPlace: string | null;
  relationsMap: RelationsMap;
  setRoute: (r: Route) => void;
  setTheme: (t: Theme) => void;
  toggleLayer: (id: LayerId) => void;
  setSheet: (s: SheetState) => void;
  setTimeMachine: (on: boolean) => void;
  setYear: (y: number) => void;
  setMapMode: (m: MapMode) => void;
  setGlobe: (on: boolean) => void;
  setFocusPlace: (id: string | null) => void;
  setRelationsMap: (r: RelationsMap) => void;
};

export const useStore = create<State>((set) => ({
  route: parseHash(location.hash),
  lastTab: readStored<TabId>('atlas.lastTab', 'overview'),
  theme: readStored<Theme>('atlas.theme', 'system'),
  layers: { ...DEFAULT_LAYERS, ...readStored<Partial<Layers>>('atlas.layers', {}) },
  sheet: 'collapsed',
  timeMachine: false,
  year: 2024,
  mapMode: readStored<MapMode>('atlas.mapMode', 'relief'),
  globe: readStored<boolean>('atlas.globe', false),
  focusPlace: null,
  relationsMap: null,

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
}));
