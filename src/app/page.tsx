import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl py-10 px-4 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Прототип интерфейса AdRiver</h1>
        <p className="text-slate-600">Основные разделы прототипа.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/campaigns"
          className="border rounded-lg p-4 hover:border-sky-500 transition"
        >
          <h2 className="font-semibold mb-1">Кампании</h2>
          <p className="text-sm text-slate-600">Список и управление.</p>
        </Link>

        <Link
          href="/mediaplan"
          className="border rounded-lg p-4 hover:border-sky-500 transition"
        >
          <h2 className="font-semibold mb-1">Медиаплан</h2>
          <p className="text-sm text-slate-600">Загрузка и разметка.</p>
        </Link>

        <Link
          href="/generation"
          className="border rounded-lg p-4 hover:border-sky-500 transition"
        >
          <h2 className="font-semibold mb-1">Генерация кодов</h2>
          <p className="text-sm text-slate-600">Ручной режим.</p>
        </Link>

        <Link
          href="/suppliers"
          className="border rounded-lg p-4 hover:border-sky-500 transition"
        >
          <h2 className="font-semibold mb-1">Поставщики</h2>
          <p className="text-sm text-slate-600">База макросов и автоподсказок.</p>
        </Link>

        <Link
          href="/builder"
          className="border rounded-lg p-4 hover:border-sky-500 transition"
        >
          <h2 className="font-semibold mb-1">Конструктор отчётов</h2>
          <p className="text-sm text-slate-600">Сборка и сохранение.</p>
        </Link>

        <Link
          href="/dashboard"
          className="border rounded-lg p-4 hover:border-sky-500 transition"
        >
          <h2 className="font-semibold mb-1">Дашборд</h2>
          <p className="text-sm text-slate-600">Просмотр данных.</p>
        </Link>
      </div>

    </main>
  );
}
