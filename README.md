# Атлас-путеводитель 2.0

Интерактивный атлас мира. Проект переносится со старой однофайловой версии (`legacy/atlas-v1.html`) на TypeScript + React + MapLibre по этапам.

## Как запустить

Нужен Node.js 20 или новее.

```bash
npm install
npm run dev         # запуск для разработки: http://localhost:5173
npm run build       # веб-версия в папке dist/
npm test            # модульные тесты (Vitest)
npm run lint        # проверка кода (ESLint)
npm run data        # заново подготовить все данные: извлечь из legacy/atlas-v1.html, скачать шрифты карты, собрать карту
```

## Где что лежит

| Папка | Что там |
|---|---|
| `legacy/` | старая версия атласа — исходник для извлечения |
| `content/` | тексты: страны (`countries/KAZ.json`), места, история, эпохи, источники фото |
| `public/` | картинки и карты: фото, значки, границы, рельеф |
| `scripts/` | скрипты подготовки данных |
| `src/app/` | приложение, раскладка экрана, роутер на `location.hash` |
| `src/map/` | карта MapLibre: стиль, слои, нажатия, клавиши |
| `assets-src/` | исходники для подготовки данных (в сайт не попадают) |
| `src/booklet/` | буклет страны и 6 вкладок |
| `src/search/` | поиск: нечёткое сравнение, список того, что ищем, поле с подсказками |
| `src/quiz/`, `src/tour/`, `src/compare/` | викторина, случайная экскурсия, сравнение стран |
| `src/store/` | общее хранилище состояния (Zustand) |
| `src/styles/` | цвета и шрифты (`tokens.css`), темы |
| `src/content/schema.ts` | схемы данных (Zod) |
| `reports/` | отчёты по этапам |

## Этапы

- [x] 1. Разбор старого файла
- [x] 2. Извлечение данных — отчёт `reports/stage-2-extract.md`
- [x] 3. Каркас (Vite + React + TS) — отчёт `reports/stage-3-skeleton.md`
- [x] 4. Карта (MapLibre) — отчёт `reports/stage-4-map.md`
- [x] 5. Буклет с 6 вкладками — отчёт `reports/stage-5-booklet.md`
- [x] 6. Фото на весь экран — отчёт `reports/stage-6-photos.md`
- [x] 7. Машина времени — отчёт `reports/stage-7-time-machine.md`
- [x] 8. Наполнение текстами — отчёт `reports/stage-8-texts.md`
- [x] 9. Поиск, викторина, «Исследователь», сравнение — отчёт `reports/stage-9-search-quiz.md`
- [ ] 10. Полировка и сборки
