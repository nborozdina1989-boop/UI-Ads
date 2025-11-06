'use client';
import React from "react";
import Link from "next/link";
import { loadImport } from "@/lib/mediaplan";

export default function MediaplanPreviewPage() {
  const imp = loadImport();

  if (!imp) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="mb-2 text-2xl font-bold">Превью медиаплана</h1>
        <p className="mb-4 text-gray-600">Нет результатов импорта. Начните с загрузки и разметки.</p>
        <div className="flex gap-2">
          <Link href="/mediaplan/upload" className="rounded-full bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700">К загрузке</Link>
          <Link href="/mediaplan/mapping" className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50">К разметке</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">Превью медиаплана</h1>
        <p className="text-sm text-gray-600">Проверьте данные и переходите к автогенерации кодов.</p>
      </header>

      <section className="mb-4 rounded-lg border bg-white p-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <div><span className="text-gray-500">Бренд:</span> <b>{imp.meta.brand || "—"}</b></div>
          <div><span className="text-gray-500">Кампания:</span> <b>{imp.meta.campaign_name || "—"}</b></div>
          <div><span className="text-gray-500">Старт:</span> <b>{imp.meta.date_start || "—"}</b></div>
          <div><span className="text-gray-500">Окончание:</span> <b>{imp.meta.date_end || "—"}</b></div>
          <div><span className="text-gray-500">Строк:</span> <b>{imp.rows.length}</b></div>
        </div>
      </section>

      {imp.errors.length>0 && (
        <details className="mb-4 rounded-lg border bg-white p-4">
          <summary className="cursor-pointer font-medium text-red-700">Ошибки ({imp.errors.length})</summary>
          <ul className="mt-2 list-disc pl-6 text-sm text-red-700">{imp.errors.slice(0,100).map((e,i)=><li key={i}>{e}</li>)}</ul>
        </details>
      )}
      {imp.warnings.length>0 && (
        <details className="mb-4 rounded-lg border bg-white p-4">
          <summary className="cursor-pointer font-medium text-amber-700">Предупреждения ({imp.warnings.length})</summary>
          <ul className="mt-2 list-disc pl-6 text-sm text-amber-700">{imp.warnings.slice(0,100).map((w,i)=><li key={i}>{w}</li>)}</ul>
        </details>
      )}

      <div className="mb-4 overflow-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {Object.keys(imp.rows[0] || {placeholder: ""}).map(h=>(
                <th key={h} className="bg-gray-100 p-2 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {imp.rows.slice(0,100).map((r,idx)=>(
              <tr key={idx} className="odd:bg-white even:bg-gray-50">
                {Object.keys(imp.rows[0] || {placeholder: ""}).map(h=>(
                  <td key={h} className="border-t p-2">{String((r as any)[h] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <Link href="/mediaplan/mapping" className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50">Назад к разметке</Link>
        <Link href="/autogen" className="rounded-full bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700">
          Перейти в автогенерацию
        </Link>
      </div>
    </div>
  );
}
