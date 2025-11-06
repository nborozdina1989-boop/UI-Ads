'use client';
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { listDrafts, deleteDraft, type Draft } from "@/lib/mediaplan";

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);

  useEffect(()=>{ setDrafts(listDrafts()); },[]);
  const onDelete = (id: string) => {
    deleteDraft(id);
    setDrafts(listDrafts());
  };

  return (
    <div className="mx-auto max-w-5xl p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Черновики медиапланов</h1>
          <p className="text-sm text-gray-600">Загруженные и размеченные медиапланы, по которым ещё не создана РК.</p>
        </div>
        <Link href="/mediaplan/upload" className="rounded-full bg-white px-4 py-2 text-sm text-sky-700 ring-1 ring-sky-600 hover:bg-sky-50">
          ← К загрузке медиаплана
        </Link>
      </header>

      {drafts.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-gray-600">Черновиков пока нет.</div>
      ) : (
        <div className="space-y-3">
          {drafts.map(d => (
            <div key={d.id} className="flex items-center justify-between rounded-xl border bg-white p-4">
              <div className="min-w-0">
                <div className="truncate text-base font-semibold">{d.name || "Черновик"}</div>
                <div className="text-xs text-gray-500">
                  Создан: {new Date(d.createdAt).toLocaleString()} •
                  Бренд: {d.meta?.brand || "—"} • РК: {d.meta?.campaign_name || "—"} • Строк: {d.rowsCount ?? "—"}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/mediaplan/mapping?draft=${d.id}`} className="rounded-full bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700">
                  Открыть
                </Link>
                <button onClick={()=>onDelete(d.id)} className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50">
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
