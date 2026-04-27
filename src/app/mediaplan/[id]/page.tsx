'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  consumeMediaplanScenarioHighlight,
  ensureMockMediaplans,
  getMediaplan,
  НАЗВАНИЯ_СТОЛБЦОВ,
  type MediaplanRecord,
  type MediaplanStatus,
  type PlacementRow,
} from '@/lib/mediaplan';

function statusTone(status: MediaplanStatus): string {
  switch (status) {
    case 'кампания создана':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'в очереди':
      return 'border-violet-200 bg-violet-50 text-violet-700';
    case 'ошибка':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-violet-200 bg-violet-50 text-violet-700';
  }
}

function formatShortDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function formatCellValue(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || '—';
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  return String(value);
}

function formatScenarioValue(key: keyof PlacementRow, value: PlacementRow[keyof PlacementRow]): string {
  if (!hasValue(value)) return '—';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || '—';

  if (key === 'format') {
    return value === 'video' ? 'Видео' : 'Баннер';
  }

  if (key === 'environment') {
    return {
      web: 'Web',
      'in-app': 'In-app',
      smart: 'Smart TV',
      mixed: 'Смешанная',
    }[String(value)] || String(value);
  }

  if (key === 'measurement_type') {
    return {
      audit: 'Базовый аудит',
      ivt: 'IVT + Adserving',
      full_verification: 'Full Verification',
      click_only: 'Click-аудит',
      audit_viewability: 'Аудит + Viewability',
    }[String(value)] || String(value);
  }

  return String(value);
}

type ScenarioColumn = {
  key: keyof PlacementRow;
  label: string;
  always?: boolean;
};

const SCENARIO_COLUMNS: ScenarioColumn[] = [
  { key: 'platform_name', label: НАЗВАНИЯ_СТОЛБЦОВ['Название позиции'], always: true },
  { key: 'supplier', label: НАЗВАНИЯ_СТОЛБЦОВ['Поставщик'], always: true },
  { key: 'placement_type', label: НАЗВАНИЯ_СТОЛБЦОВ['Тип размещения'] },
  { key: 'format', label: НАЗВАНИЯ_СТОЛБЦОВ['Формат размещения'], always: true },
  { key: 'hosting', label: НАЗВАНИЯ_СТОЛБЦОВ['Хостинг видео'] },
  { key: 'environment', label: НАЗВАНИЯ_СТОЛБЦОВ['Среда размещения'], always: true },
  { key: 'measurement_type', label: НАЗВАНИЯ_СТОЛБЦОВ['Тип измерения'], always: true },
  { key: 'banner_name', label: НАЗВАНИЯ_СТОЛБЦОВ['Название баннера'] },
  { key: 'target_url', label: НАЗВАНИЯ_СТОЛБЦОВ['URL баннера'] },
  { key: 'code_type', label: НАЗВАНИЯ_СТОЛБЦОВ['Тип кода'] },
  { key: 'tracker_site', label: НАЗВАНИЯ_СТОЛБЦОВ['Трекерный сайт'] },
  { key: 'vast_version', label: НАЗВАНИЯ_СТОЛБЦОВ['VAST версия'] },
  { key: 'delegate_suppliers', label: НАЗВАНИЯ_СТОЛБЦОВ['Делегирование поставщиков'] },
  { key: 'time_start', label: НАЗВАНИЯ_СТОЛБЦОВ['Время начала'] },
  { key: 'time_end', label: НАЗВАНИЯ_СТОЛБЦОВ['Время окончания'] },
  { key: 'auditor_mediascope', label: НАЗВАНИЯ_СТОЛБЦОВ['Mediascope'] },
  { key: 'auditor_url', label: НАЗВАНИЯ_СТОЛБЦОВ['URL аудитора'] },
  { key: 'auditor_redirect', label: НАЗВАНИЯ_СТОЛБЦОВ['Редирект'] },
  { key: 'macro_exss', label: НАЗВАНИЯ_СТОЛБЦОВ['exss'] },
  { key: 'macro_erir', label: НАЗВАНИЯ_СТОЛБЦОВ['ЕРИР'] },
  { key: 'macro_bundle_id', label: НАЗВАНИЯ_СТОЛБЦОВ['Bundle ID'] },
  { key: 'macro_adv_id', label: НАЗВАНИЯ_СТОЛБЦОВ['GAID/IDFA'] },
  { key: 'macro_ext_id', label: НАЗВАНИЯ_СТОЛБЦОВ['Внешний ID'] },
  { key: 'dyn_impression', label: НАЗВАНИЯ_СТОЛБЦОВ['Дин. параметры показа'] },
  { key: 'dyn_click', label: НАЗВАНИЯ_СТОЛБЦОВ['Дин. параметры клика'] },
  { key: 'geo', label: НАЗВАНИЯ_СТОЛБЦОВ['Гео'] },
  { key: 'audience', label: НАЗВАНИЯ_СТОЛБЦОВ['Целевая аудитория'] },
];

