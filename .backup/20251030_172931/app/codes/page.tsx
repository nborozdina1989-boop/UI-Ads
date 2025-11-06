'use client';
import Link from "next/link";

export default function CodesStubPage() {
  return (
    <div className="mx-auto max-w-6xl p-8">
      <h1 className="mb-2 text-3xl font-bold">Коды (заглушка)</h1>
      <p className="mb-6 text-gray-600">Здесь появится список пакетов кодов и кнопки «Excel / Архив / Открыть».</p>

      <div className="rounded-xl border bg-white p-5">
        <div className="text-sm text-gray-600">Пакетов кодов пока нет.</div>
      </div>

      <div className="mt-6 flex gap-3">
        <Link href="/generation" className="rounded-full bg-sky-600 px-6 py-3 text-white hover:bg-sky-700">Назад к генерации</Link>
        <Link href="/campaigns" className="rounded-full border px-6 py-3 hover:bg-gray-50">К кампаниям</Link>
      </div>
    </div>
  );
}
