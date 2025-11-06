'use client';
import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  MediaplanUpload, saveUpload,
  ОБЯЗАТЕЛЬНЫЕ_ЯЧЕЙКИ, ДОП_ЯЧЕЙКИ,
  ОБЯЗАТЕЛЬНЫЕ_СТОЛБЦЫ, ДОП_СТОЛБЦЫ,
  autoMapColumnsRU, applyMappingRU,
  saveMappingRU, loadMappingRU,
  type РазметкаRU
} from "@/lib/mediaplan";
import { saveImport } from "@/lib/mediaplan";
import { useRouter } from "next/navigation";

/** Автопоиск строки заголовков */
function detectHeaderRow(rows: any[][]): number {
  let bestIdx = 0, bestScore = -1;
  for (let i=0; i<Math.min(rows.length, 30); i++) {
    const score = (rows[i]||[]).reduce((s:number, c:any)=> s + (!!c ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  return bestIdx;
}

export default function UploadPage() {
  const router = useRouter();
  const [upload, setUpload] = useState<MediaplanUpload | null>(null);
  const [mapping, setMapping] = useState<РазметкаRU>(() => loadMappingRU() || { ячейки:{}, столбцы:{} });

  const coverage = useMemo(() => {
    const cellsOK = ОБЯЗАТЕЛЬНЫЕ_ЯЧЕЙКИ.filter(k => mapping.ячейки[k]).length;
    const colsOK = ОБЯЗАТЕЛЬНЫЕ_СТОЛБЦЫ.filter(k => mapping.столбцы[k]).length;
    return { cellsOK, colsOK, ready: (cellsOK===ОБЯЗАТЕЛЬНЫЕ_ЯЧЕЙКИ.length && colsOK===ОБЯЗАТЕЛЬНЫЕ_СТОЛБЦЫ.length) };
  }, [mapping]);

  async function handleFile(file: File) {
    const buf = await file.arrayBuffer();
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv")) {
      const text = new TextDecoder("utf-8").decode(new Uint8Array(buf));
      const lines = text.split(/\r?\n/).filter(Boolean);
      const headerIdx = 0;
      const headers = (lines[0]||"").split(",").map(s=>s.trim());
      const rowsRaw = lines.slice(1).map(l => {
        const arr = l.split(","); const o:Record<string,any> = {};
        headers.forEach((h,i)=>o[h]=arr[i]); return o;
      });
      const u: MediaplanUpload = { fileName: file.name, sheet: "csv", headerRow: 1, headers, rowsRaw };
      setUpload(u); saveUpload(u);
      setMapping(m => ({ ...m, столбцы: { ...m.столбцы, ...autoMapColumnsRU(headers) } }));
      return;
    }

    const wb = XLSX.read(buf, { type: "array" });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true }) as any[][];
    const headerIdx = detectHeaderRow(matrix);
    const headers = (matrix[headerIdx] || []).map(x => String(x||"").trim());
    const body = matrix.slice(headerIdx+1).filter(r => (r||[]).some(c => c!=null && String(c).trim()!==""));
    const rowsRaw = body.map(r => { const o:Record<string,any> = {}; headers.forEach((h,i)=>o[h]=r[i]); return o; });

    const u: MediaplanUpload = { fileName: file.name, sheet: sheetName, headerRow: headerIdx+1, headers, rowsRaw };
    setUpload(u); saveUpload(u);
    setMapping(m => ({ ...m, столбцы: { ...m.столбцы, ...autoMapColumnsRU(headers) } }));
  }

  function onCreateCampaign() {
    if (!upload) return;
    const imp = applyMappingRU(mapping, upload);
    saveMappingRU(mapping);
    saveImport(imp);
    router.push("/autogen");
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Загрузка медиаплана</h1>
          <p className="text-sm text-gray-600">Скачайте шаблон или загрузите ваш .xlsx/.csv. После загрузки здесь же появится разметка.</p>
        </div>
        <a href="/templates/mediaplan_template.xlsx" download
           className="rounded-full bg-white px-4 py-2 text-sm text-sky-700 ring-1 ring-sky-600 hover:bg-sky-50">
          Скачать шаблон
        </a>
      </header>

      {/* Дропзона */}
      <div className="mb-6 rounded-xl border-2 border-dashed p-6 text-center">
        <input type="file" accept=".xlsx,.xls,.csv" onChange={(e)=>{ const f=e.target.files?.[0]; if (f) handleFile(f); }} className="mx-auto block" />
        <div className="mt-2 text-xs text-gray-500">Или перетащите файл сюда</div>
      </div>

      {/* Пока файла нет — ниже ничего не показываем */}
      {!upload && <div className="text-sm text-gray-500">Файл не загружен.</div>}

      {upload && (
        <>
          {/* Шапка статуса */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-gray-600">
              Файл: <b>{upload.fileName}</b> • Лист: <b>{upload.sheet}</b> • Строка заголовков: <b>{upload.headerRow}</b>
            </div>
            <div className="text-sm">
              Обязательные: ячейки <b>{ОБЯЗАТЕЛЬНЫЕ_ЯЧЕЙКИ.length}</b>, столбцы <b>{ОБЯЗАТЕЛЬНЫЕ_СТОЛБЦЫ.length}</b> •
              Заполнено: ячейки <b>{coverage.cellsOK}</b>, столбцы <b>{coverage.colsOK}</b>
            </div>
          </div>

          {/* Разметка: панель справа + таблица */}
          <section className="grid gap-6 md:grid-cols-3">
            {/* Правая панель объектов */}
            <aside className="order-2 md:order-1 md:col-span-1 space-y-4">
              <div className="rounded-lg border bg-white p-4">
                <div className="mb-2 text-sm font-semibold">Параметры кампании</div>
                <div className="space-y-2">
                  {ОБЯЗАТЕЛЬНЫЕ_ЯЧЕЙКИ.map(k => (
                    <label key={k} className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">{k}</span>
                      <input className="min-w-[14rem] rounded-md border px-2 py-1"
                             value={(mapping.ячейки[k] || "")}
                             onChange={(e)=>setMapping(m=>({...m, ячейки:{...m.ячейки, [k]: e.target.value}}))}
                             placeholder={`Введите значение «${k}»`} />
                    </label>
                  ))}
                  <details>
                    <summary className="cursor-pointer text-sm text-gray-700">Дополнительно</summary>
                    <div className="mt-2 space-y-2">
                      {ДОП_ЯЧЕЙКИ.map(k => (
                        <label key={k} className="flex items-center justify-between gap-3 text-sm">
                          <span>{k}</span>
                          <input className="min-w-[14rem] rounded-md border px-2 py-1"
                                 value={(mapping.ячейки[k] || "")}
                                 onChange={(e)=>setMapping(m=>({...m, ячейки:{...m.ячейки, [k]: e.target.value}}))}
                                 placeholder={`Введите «${k}»`} />
                        </label>
                      ))}
                    </div>
                  </details>
                </div>
              </div>

              <div className="rounded-lg border bg-white p-4">
                <div className="mb-2 text-sm font-semibold">Столбцы позиций</div>
                <div className="space-y-2">
                  {ОБЯЗАТЕЛЬНЫЕ_СТОЛБЦЫ.map(k => (
                    <label key={k} className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">{k}</span>
                      <select className="min-w-[14rem] rounded-md border px-2 py-1"
                              value={(mapping.столбцы[k] || "")}
                              onChange={(e)=>setMapping(m=>({...m, столбцы:{...m.столбцы, [k]: e.target.value}}))}>
                        <option value="">— выбрать колонку —</option>
                        {upload.headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </label>
                  ))}
                  <details>
                    <summary className="cursor-pointer text-sm text-gray-700">Дополнительно</summary>
                    <div className="mt-2 space-y-2">
                      {ДОП_СТОЛБЦЫ.map(k => (
                        <label key={k} className="flex items-center justify-between gap-3 text-sm">
                          <span>{k}</span>
                          <select className="min-w-[14rem] rounded-md border px-2 py-1"
                                  value={(mapping.столбцы[k] || "")}
                                  onChange={(e)=>setMapping(m=>({...m, столбцы:{...m.столбцы, [k]: e.target.value}}))}>
                            <option value="">— не использовать —</option>
                            {upload.headers.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </label>
                      ))}
                    </div>
                  </details>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  disabled={!coverage.ready}
                  onClick={()=>{ saveMappingRU(mapping); onCreateCampaign(); }}
                  className={`rounded-full px-4 py-2 text-sm ${coverage.ready ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-gray-200 text-gray-500"}`}
                >
                  Создать кампанию
                </button>
                <button onClick={()=>saveMappingRU(mapping)} className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50">Сохранить разметку</button>
              </div>
            </aside>

            {/* Таблица предпросмотра исходного файла */}
            <div className="order-1 md:order-2 md:col-span-2 overflow-auto rounded-lg border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {upload.headers.map(h => (<th key={h} className="bg-gray-100 p-2 text-left">{h}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {upload.rowsRaw.slice(0, 50).map((row, i) => (
                    <tr key={i} className="odd:bg-white even:bg-gray-50">
                      {upload.headers.map(h => (<td key={h} className="border-t p-2">{String(row[h] ?? "")}</td>))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
