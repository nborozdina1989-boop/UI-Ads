"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, ExternalLink, Route, X } from "lucide-react";

type FlowStep = {
  label: string;
  href?: string;
  note: string;
};

type Flow = {
  title: string;
  intent: string;
  steps: FlowStep[];
};

const FLOWS: Flow[] = [
  {
    title: "1. Демонстрационный вход",
    intent: "Показать карту прототипа и быстро перейти в нужный модуль.",
    steps: [
      { label: "Главная", href: "/", note: "Стартовая витрина разделов." },
      { label: "Кампании", href: "/campaigns", note: "Операционный список РК." },
      { label: "Медиаплан", href: "/mediaplan", note: "Список загруженных и созданных медиапланов." },
      { label: "Дашборд", href: "/dashboard", note: "BI-витрина по моковым данным." },
    ],
  },
  {
    title: "2. Загрузка медиаплана -> создание РК -> коды",
    intent: "Основной happy path для демонстрации автогенерации из Excel.",
    steps: [
      { label: "Загрузить медиаплан", href: "/mediaplan/upload", note: "Импорт XLSX/шаблона, выбор листа и строки заголовков." },
      { label: "Разметка", href: "/mediaplan/mapping", note: "Короткий экран переходов; полная версия открывает сопоставление колонок." },
      { label: "Полная разметка", href: "/mediaplan/mapping/full", note: "Сопоставить обязательные поля, применить разметку и сохранить import в localStorage." },
      { label: "Создание РК", href: "/campaigns/new", note: "Показывает стабильный ID кампании и PID по строкам медиаплана." },
      { label: "Генерация кодов", href: "/generation", note: "Следующий шаг для сценариев и статусов кодов." },
      { label: "Готовые коды", href: "/generation/codes", note: "Просмотр и копирование сгенерированных кодов." },
    ],
  },
  {
    title: "3. Ручное создание медиаплана",
    intent: "Показать путь без загрузки Excel.",
    steps: [
      { label: "Создать с нуля", href: "/mediaplan/upload/create", note: "Заполнить черновик медиаплана вручную." },
      { label: "Очередь", href: "/mediaplan/queue", note: "Техническая точка статусов обработки." },
      { label: "Список медиапланов", href: "/mediaplan", note: "Проверить созданный объект и перейти к дальнейшим действиям." },
    ],
  },
  {
    title: "4. Операции с кампаниями",
    intent: "Показать работу со списком РК и пользовательскими состояниями.",
    steps: [
      { label: "Список РК", href: "/campaigns", note: "Поиск, фильтры, группировка, избранное, массовые действия." },
      { label: "Группы", href: "/campaigns/groups", note: "Сохранение наборов кампаний." },
      { label: "Архив", href: "/campaigns/archive", note: "Восстановление и экспорт архивных РК." },
      { label: "Удалённые", href: "/campaigns/deleted", note: "Технический экран удалённых сущностей." },
    ],
  },
  {
    title: "5. BI и отчётность",
    intent: "Показать аналитический контур после создания или выбора кампаний.",
    steps: [
      { label: "Overview", href: "/dashboard/overview", note: "KPI, динамика, домены, гео, частота, срезы." },
      { label: "Performance", href: "/dashboard/performance", note: "Таблица эффективности по уровням." },
      { label: "Verification", href: "/dashboard/verification", note: "IVT, brand safety, exclusions доменов." },
      { label: "Exports", href: "/dashboard/exports", note: "CSV/export history и бюджеты." },
      { label: "Конструктор отчётов", href: "/builder", note: "Сборка отчёта, список и расписание." },
    ],
  },
  {
    title: "6. Справочные данные",
    intent: "Показать технические источники для генерации.",
    steps: [
      { label: "Поставщики", href: "/suppliers", note: "База макросов, подсказки и правила для площадок." },
      { label: "Коды", href: "/codes", note: "Общий вход в кодовые сценарии." },
      { label: "Загрузка для генерации", href: "/generation/upload", note: "Техническая загрузка данных для генератора." },
    ],
  },
];

