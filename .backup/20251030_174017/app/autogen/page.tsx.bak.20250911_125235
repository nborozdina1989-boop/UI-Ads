'use client';
import React from "react";
import Link from "next/link";
import { loadImport } from "@/lib/mediaplan";

export default function AutogenPage() {
  const imp = loadImport();

  if (!imp) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="mb-2 text-2xl font-bold">Импорт выполнен</h1>
        <p className="mb-4 text-gray-600">Импорт ещё не выполнен. Начните с загрузки медиаплана.</p>
        <Link className="rounded-full bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700" href="/mediaplan/upload">
          К загрузчику
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-2 text-3xl font-bold">Импорт выполнен</h1>
      <p className="mb-6 text-xl text-gray-600">
        Строк: <b>{imp.rows.length}</b>. Предупреждений: <b>{imp.warnings.length}</b>. Ошибок: <b>{imp.errors.length}</b>.
      </p>

      {imp.errors.length > 0 && (
        <details className="mb-4 rounded-lg border bg-white p-4">
          <summary className="cursor-pointer font-medium text-red-700">Ошибки</summary>
          <ul className="mt-2 list-disc pl-6 text-sm text-red-700">
            {imp.errors.slice(0,50).map((e,i)=><li key={i}>{e}</li>)}
          </ul>
        </details>
      )}

      {imp.warnings.length > 0 && (
        <details className="mb-6 rounded-lg border bg-white p-4">
          <summary className="cursor-pointer font-medium text-amber-700">Предупреждения</summary>
          <ul className="mt-2 list-disc pl-6 text-sm text-amber-700">
            {imp.warnings.slice(0,50).map((w,i)=><li key={i}>{w}</li>)}
          </ul>
        </details>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/campaigns" className="rounded-full border px-6 py-3 text-base hover:bg-gray-50">
          К кампаниям
        </Link>
        <Link href="/generation" className="rounded-full bg-sky-600 px-6 py-3 text-base text-white hover:bg-sky-700">
          Сгенерировать коды
        </Link>
      </div>
    </div>
  );
}
