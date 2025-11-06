'use client';
import React, { useMemo } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { listCampaigns } from "@/lib/campaigns";

export default function CampaignCardPage(){
  const { id } = useParams<{id:string}>();
  const sp = useSearchParams();
  const from = sp.get("from") || "";
  const campaigns = listCampaigns();
  const c = useMemo(()=> campaigns.find(x=> String(x.id)===String(id)), [campaigns, id]);

  const backHref = from ? `/campaigns?${decodeURIComponent(from)}` : "/campaigns";

  if(!c){
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-4">
          <Link href={backHref} className="rounded-full bg-white px-4 py-2 text-sm text-sky-700 ring-1 ring-sky-600 hover:bg-sky-50">← К списку РК</Link>
        </div>
        <div className="rounded-2xl border bg-white p-6 text-center text-gray-600">
          Кампания ID {id} не найдена.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href={backHref} className="rounded-full bg-white px-4 py-2 text-sm text-sky-700 ring-1 ring-sky-600 hover:bg-sky-50">← К списку РК</Link>
        <div className="flex gap-2">
          <Link href={`/dashboard?ids=${c.id}`} className="rounded-full bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700">Дашборд</Link>
          <Link href={`/builder?ids=${c.id}`} className="rounded-full bg-white px-4 py-2 text-sm text-sky-700 ring-1 ring-sky-600 hover:bg-sky-50">Конструктор</Link>
        </div>
      </div>

      <section className="rounded-2xl border bg-white p-6">
        <h1 className="mb-1 text-2xl font-bold">Карточка кампании</h1>
        <div className="mb-4 text-gray-600">Здесь будет форма/вкладки карточки РК. Пока — заглушка.</div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border p-4">
            <div className="text-xs uppercase text-gray-500">ID кампании</div>
            <div className="text-xl font-semibold">{c.id}</div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-xs uppercase text-gray-500">Название</div>
            <div className="text-lg">{c.name}</div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-xs uppercase text-gray-500">Бренд</div>
            <div>{c.brand}</div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-xs uppercase text-gray-500">Рекламодатель</div>
            <div>{c.advertiser}</div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-xs uppercase text-gray-500">Тип</div>
            <div>{c.type==="Делегированная"
              ? <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">Делегированная</span>
              : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">Собственная</span>}</div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-xs uppercase text-gray-500">Статус</div>
            <div>{c.status==="Активна"
              ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Активна</span>
              : <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">Не активна</span>}</div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-xs uppercase text-gray-500">Создана</div>
            <div>{c.createdAt}</div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-xs uppercase text-gray-500">Обновлена</div>
            <div>{c.updatedAt}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
