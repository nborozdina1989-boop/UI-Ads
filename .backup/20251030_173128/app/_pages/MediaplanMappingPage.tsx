'use client';
'use client';
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getDraft, saveQuickDraft, type Draft } from "@/lib/mediaplan";

export default function MappingStubPage() {
  const params = useSearchParams();
  const router = useRouter();
  const draftId = params.get("draft");
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(()=>{
    if (draftId) setDraft(getDraft(draftId));
  },[draftId]);

  const saveDraftAndOpenList = () => {
    const d = saveQuickDraft();
    router.push("/mediaplan/drafts");
  };

  return (
    <div className="mx-auto max-w-6xl p-8">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Разметка медиаплана</h1>
          <p className="text-sm text-gray-600">Заглушка: только переходы. Разметка и предпросмотр не активны.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={saveDraftAndOpenList} className="rounded-full bg-white px-4 py-2 text-sm text-sky-700 ring-1 ring-sky-600 hover:bg-sky-50">
            Сохранить в черновики
          </button>
          <Link href="/mediaplan/mapping/full" className="rounded-full bg-white px-4 py-2 text-sm text-sky-700 ring-1 ring-sky-600 hover:bg-sky-50">
            Открыть полную версию
          </Link>
        </div>
      </header>

      {draft && (
        <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          Открыт черновик: <b>{draft.name}</b> • создан {new Date(draft.createdAt).toLocaleString()}
        </div>
      )}

      <section className="mb-6 rounded-xl border bg-white p-5">
        <div className="mb-3 text-sm font-semibold">Параметры медиаплана</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <div className="mb-2 text-sm font-medium">Обязательные объекты (ячейки)</div>
            <ul className="list-disc pl-5 text-sm text-gray-700">
              <li>Бренд {draft?.meta?.brand ? <em className="text-gray-500">— {draft.meta.brand}</em> : null}</li>
              <li>Название РК {draft?.meta?.campaign_name ? <em className="text-gray-500">— {draft.meta.campaign_name}</em> : null}</li>
            </ul>
          </div>
          <div className="rounded-lg border p-4">
            <div className="mb-2 text-sm font-medium">Обязательные объекты (столбцы)</div>
            <ul className="list-disc pl-5 text-sm text-gray-700">
              <li>Название позиции</li><li>Поставщик</li><li>Формат размещения</li><li>Хостинг видео</li>
              <li>Среда размещения</li><li>Тип измерения</li><li>Название баннера</li><li>URL баннера</li>
            </ul>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href="/campaigns/new" className="rounded-full bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700">
          Создать рекламную кампанию
        </Link>
        <Link href="/mediaplan/preview" className="rounded-full bg-white px-4 py-2 text-sm text-sky-700 ring-1 ring-sky-600 hover:bg-sky-50">
          Далее → Предпросмотр
        </Link>
        <Link href="/mediaplan/upload" className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50">
          Назад к загрузке
        </Link>
      </div>

      <p className="mt-6 text-xs text-gray-500">
        Примечание: это заглушка. Для реальной логики разметки используй «полную версию».
      </p>
    </div>
  );
}
