'use client';
import React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { buildSearchFromFilters, DEFAULT_FILTERS, FiltersState, parseFiltersFromSearch } from '@/lib/urlstate';
import { ChipToggle } from './ChipToggle';
import { MultiSelectInline } from './MultiSelectInline';

type Props = {
  /** Для телеметрии/уточнений — где отображаем панель */
  area: 'campaigns' | 'archive';
  /** Справочники для мультиселектов; если не передали — панель просто работает с URL */
  brandOptions?: string[];
  advertiserOptions?: string[];
};

const ownerOptions = [
  { label: 'Все', value: 'all' },
  { label: 'Свои', value: 'own' },
  { label: 'Делег', value: 'delegated' },
] as const;

const statusOptions = [
  { label: 'Все', value: 'all' },
  { label: 'Активные', value: 'active' },
  { label: 'Неактивные', value: 'inactive' },
] as const;

export default function SearchFiltersBar({ area, brandOptions = [], advertiserOptions = [] }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [state, setState] = React.useState<FiltersState>(() => parseFiltersFromSearch(sp?.toString() ?? ''));

  // Синхронизация при навигации назад/вперёд
  React.useEffect(() => {
    setState(parseFiltersFromSearch(sp?.toString() ?? ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const updateURL = (next: FiltersState) => {
    const qs = buildSearchFromFilters(next);
    router.replace(`${pathname}${qs}`, { scroll: false });
  };

  const setField = <K extends keyof FiltersState>(k: K, v: FiltersState[K]) => {
    const next = { ...state, [k]: v };
    setState(next);
    updateURL(next);
  };

  const reset = () => {
    setState(DEFAULT_FILTERS);
    router.replace(pathname, { scroll: false });
  };

  return (
    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100">
      <div className="mx-auto max-w-screen-2xl px-4 py-3">
        <div className="flex flex-col gap-3">
          {/* Первая линия: Поиск + кнопка Сбросить */}
          <div className="flex items-center gap-2">
            <input
              value={state.q}
              onChange={(e) => setField('q', e.target.value)}
              placeholder="Поиск: ID, Название, Бренд, Рекламодатель…"
              className="flex-1 border border-gray-300 rounded px-3 py-2 outline-none focus:border-gray-400"
            />
            <button
              type="button"
              onClick={reset}
              className="px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
              title="Очистить строку поиска и все фильтры"
            >
              Сбросить фильтры
            </button>
          </div>

          {/* Вторая линия: чипы */}
          <div className="flex flex-wrap items-center gap-4">
            <ChipToggle
              label="Владение"
              options={ownerOptions as any}
              value={state.owner}
              onChange={(v) => setField('owner', v)}
            />
            <ChipToggle
              label="Статус"
              options={statusOptions as any}
              value={state.status}
              onChange={(v) => setField('status', v)}
            />
          </div>

          {/* Третья линия: мультиселекты */}
          <div className="flex flex-wrap items-center gap-6">
            <MultiSelectInline
              label="Бренды"
              options={brandOptions}
              values={state.brands}
              onChange={(values) => setField('brands', values)}
              placeholder="Выбрать бренды…"
            />
            <MultiSelectInline
              label="Рекламодатели"
              options={advertiserOptions}
              values={state.advertisers}
              onChange={(values) => setField('advertisers', values)}
              placeholder="Выбрать рекламодателей…"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
