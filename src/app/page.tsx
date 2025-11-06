import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl py-10 px-4 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Прототип интерфейса AdRiver</h1>
        <p className="text-slate-600">
          Сейчас доступны экраны: кампании, медиаплан (загрузка и разметка), генерация и автоген кодов, конструктор отчётов, дашборд.
          Состояние некоторых страниц сохраняется между визитами.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/campaigns"
          className="border rounded-lg p-4 hover:border-blue-500 transition"
        >
          <h2 className="font-semibold mb-1">Кампании</h2>
          <p className="text-sm text-slate-600">
            Список, архив, удалённые и группы. Сохранение фильтров и состояния.
          </p>
        </Link>

        <Link
          href="/mediaplan/upload"
          className="border rounded-lg p-4 hover:border-blue-500 transition"
        >
          <h2 className="font-semibold mb-1">Медиаплан</h2>
          <p className="text-sm text-slate-600">
            Загрузка медиаплана, разметка, предпросмотр, черновики. Показываем сам процесс.
          </p>
        </Link>

        <Link
          href="/generation"
          className="border rounded-lg p-4 hover:border-blue-500 transition"
        >
          <h2 className="font-semibold mb-1">Генерация кодов</h2>
          <p className="text-sm text-slate-600">
            Ручная генерация. Используем текущую версию, ничего не удаляем.
          </p>
        </Link>

        <Link
          href="/autogen"
          className="border rounded-lg p-4 hover:border-blue-500 transition"
        >
          <h2 className="font-semibold mb-1">Автоген</h2>
          <p className="text-sm text-slate-600">
            Отдельный режим. Оставляем как есть.
          </p>
        </Link>

        <Link
          href="/builder"
          className="border rounded-lg p-4 hover:border-blue-500 transition"
        >
          <h2 className="font-semibold mb-1">Конструктор отчётов</h2>
          <p className="text-sm text-slate-600">
            Демонстрация сохранения отчётов и расписания. Можно стартовать с пустыми данными.
          </p>
        </Link>

        <Link
          href="/dashboard"
          className="border rounded-lg p-4 hover:border-blue-500 transition"
        >
          <h2 className="font-semibold mb-1">Дашборд</h2>
          <p className="text-sm text-slate-600">
            Вспомогательная страница для показа данных.
          </p>
        </Link>
      </div>

      <div className="border rounded-lg p-4 bg-slate-50">
        <h3 className="font-semibold mb-2">Важно</h3>
        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
          <li>Не меняем текущую логику сохранения состояния и localStorage.</li>
          <li>Не удаляем и не объединяем страницы генерации без отдельного указания.</li>
          <li>Медиаплан используем только в текущей «истинной» версии.</li>
        </ul>
      </div>
    </main>
  );
}
