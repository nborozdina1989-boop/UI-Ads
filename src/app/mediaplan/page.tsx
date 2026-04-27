'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, FileSpreadsheet, Search, Trash2 } from 'lucide-react';
import { deleteMediaplan, ensureMockMediaplans, listMediaplans, type MediaplanRecord, type MediaplanStatus } from '@/lib/mediaplan';

const STATUS_OPTIONS: MediaplanStatus[] = ['в очереди', 'кампания создана', 'ошибка'];

type SortMode = 'uploaded_desc' | 'uploaded_asc' | 'status_asc' | 'status_desc' | 'title_asc' | 'title_desc';

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

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function MediaplanListPageContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<MediaplanRecord[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | MediaplanStatus>('all');
  const [sort, setSort] = useState<SortMode>('uploaded_desc');
  const createdId = searchParams.get('created') || '';
  const flash = searchParams.get('flash') || '';

  useEffect(() => {
    ensureMockMediaplans();
    setItems(listMediaplans());
  }, []);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const nextItems = items.filter((item) => {
      const matchesStatus = status === 'all' || item.status === status;
      const haystack = [item.id, item.title, item.description || '', item.advertiser || '', item.campaignName || '']
        .join(' ')
        .toLowerCase();
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });

    nextItems.sort((left, right) => {
      switch (sort) {
        case 'uploaded_asc':
          return new Date(left.uploadedAt).getTime() - new Date(right.uploadedAt).getTime();
        case 'uploaded_desc':
          return new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime();
        case 'status_asc':
          return left.status.localeCompare(right.status, 'ru');
        case 'status_desc':
          return right.status.localeCompare(left.status, 'ru');
        case 'title_asc':
          return left.title.localeCompare(right.title, 'ru');
        case 'title_desc':
          return right.title.localeCompare(left.title, 'ru');
      }
    });

    return nextItems;
  }, [items, query, status, sort]);

  function handleDeleteMediaplan(id: string) {
    deleteMediaplan(id);
    setItems(listMediaplans());
  }

  return (
    <div className="space-y-5">
      {flash === 'mediaplan-created' && createdId && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Медиаплан создан и добавлен в список.
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по ID и названию медиаплана"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-sky-300"
            />
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as 'all' | MediaplanStatus)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-300"
          >
            <option value="all">Все статусы</option>
            {STATUS_OPTIONS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortMode)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-300"
          >
            <option value="uploaded_desc">Сначала новые</option>
            <option value="uploaded_asc">Сначала старые</option>
            <option value="status_asc">Статус А→Я</option>
            <option value="status_desc">Статус Я→А</option>
            <option value="title_asc">Название А→Я</option>
            <option value="title_desc">Название Я→А</option>
          </select>
          <Link
            href="/mediaplan/upload"
            className="ml-auto rounded-full bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700"
          >
            Загрузить новый медиаплан
          </Link>
          <Link
            href="/campaigns"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            К списку РК
          </Link>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
              <FileSpreadsheet className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Все медиапланы</h2>
            </div>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
            Найдено: {filtered.length}
          </div>
        </div>

        <div className="overflow-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-slate-100 px-4 py-3 text-left font-semibold text-slate-700">ID медиаплана</th>
                <th className="bg-slate-100 px-4 py-3 text-left font-semibold text-slate-700">Название / описание</th>
                <th className="bg-slate-100 px-4 py-3 text-left font-semibold text-slate-700">Дата загрузки</th>
                <th className="bg-slate-100 px-4 py-3 text-left font-semibold text-slate-700">Статус</th>
                <th className="bg-slate-100 px-4 py-3 text-left font-semibold text-slate-700">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                    Медиапланов пока нет. Загрузите новый файл или создайте медиаплан с нуля.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const descriptionContainsAdvertiser =
                    Boolean(item.advertiser) &&
                    (item.description || "").toLowerCase().includes(String(item.advertiser).toLowerCase());
                  return (
                    <tr
                      key={item.id}
                      className={`border-t border-slate-200 odd:bg-white even:bg-slate-50/50 ${
                        item.id === createdId ? 'ring-2 ring-inset ring-emerald-300' : ''
                      }`}
                    >
                      <td className="px-4 py-4 align-top font-medium text-slate-900">{item.id}</td>
                      <td className="px-4 py-4 align-top">
                        <Link
                          href={`/mediaplan/${item.id}`}
                          className="font-medium text-slate-900 hover:text-sky-700"
                        >
                          {item.title}
                        </Link>
                        <div className="mt-1 text-xs leading-5 text-slate-500">{item.description || 'Описание не задано'}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                          {item.advertiser && !descriptionContainsAdvertiser ? (
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">Рекламодатель: {item.advertiser}</span>
                          ) : null}
                          {typeof item.rowsCount === 'number' ? <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">Строк: {item.rowsCount}</span> : null}
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">Источник: {item.source === 'upload' ? 'Excel' : 'Создан вручную'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-slate-600">{formatDate(item.uploadedAt)}</td>
                      <td className="px-4 py-4 align-top">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusTone(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap items-start justify-end gap-2">
                          {item.status === 'кампания создана' ? (
                            <Link
                              href={`/generation?mp=${item.id}`}
                              className="inline-flex items-center gap-1 rounded-full bg-sky-600 px-3 py-1.5 text-xs text-white hover:bg-sky-700"
                            >
                              Перейти к генерации кодов
                              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                            </Link>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-400">
                              Перейти к генерации кодов
                            </span>
                          )}
                          <div className="group relative">
                            <button
                              type="button"
                              onClick={() => handleDeleteMediaplan(item.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
                              aria-label={`Удалить медиаплан ${item.title}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                            </button>
                            <span className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 hidden w-[260px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] leading-5 text-slate-600 shadow-lg group-hover:block group-focus-within:block">
                              Техническая кнопка для админа. Не отражает прототипируемый пользовательский функционал.
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function MediaplanListPage() {
  return (
    <Suspense fallback={<div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">Загружаем список медиапланов…</div>}>
      <MediaplanListPageContent />
    </Suspense>
  );
}