const RULES = [
  "Прототип frontend-only: бэка нет, состояние хранится в localStorage.",
  "Моковые BI-данные живут в src/data/mockDataset.ts и агрегируются локальным query engine.",
  "Happy path для демо: /mediaplan/upload -> /mediaplan/mapping/full -> /campaigns/new -> /generation.",
  "Если сценарий выглядит заполненным старыми данными, очистите localStorage для ключей adriver/*.",
  "Production build теперь падает на TypeScript-ошибках, поэтому технические регрессии должны ловиться сборкой.",
];

export default function PrototypeUserGuide() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-3 right-3 z-[90] inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-950 text-sm font-medium text-white shadow-[0_16px_40px_rgba(15,23,42,0.22)] transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 sm:bottom-4 sm:right-4 sm:w-auto sm:gap-2 sm:px-4"
        aria-label="Открыть user guide прототипа"
      >
        <BookOpen className="h-4 w-4" strokeWidth={1.9} />
        <span className="hidden sm:inline">User guide</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/45"
            onClick={() => setOpen(false)}
            aria-label="Закрыть user guide"
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="prototype-guide-title"
            className="absolute inset-x-3 bottom-3 top-3 mx-auto flex max-w-5xl flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl md:inset-x-8 md:bottom-8 md:top-8 lg:overflow-hidden"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div>
                <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                  <Route className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Технический guide
                </div>
                <h2 id="prototype-guide-title" className="text-xl font-semibold text-slate-950">
                  Пользовательские пути прототипа
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                  Карта нужна для демонстраций, QA и быстрых переходов между модулями. Она описывает не бизнес-идеал,
                  а фактическую логику текущего frontend-прототипа.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="grid flex-1 gap-0 lg:min-h-0 lg:grid-cols-[1fr_280px] lg:overflow-hidden">
              <main className="px-4 py-4 sm:px-5 sm:py-5 lg:min-h-0 lg:overflow-y-auto">
                <div className="space-y-4">
                  {FLOWS.map((flow) => (
                    <article key={flow.title} className="rounded-xl border border-slate-200 bg-white">
                      <div className="border-b border-slate-100 px-4 py-3">
                        <h3 className="text-sm font-semibold text-slate-950">{flow.title}</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{flow.intent}</p>
                      </div>
                      <ol className="divide-y divide-slate-100">
                        {flow.steps.map((step, index) => (
                          <li key={`${flow.title}-${step.label}`} className="grid gap-2 px-4 py-3 md:grid-cols-[36px_220px_1fr] md:items-start">
                            <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                              {index + 1}
                            </div>
                            <div className="min-w-0">
                              {step.href ? (
                                <Link
                                  href={step.href}
                                  onClick={() => setOpen(false)}
                                  className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:text-sky-900 hover:underline"
                                >
                                  {step.label}
                                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
                                </Link>
                              ) : (
                                <span className="text-sm font-medium text-slate-900">{step.label}</span>
                              )}
                              {step.href && <div className="mt-0.5 truncate font-mono text-[11px] text-slate-400">{step.href}</div>}
                            </div>
                            <p className="text-sm leading-5 text-slate-600">{step.note}</p>
                          </li>
                        ))}
                      </ol>
                    </article>
                  ))}
                </div>
              </main>

              <aside className="border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-5 sm:py-5 lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-t-0">
                <h3 className="text-sm font-semibold text-slate-950">Правила прототипа</h3>
                <ul className="mt-3 space-y-3">
                  {RULES.map((rule) => (
                    <li key={rule} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600">
                      {rule}
                    </li>
                  ))}
                </ul>

                <div className="mt-5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-3">
                  <div className="text-xs font-semibold text-sky-900">Быстрый сценарий для показа</div>
                  <p className="mt-1 text-xs leading-5 text-sky-800">
                    Начните с загрузки медиаплана, примените полную разметку, проверьте ID/PID на экране создания РК,
                    затем откройте генерацию кодов и BI-дашборд.
                  </p>
                </div>
              </aside>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