export default function MediaplanCardPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [isHydrated, setIsHydrated] = useState(false);
  const [highlightedScenarios, setHighlightedScenarios] = useState<string[]>([]);

  useEffect(() => {
    ensureMockMediaplans();
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated || !params?.id) return;
    setHighlightedScenarios(consumeMediaplanScenarioHighlight(params.id));
  }, [isHydrated, params]);

  const mediaplanId = params?.id || '';
  const item = useMemo<MediaplanRecord | null>(() => {
    if (!isHydrated || !mediaplanId) return null;
    return getMediaplan(mediaplanId);
  }, [isHydrated, mediaplanId]);

  if (!item && !isHydrated) {
    return null;
  }

  if (!item) {
    return (
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Медиаплан не найден</h2>
            <p className="mt-1 text-sm text-slate-500">
              Возможно, запись была удалена или ссылка устарела.
            </p>
          </div>
          <Link
            href="/mediaplan"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
            К списку медиапланов
          </Link>
        </div>
      </section>
    );
  }

  const flashMessage = searchParams.get('flash') === 'scenarios-added'
    ? 'Новые сценарии добавлены в существующий медиаплан.'
    : searchParams.get('flash') === 'codes-created'
      ? 'Для выбранных позиций коды отмечены как созданные.'
      : '';
  const highlightedSet = new Set(highlightedScenarios);
  const generatedSet = new Set(item.generatedPositionIndexes || []);

  const scenarioRows = item.import?.rows ?? [];
  const scenarioColumns = SCENARIO_COLUMNS.filter((column) => {
    if (column.always) return true;
    return scenarioRows.some((row) => hasValue(row[column.key]));
  });
  const pendingScenarioRows = scenarioRows.filter((_, index) => !generatedSet.has(index));
  const createdScenarioRows = scenarioRows.filter((_, index) => generatedSet.has(index));
  const pendingScenarioNames = (item.scenarioNames || []).filter((_, index) => !generatedSet.has(index));
  const createdScenarioNames = (item.scenarioNames || []).filter((_, index) => generatedSet.has(index));

  const meta = item.import?.meta;
  const campaignFields = [
    { label: 'Рекламодатель', value: meta?.advertiser || item.advertiser || '—' },
    { label: 'Название рекламной кампании (РК)', value: meta?.campaign_name || item.campaignName || '—' },
    { label: 'Рекламное агентство', value: meta?.agency || '—' },
    { label: 'Бренд', value: meta?.brand || item.brand || '—' },
    { label: 'Старт кампании', value: formatShortDate(meta?.date_start) },
    { label: 'Окончание кампании', value: formatShortDate(meta?.date_end) },
    { label: 'Делегирование всей кампании', value: formatCellValue(meta?.delegate_accounts) },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/mediaplan"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
            К списку медиапланов
          </Link>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        {flashMessage && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {flashMessage}
          </div>
        )}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusTone(item.status)}`}>
                {item.status}
              </span>
            </div>
            <div className="text-sm text-slate-500">{item.description || 'Описание не задано'}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {item.status === 'кампания создана' && (
              <>
                {item.source === 'upload' ? (
                  <Link
                    href={`/mediaplan/upload?targetMp=${item.id}&append=1`}
                    className="rounded-full bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700"
                  >
                    Добавить сценарии через Excel
                  </Link>
                ) : (
                  <Link
                    href={`/mediaplan/upload/create?targetMp=${item.id}&append=1`}
                    className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-700 hover:bg-sky-100"
                  >
                    Упрощенное добавление
                  </Link>
                )}
              </>
            )}
            {item.status !== 'кампания создана' && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-400">
                Добавить сценарии
              </span>
            )}
            {item.status === 'кампания создана' ? (
              <Link
                href={`/generation?mp=${item.id}`}
                className="rounded-full bg-white px-4 py-2 text-sm text-sky-700 ring-1 ring-sky-600 hover:bg-sky-50"
              >
                Перейти к генерации кодов
              </Link>
            ) : (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-400">
                Перейти к генерации кодов
              </span>
            )}
          </div>
        </div>

        {item.status === 'кампания создана' && (
          <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-800">
            {item.source === 'upload'
              ? 'Этот медиаплан создан через Excel. Новые сценарии можно добавлять только через Excel.'
              : 'Этот медиаплан создан через упрощённое создание. Новые сценарии можно добавлять только через упрощённое добавление.'}
          </div>
        )}
        {item.status !== 'кампания создана' && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
            Добавление сценариев становится доступно только после перехода медиаплана в статус «Кампания создана».
          </div>
        )}

        <div className="mt-5 space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Объекты на всю кампанию</div>
                <div className="text-xs text-slate-500">Параметры, общие для всего медиаплана</div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1">ID: {item.id}</span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                  {item.source === 'upload' ? 'Excel' : 'Упрощенное создание'}
                </span>
                <span className={`rounded-full border px-3 py-1 ${statusTone(item.status)}`}>{item.status}</span>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="grid md:grid-cols-2">
                {campaignFields.map((field) => (
                  <div key={field.label} className="grid grid-cols-[220px_minmax(0,1fr)] border-b border-slate-200 last:border-b-0 md:[&:nth-last-child(-n+2)]:border-b-0">
                    <div className="border-r border-slate-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-slate-800">
                      {field.label}
                    </div>
                    <div className="px-4 py-3 text-sm text-slate-900">{formatCellValue(field.value)}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Состав медиаплана</div>
                <div className="text-xs text-slate-500">Каждая строка — отдельная позиция, колонки — объекты позиции</div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
                  Без кодов: {pendingScenarioRows.length || pendingScenarioNames.length}
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                  Коды созданы: {createdScenarioRows.length || createdScenarioNames.length}
                </span>
              </div>
            </div>

            {(pendingScenarioRows.length || pendingScenarioNames.length) > 0 ? (
              <div className="mb-4 space-y-3">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="text-sm font-semibold text-amber-900">Позиции без созданных кодов</div>
                  <div className="text-xs text-amber-700">Эти позиции будут подставлены в генерацию кодов в первую очередь.</div>
                </div>
                {pendingScenarioRows.length ? (
                  <div className="overflow-x-auto rounded-2xl border border-amber-200 bg-white">
                    <table className="min-w-[1120px] border-collapse text-sm text-slate-800">
                      <thead>
                        <tr className="bg-amber-50">
                          <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-3 py-3 text-center font-semibold text-slate-700">№</th>
                          {scenarioColumns.map((column) => (
                            <th key={`pending-${column.key}`} className="border-b border-r border-slate-200 px-4 py-3 text-left font-semibold text-slate-800 last:border-r-0">
                              {column.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pendingScenarioRows.map((row, pendingIndex) => {
                          const sourceIndex = scenarioRows.findIndex((candidate) => candidate === row);
                          const rowName = String(row.platform_name || row.banner_name || '');
                          return (
                            <tr
                              key={`${row.platform_name || 'pending'}-${sourceIndex}`}
                              className={highlightedSet.has(rowName) ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-200' : pendingIndex % 2 === 0 ? 'bg-white' : 'bg-amber-50/30'}
                            >
                              <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-inherit px-3 py-3 text-center text-slate-500">{sourceIndex + 1}</td>
                              {scenarioColumns.map((column) => (
                                <td key={`pending-${column.key}-${sourceIndex}`} className="border-b border-r border-slate-200 px-4 py-3 text-slate-700 last:border-r-0">
                                  {formatScenarioValue(column.key, row[column.key])}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-amber-200 bg-white">
                    <table className="min-w-[640px] border-collapse text-sm text-slate-800">
                      <thead>
                        <tr className="bg-amber-50">
                          <th className="w-16 border-b border-r border-slate-200 bg-slate-50 px-3 py-3 text-center font-semibold text-slate-700">№</th>
                          <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-800">Название позиции</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingScenarioNames.map((scenario, index) => (
                          <tr key={`pending-${scenario}-${index}`} className={highlightedSet.has(scenario) ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-200' : index % 2 === 0 ? 'bg-white' : 'bg-amber-50/30'}>
                            <td className="border-b border-r border-slate-200 px-3 py-3 text-center text-slate-500">{index + 1}</td>
                            <td className="border-b border-slate-200 px-4 py-3 text-slate-700">{scenario}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}

            {(createdScenarioRows.length || createdScenarioNames.length) > 0 ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="text-sm font-semibold text-emerald-900">Позиции с созданными кодами</div>
                  <div className="text-xs text-emerald-700">Для этих позиций коды уже были созданы.</div>
                </div>
                {createdScenarioRows.length ? (
                  <div className="overflow-x-auto rounded-2xl border border-emerald-200 bg-white">
                    <table className="min-w-[1120px] border-collapse text-sm text-slate-800">
                      <thead>
                        <tr className="bg-emerald-50">
                          <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-3 py-3 text-center font-semibold text-slate-700">№</th>
                          {scenarioColumns.map((column) => (
                            <th key={`created-${column.key}`} className="border-b border-r border-slate-200 px-4 py-3 text-left font-semibold text-slate-800 last:border-r-0">
                              {column.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {createdScenarioRows.map((row, createdIndex) => {
                          const sourceIndex = scenarioRows.findIndex((candidate) => candidate === row);
                          return (
                            <tr key={`${row.platform_name || 'created'}-${sourceIndex}`} className={createdIndex % 2 === 0 ? 'bg-white' : 'bg-emerald-50/30'}>
                              <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-inherit px-3 py-3 text-center text-slate-500">{sourceIndex + 1}</td>
                              {scenarioColumns.map((column) => (
                                <td key={`created-${column.key}-${sourceIndex}`} className="border-b border-r border-slate-200 px-4 py-3 text-slate-700 last:border-r-0">
                                  {formatScenarioValue(column.key, row[column.key])}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-emerald-200 bg-white">
                    <table className="min-w-[640px] border-collapse text-sm text-slate-800">
                      <thead>
                        <tr className="bg-emerald-50">
                          <th className="w-16 border-b border-r border-slate-200 bg-slate-50 px-3 py-3 text-center font-semibold text-slate-700">№</th>
                          <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-800">Название позиции</th>
                        </tr>
                      </thead>
                      <tbody>
                        {createdScenarioNames.map((scenario, index) => (
                          <tr key={`created-${scenario}-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-emerald-50/30'}>
                            <td className="border-b border-r border-slate-200 px-3 py-3 text-center text-slate-500">{index + 1}</td>
                            <td className="border-b border-slate-200 px-4 py-3 text-slate-700">{scenario}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                Состав позиций для этого медиаплана ещё не отображён.
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
