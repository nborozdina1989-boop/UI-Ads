"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-dvh bg-slate-50 flex items-center">
      <div className="mx-auto max-w-3xl p-6 w-full">
        <h1 className="text-3xl font-bold mb-6">Прототипы</h1>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/builder"
            className="rounded-2xl border bg-white p-6 hover:shadow-md transition"
          >
            <div className="text-lg font-semibold mb-2">Конструктор отчётов</div>
            <p className="text-sm text-gray-600">
              Фильтры, колонки, строки. Drag-and-drop атрибутов и таблица-заглушка.
            </p>
          </Link>

          <Link
            href="/dashboard"
            className="rounded-2xl border bg-white p-6 hover:shadow-md transition"
          >
            <div className="text-lg font-semibold mb-2">Дашборд РК</div>
            <p className="text-sm text-gray-600">
              KPI, динамика, разбивки по среде/поставщикам/креативам, таблицы.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}