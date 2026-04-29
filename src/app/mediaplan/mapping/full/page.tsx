'use client';
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  loadUpload, saveUpload,
  loadMapping, saveMapping, applyMapping,
  saveImport,
  REQUIRED_KEYS, TARGET_KEYS, type Mapping,
  type CampaignMeta, type КлючСтолбца, type РазметкаRU
} from "@/lib/mediaplan";

export default function MappingPage() {
  const router = useRouter();
  const upload = loadUpload();
  const [mapping, setMapping] = useState<Mapping>(
    () => loadMapping()?.столбцы || {}
  );
  const [meta, setMeta] = useState<CampaignMeta>({ brand: "Бренд 1", campaign_name: "Новая кампания" });
  const coverage = useMemo(() => {
    const ok = REQUIRED_KEYS.filter(k => mapping[k as КлючСтолбца]);
    return { ok: ok.length, total: REQUIRED_KEYS.length, ready: ok.length === REQUIRED_KEYS.length };
  }, [mapping]);

  useEffect(() => {
    if (!upload) return;
    // Если в upload что-то поменялось — сохраним чтобы не потерять
    saveUpload(upload);
  }, [upload]);

  if (!upload) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="mb-2 text-2xl font-bold">Разметка колонок</h1>
        <p className="mb-4 text-gray-600">Файл не найден в памяти. Вернитесь к шагу загрузки.</p>
        <button className="rounded-full bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700" onClick={()=>router.push("/mediaplan/upload")}>
          К загрузке
        </button>
      </div>
    );
  }

  const currentUpload = upload;
  const headers = upload.headers;

  function setMap(key: КлючСтолбца, col: string) {
    setMapping(prev => ({ ...prev, [key]: col || undefined }));
  }

  function onApply() {
    const imp = applyMapping(mapping, currentUpload, meta);
    const mappingToSave: РазметкаRU = {
      ячейки: {
        "Рекламодатель": meta.advertiser || "",
        "Название РК": meta.campaign_name || "",
        "Бренд": meta.brand || "",
        "Агентство": meta.agency || "",
        "Продукт": meta.product || "",
        "Старт РК": meta.date_start || "",
        "Окончание РК": meta.date_end || "",
        "Делегирование кампании": (meta.delegate_accounts || []).join(", "),
      },
      столбцы: mapping,
    };
    saveMapping(mappingToSave);
    saveImport(imp);
    router.push("/campaigns/new");
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Разметка колонок</h1>
        <p className="text-sm text-gray-600">Сопоставьте обязательные поля с колонками файла. Предпросмотр ниже обновляется автоматически.</p>
      </header>

      {/* Коротко о кампании */}
      <section className="mb-6 rounded-lg border bg-white p-4">
        <div className="mb-2 text-sm font-medium">Данные кампании (черновик)</div>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-gray-600">Бренд</span>
            <input value={meta.brand} onChange={e=>setMeta(m=>({...m, brand: e.target.value}))} className="rounded-md border px-2 py-1" />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-gray-600">Название РК</span>
            <input value={meta.campaign_name} onChange={e=>setMeta(m=>({...m, campaign_name: e.target.value}))} className="w-64 rounded-md border px-2 py-1" />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-gray-600">Старт</span>
            <input type="date" onChange={e=>setMeta(m=>({...m, date_start: e.target.value||undefined}))} className="rounded-md border px-2 py-1" />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-gray-600">Окончание</span>
            <input type="date" onChange={e=>setMeta(m=>({...m, date_end: e.target.value||undefined}))} className="rounded-md border px-2 py-1" />
          </label>
        </div>
      </section>

      {/* Маппинг */}
      <div className="mb-4 text-sm">
        Покрытие обязательных: <b>{coverage.ok}/{coverage.total}</b>
        {coverage.ready ? <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">готово</span>
                        : <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">осталось сопоставить</span>}
      </div>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1 space-y-2">
          {TARGET_KEYS.map(key => {
            const targetKey = key as КлючСтолбца;
            return (
            <label key={key} className="flex items-center justify-between gap-3 text-sm">
              <span className={`text-gray-700 ${REQUIRED_KEYS.includes(key) ? "font-medium" : ""}`}>{key}</span>
              <select
                className="min-w-[14rem] rounded-md border px-2 py-1"
                value={mapping[targetKey] || ""}
                onChange={(e)=>setMap(targetKey, e.target.value)}
              >
                <option value="">— не использовать —</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </label>
          )})}
          <div className="pt-2">
            <button
              disabled={!coverage.ready}
              onClick={onApply}
              className={`rounded-full px-4 py-2 text-sm ${coverage.ready ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-gray-200 text-gray-500"}`}
            >
              Применить разметку
            </button>
            <button
              className="ml-2 rounded-full border px-4 py-2 text-sm hover:bg-gray-50"
              onClick={()=>setMapping({})}
            >
              Сбросить
            </button>
          </div>
        </div>

        {/* Предпросмотр */}
        <div className="md:col-span-2 overflow-auto rounded-lg border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {Object.entries(mapping).filter(([, v])=>v).map(([k]) => (
                  <th key={k} className="bg-gray-100 p-2 text-left">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {upload.rowsRaw.slice(0, 20).map((row, i) => (
                <tr key={i} className="odd:bg-white even:bg-gray-50">
                  {Object.entries(mapping).filter(([, v])=>v).map(([k,v]) => (
                    <td key={k} className="border-t p-2">{String(row[v as string] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
