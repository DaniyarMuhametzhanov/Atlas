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
  setRoute: (r: Route) => void;
  setTheme: (t: Theme) => void;
  toggleLayer: (id: LayerId) => void;
  setSheet: (s: SheetState) => void;
  setTimeMachine: (on: boolean) => void;
  setYear: (y: number) => void;
};

export const useStore = create<State>((set) => ({
  route: parseHash(location.hash),
  lastTab: readStored<TabId>('atlas.lastTab', 'overview'),
  theme: readStored<Theme>('atlas.theme', 'system'),
  layers: { ...DEFAULT_LAYERS, ...readStored<Partial<Layers>>('atlas.layers', {}) },
  sheet: 'collapsed',
  timeMachine: false,
  year: 2024,

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
}));
