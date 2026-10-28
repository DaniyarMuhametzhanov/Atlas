// Схемы данных атласа (Zod). Проверяют файлы из content/ и дают понятную ошибку, если поле пропущено.
// Поля, которых не было в старой версии (факты, этикет, климат…), пока необязательны:
// вкладка покажет «Скоро появится». На этапе 8 их заполняем и ужесточаем схему.
import { z } from 'zod';

export const RegionId = z.enum(['eu', 'me', 'as', 'af', 'am', 'oc']);
export type RegionId = z.infer<typeof RegionId>;

const Text = z.string().trim().min(1);
const PhotoId = z.string().regex(/^[a-z0-9-]+$/);
const PlaceId = z.string().regex(/^[a-z0-9-]+$/);

export const Place = z.object({
  name: Text,
  text: Text,
  photos: z.array(PhotoId).optional(),
  lon: z.number().optional(),
  lat: z.number().optional(),
});
export type Place = z.infer<typeof Place>;

export const Country = z.object({
  id: z.string().regex(/^[A-Z]{3}$/),
  name: Text,
  nameEn: Text,
  region: RegionId,
  capital: Text,
  tagline: Text,
  fame: Text,
  updated: Text,
  icon: z.object({ motif: Text, fix: z.string().optional() }),

  overview: z.object({
    intro: Text,
    facts: z
      .object({ area: z.number().positive(), population: z.number().positive(), gdpPerCapita: z.number().optional() })
      .optional(),
    timeline: z.array(z.object({ year: Text, text: Text })).min(1),
    funFact: Text,
  }),

  tourist: z.object({
    sights: z.array(Place),
    nature: z.array(PlaceId),
    reserves: z.array(PlaceId),
    wonders: z.array(PlaceId),
    practical: z
      .object({
        currency: Text,
        rateHint: z.string().optional(),
        languages: z.array(Text),
        phrases: z.array(z.object({ ru: Text, local: Text, say: Text })).optional(),
        plugs: Text,
        voltage: Text,
        timezone: Text,
        visaKZ: z.string().optional(),
        visaRU: z.string().optional(),
        bestSeason: Text,
        asOf: z.string().optional(),
      })
      .optional(),
    climate: z
      .array(z.object({ month: z.number().int().min(1).max(12), tMin: z.number(), tMax: z.number(), rainMm: z.number() }))
      .length(12)
      .optional(),
    food: z.array(z.object({ name: Text, text: Text, photo: PhotoId.optional() })).optional(),
    etiquette: z.object({ do: z.array(Text), dont: z.array(Text) }).optional(),
    danger: z.object({ level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), text: Text, asOf: Text }),
  }),

  politics: z.object({
    system: Text,
    leaders: z.string().optional(),
    parties: z.string().optional(),
    mood: Text,
    economy: z.string().optional(),
    techInfra: Text,
    freedom: z
      .array(z.object({ source: z.enum(['Freedom House', 'V-Dem']), score: Text, year: z.number().int() }))
      .optional(),
    asOf: z.string().optional(), // «верно на: осень 2026»
  }),

  culture: z.object({
    ethnic: z.array(z.object({ group: Text, percent: z.number().min(0).max(100) })).optional(),
    ethnicSource: z.string().optional(), // перепись и её год
    languages: z.array(Text).optional(),
    religions: z.array(z.object({ name: Text, percent: z.number().optional() })).optional(),
    character: Text,
    traditions: z.array(Text),
    holidays: z.array(z.object({ date: Text, name: Text, text: Text })).optional(),
    people: z.array(z.object({ name: Text, who: Text })).optional(),
  }),

  relations: z.object({
    internal: z.string().optional(),
    neighbors: Text,
    world: z
      .array(
        z.object({
          country: z.string().regex(/^[A-Z]{3}$/), // код ISO страны
          status: z.enum(['союз', 'дружба', 'нейтрально', 'напряжённость', 'конфликт']),
          text: Text,
        }),
      )
      .optional(),
    attitudes: z.array(z.object({ toward: Text, text: Text, source: Text, year: z.number().int() })).optional(),
    asOf: z.string().optional(),
  }),

  stereotypes: z
    .object({
      about: z.array(z.object({ myth: Text, reality: Text, source: z.string().optional() })),
      held: z.array(z.object({ myth: Text, reality: Text, source: z.string().optional() })),
    })
    .optional(),

  photos: z.object({ cover: PhotoId.optional(), gallery: z.array(PhotoId).optional() }),
});
export type Country = z.infer<typeof Country>;

// Природное место, заповедник или чудо света
export const MapPlace = z.object({
  id: PlaceId,
  country: z.string().regex(/^[A-Z]{3}$/),
  name: Text,
  type: Text, // тип природы (lake, volcano…), "reserve" или вид чуда (a / n / p)
  lon: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
  text: Text,
  main: z.boolean(),
  photo: PhotoId.optional(),
  icon: z.string().optional(), // путь к значку 72×72 в public/
});
export type MapPlace = z.infer<typeof MapPlace>;

export const PhotoSource = z.object({
  id: PhotoId,
  title: Text,
  author: Text,
  license: Text,
  url: z.string().url(),
  sizes: z.array(z.number().int().positive()).min(1),
  files: z.record(z.string(), z.string()), // ширина → путь в public/
});
export type PhotoSource = z.infer<typeof PhotoSource>;

export const HistoryBooklet = z.object({
  id: PlaceId,
  name: Text,
  keys: z.array(Text).min(1), // имена государства в данных Cliopatria
  years: Text,
  capital: Text,
  intro: Text,
  timeline: z.array(z.object({ year: Text, text: Text })),
  heritage: Text, // чем запомнилось
  photo: PhotoId.optional(),
});
export type HistoryBooklet = z.infer<typeof HistoryBooklet>;

export const Polity = z.object({
  i: z.number().int().nonnegative(), // номер в таблице имён Cliopatria (поле n в геометрии)
  en: Text,
  ru: z.string(),
  span: z.tuple([z.number().int(), z.number().int()]).optional(),
});
export type Polity = z.infer<typeof Polity>;

export const WorldEvent = z.object({ lane: Text, year: z.number().int(), title: Text, text: Text });
export const Find = z.object({ year: z.number().int(), title: Text, text: Text, photo: PhotoId.optional() });
