'use client';
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadImport } from "@/lib/mediaplan";

/** Детерминированные ID без бэка */
function hash(s: string) { let h=0; for (let i=0;i<s.length;i++) h=(h*31 + s.charCodeAt(i))|0; return Math.abs(h); }
function getStableCampaignId(name?: string) {
  if (typeof window === "undefined") return 815931;
  const key = `adriver/tmp/cid/${name || "default"}`;
  const cached = localStorage.getItem(key);
  if (cached) return Number(cached);
  const base = (hash(name || "campaign") % 900000) + 100000;
  localStorage.setItem(key, String(base));
  return base;
}
function genPids(n: number, seedName?: string) {
  const base = 4471000 + (hash(seedName || "pids") % 700);
  return Array.from({length: Math.max(1,n||3)}, (_,i)=> base + i);
}

export default function CampaignCreateHub() {
  const imp = loadImport();
  const [progress, setProgress] = useState(0);

  const campaignName = imp?.meta?.campaign_name || "Новая кампания";
  const campaignId   = useMemo(()=> getStableCampaignId(campaignName), [campaignName]);
  const pids         = useMemo(()=> genPids(imp?.rows?.length || 3, campaignName), [imp, campaignName]);
  const names        = useMemo(()=> {
    const rows = imp?.rows || [];
    if (rows.length) return rows.map((r:any, i:number)=> r.platform_name || r.supplier || `Сценарий ${i+1}`);
    return ["Yandex", "IVI", "Hyper"];
  }, [imp]);

  useEffect(()=>{
    let t = 0;
    const id = setInterval(()=>{ t+=5; setProgress(p=> Math.min(100, p+5)); if (t>=100) clearInterval(id); }, 40);
    return ()=> clearInterval(id);
  },[]);

  return (
    <div className="mx-auto max-w-3xl p-10">
      {/* Ступени процесса */}
      <ol className="mb-6 grid grid-cols-3 gap-2 text-sm">
        <li className="rounded-full bg-sky-600 px-3 py-1 text-center font-medium text-white">1. Загрузка медиаплана</li>
        <li className="rounded-full bg-sky-100 px-3 py-1 text-center font-medium text-sky-700 ring-1 ring-sky-300">2. Создание РК</li>
        <li className="rounded-full bg-gray-100 px-3 py-1 text-center text-gray-600">3. Автогенерация кодов</li>
      </ol>

      {/* Прогресс */}
      <div className="mb-6">
        <div className="mb-1 flex items-center justify-between text-sm text-gray-600">
          <span>Прогресс создания РК</span>
          <span className="tabular-nums">{progress}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
          <div className="h-3 rounded-full bg-sky-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Карточка */}
      <div className="mb-6 rounded-2xl border bg-white p-8 text-center shadow-sm">
        <div className="text-2xl font-semibold">Экран создания рекламной кампании</div>
        <div className="mt-2 text-gray-600">Здесь будет форма с основными параметрами РК. Пока — заглушка.</div>
      </div>

      {/* Превью ID и табличные PID */}
      <div className="mb-8 rounded-2xl border bg-white p-5">
        <div className="mb-3 grid gap-2 md:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">ID кампании</div>
            <div className="text-xl font-semibold">{campaignId}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Название кампании</div>
            <div className="truncate text-lg">{campaignName}</div>
          </div>
        </div>

        <div className="text-sm font-medium">Позиции (PID)</div>
        <div className="mt-2 overflow-auto rounded-lg border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-gray-100 p-2 text-left">PID</th>
                <th className="bg-gray-100 p-2 text-left">Название сценария</th>
              </tr>
            </thead>
            <tbody>
              {pids.map((pid, i) => (
                <tr key={pid} className="odd:bg-white even:bg-gray-50">
                  <td className="border-t p-2 font-mono">{pid}</td>
                  <td className="border-t p-2">{names[i] || `Сценарий ${i+1}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Кнопки */}
      <div className="flex flex-col items-center gap-4">
        <Link href="/campaigns" className="w-full max-w-md rounded-full border px-6 py-3 text-center text-base hover:bg-gray-50">
          К списку РК
        </Link>
        <Link href="/generation" className="w-full max-w-md rounded-full bg-sky-600 px-6 py-3 text-center text-base text-white hover:bg-sky-700">
          Далее к автогенерации кодов
        </Link>
      </div>

      <div className="mt-8 text-center">
        <Link href="/mediaplan/upload" className="text-sm text-sky-700 hover:underline">← Вернуться к загрузке медиаплана</Link>
      </div>
    </div>
  );
}
