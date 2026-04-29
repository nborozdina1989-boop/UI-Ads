# AdRiver оперативный дашборд (frontend-only прототип)

Прототип сделан без бэка: все данные лежат на фронте, агрегируются локальным query engine, UI реагирует на единые глобальные фильтры.

## Запуск

```bash
npm install
npm run dev
```

Открыть:
- `http://localhost:3000/dashboard/overview`

## Что реализовано

- IA в стиле BI: sidebar + topbar фильтров + страницы:
  - Полностью: `Overview`, `Performance`, `Verification`
  - Каркас: `Video`, `Conversions`, `Audience`
  - Минимально: `Exports` (CSV + история экспортов)
- Глобальные фильтры (единые для всех страниц):
  - date range (`today/7d/30d/custom`) + compare toggle
  - grain `day/hour` (hour только при периоде <= 7 дней)
  - campaign / placement / creative / domain / geo / deviceType / OS
  - attribution mode `post-view/post-click`
- KPI, графики (`Recharts`), таблицы (`TanStack Table` в Performance)
- Exclusions доменов (localStorage), применяются на уровне query engine
- RBAC (упрощенно):
  - `agency`: полный доступ
  - `advertiser`: без `Exports`, Verification без управления exclusions

## Архитектура

### 1) Типы контрактов
- `src/query/types.ts`
- Содержит `Metric`, `Dimension`, `Filters`, `Query`, `QueryResponse`, role/section/filter state.

### 2) Мок-датасет
- `src/data/mockDataset.ts`
- Генерирует 90 дней данных с реалистичным распределением:
  - 8 кампаний
  - 20+ размещений
  - 50+ креативов
  - 50+ доменов
  - 30+ geo
  - несколько типов устройств и ОС
- Там же экспортируется `CATALOG` для UI-фильтров.

### 3) Query engine
- `src/query/engine.ts`
- `query(q)` выполняет:
  - фильтрацию (включая `exclusionsDomains`)
  - groupBy по dimensions
  - агрегации сумм и derived-метрики
  - сортировку, limit/offset
- Формулы:
  - `ctr = clicks / impressions`
  - `frequency = impressions / reach`
  - `vcr100 = vastComplete / vastStart`
  - `ivtRate`, `brandSafetyRate`: взвешенное среднее по `impressions`

### 4) Селекторы
- `src/query/selectors.ts`
- Готовые запросы для виджетов Overview/Performance/Verification/…

### 5) Состояние фильтров
- `src/query/filtersStore.ts` (Zustand)
- Хранит глобальные фильтры, role, exclusions, синхронизацию с URL query string.

### 6) Имитация запросов
- `src/query/runQueryAsync.ts`
- Добавляет задержку 150–300ms для skeleton UX.

### 7) Страница дашборда
- `src/app/_pages/DashboardPage.tsx`
- Основной shell, sidebar/topbar, рендер страниц по роуту `/dashboard/<section>`.

## Экспорт CSV

- В `Overview` есть кнопка `Экспорт CSV` для таблицы `Топ домены`.
- В `Exports` есть повторный экспорт + история экспортов.
- История хранится в localStorage: `adriver/dashboard/export-history`.

## Где менять мок-данные

- В `src/data/mockDataset.ts`:
  - списки кампаний/доменов/geo
  - правила генерации метрик и распределений

## Как подключить реальный API позже

Точка замены одна: слой query.

1. Оставить текущие UI-виджеты и фильтры без изменений.
2. В `src/query/selectors.ts` заменить вызовы `query(...)` на `fetch(...)` к API.
3. Сохранить контракт ответа (`rows/meta`) или добавить адаптер ответа API -> UI-формат.

Так UI и бизнес-логика виджетов останутся стабильными, меняется только data provider слой.
