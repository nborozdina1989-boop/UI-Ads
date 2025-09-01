"use client";

import { useMemo, useState } from "react";

/* ====== Канонические списки ====== */
const ATTRIBUTES = [
  // Идентификаторы/структура
  "Кампания", "ID РК", "Размещение", "ID размещения", "Баннер", "ID баннера",
  "Площадка/Домен", "Поставщик", "Агентство", "Рекламодатель", "Продукт",
  // Контекст показа
  "Формат", "Среда размещения", "Устройство", "Страна", "Город", "Дата",
  // Видео/верификация/коды
  "VAST версия", "Хостинг видео", "Тип измерения",
  // Аудитория
  "Целевая аудитория", "Пол", "Возрастная группа"
] as const;

const METRICS = [
  // Delivery / Reach
  "Показы", "Зачтённые показы", "Охват", "Экскл. аудитория", "Частота",
  // Clicks / CTR / Cost
  "Клики", "Уник. клики", "CTR", "Бюджет ₽", "CPM", "CPC", "CPA",
  // Quality / Verification
  "IVT %", "Видимость %", "Валидные показы",
  // Video
  "VTR 25%", "VTR 50%", "VTR 75%", "VTR 100%",
  // Conversions
  "Целевые действия", "Post-click конверсии", "Post-view конверсии"
] as const;

type Attribute = typeof ATTRIBUTES[number];
type Metric = typeof METRICS[number];

type ZoneName = "filters" | "rows" | "metrics";
type ZonesState = {
  filters: Attribute[];
  rows: Attribute[];
  metrics: Metric[];
};

export default function BuilderPage() {
  /* Поиски по разным спискам */
  const [qAttr, setQAttr] = useState("");
  const [qMet, setQMet] = useState("");

  /* Состояние зон */
  const [zones, setZones] = useState<ZonesState>({
    filters: ["Дата","Страна","Устройство"],
    rows: ["Кампания","Размещение"],
    metrics: ["Показы","Клики","Бюджет ₽"],
  });

  /* Фильтрация */
  const viewAttributes = useMemo(()=>{
    const n = norm(qAttr);
    return ATTRIBUTES.filter(a=> norm(a).includes(n));
  }, [qAttr]);

  const viewMetrics = useMemo(()=>{
    const n = norm(qMet);
    return METRICS.filter(m=> norm(m).includes(n));
  }, [qMet]);

  /* --- DnD helpers --- */
  function onDragStartAttr(e: React.DragEvent<HTMLButtonElement>, attr: Attribute) {
    e.dataTransfer.setData("kind", "attr");
    e.dataTransfer.setData("value", attr);
    e.dataTransfer.effectAllowed = "copy";
  }
  function onDragStartMetric(e: React.DragEvent<HTMLButtonElement>, met: Metric) {
    e.dataTransfer.setData("kind", "metric");
    e.dataTransfer.setData("value", met);
    e.dataTransfer.effectAllowed = "copy";
  }

  function allowDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  function dropTo(zone: ZoneName, e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const kind = e.dataTransfer.getData("kind");
    const val = e.dataTransfer.getData("value");

    /* Правила:
       - metrics: принимает ТОЛЬКО kind=metric
       - filters/rows: принимают ТОЛЬКО kind=attr
    */
    if (zone === "metrics" && kind !== "metric") return;
    if ((zone === "filters" || zone === "rows") && kind !== "attr") return;

    setZones(prev => {
      // защита от дублей
      if (zone === "metrics") {
        if (prev.metrics.includes(val as Metric)) return prev;
        return { ...prev, metrics: [...prev.metrics, val as Metric] };
      } else if (zone === "filters") {
        if (prev.filters.includes(val as Attribute)) return prev;
        return { ...prev, filters: [...prev.filters, val as Attribute] };
      } else {
        if (prev.rows.includes(val as Attribute)) return prev;
        return { ...prev, rows: [...prev.rows, val as Attribute] };
      }
    });
  }

  function removeFrom(zone: ZoneName, val: string) {
    setZones(prev=>{
      if (zone === "metrics") {
        return { ...prev, metrics: prev.metrics.filter(x=>x!==val) };
      } else if (zone === "filters") {
        return { ...prev, filters: prev.filters.filter(x=>x!==val) };
      } else {
        return { ...prev, rows: prev.rows.filter(x=>x!==val) };
      }
    });
  }

  function clearZone(zone: ZoneName) {
    setZones(prev => ({ ...prev, [zone]: [] as never }));
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <h1 className="text-xl font-semibold">Конструктор отчётов</h1>
          <p className="text-sm text-gray-500">Перетаскивай атрибуты и метрики в нужные зоны ниже</p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* MAIN */}
          <main className="flex-1 min-w-0">
            <div className="grid gap-4">
              <DropZone
                title="Фильтры (принимают только атрибуты)"
                hint="Например: Дата, Страна, Устройство"
                items={zones.filters}
                onDragOver={allowDrop}
                onDrop={(e)=>dropTo("filters", e)}
                onRemove={(val)=>removeFrom("filters", val)}
                onClear={()=>clearZone("filters")}
              />
              <div className="grid md:grid-cols-2 gap-4">
                <DropZone
                  title="Строки (атрибуты)"
                  hint="Например: Кампания, Размещение, Баннер"
                  items={zones.rows}
                  onDragOver={allowDrop}
                  onDrop={(e)=>dropTo("rows", e)}
                  onRemove={(val)=>removeFrom("rows", val)}
                  onClear={()=>clearZone("rows")}
                />
                <DropZone
                  title="Метрики (столбцы)"
                  hint="Принимает только метрики"
                  items={zones.metrics}
                  onDragOver={allowDrop}
                  onDrop={(e)=>dropTo("metrics", e)}
                  onRemove={(val)=>removeFrom("metrics", val)}
                  onClear={()=>clearZone("metrics")}
                />
              </div>

              {/* Предпросмотр */}
              <section className="rounded-2xl border bg-white p-4">
                <h3 className="font-semibold mb-2">Предпросмотр таблицы</h3>
                <div className="text-sm text-gray-600 mb-3">
                  Фильтры: {zones.filters.join(", ") || "—"} • Строки: {zones.rows.join(", ") || "—"} • Метрики: {zones.metrics.join(", ") || "—"}
                </div>
                <div className="overflow-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100">
                        {zones.rows.length === 0 ? (
                          <th className="border px-3 py-2 text-left">—</th>
                        ) : (
                          zones.rows.map(h => (
                            <th key={h} className="border px-3 py-2 text-left">{h}</th>
                          ))
                        )}
                        {zones.metrics.map(h => (
                          <th key={h} className="border px-3 py-2 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {(zones.rows.length === 0 ? ["Пример"] : zones.rows.map((_,i)=> i===0?"Кампания А":"…"))
                          .map((v,idx)=><td key={idx} className="border px-3 py-2">{v}</td>)}
                        {zones.metrics.map((_,idx)=><td key={idx} className="border px-3 py-2 text-right">###</td>)}
                      </tr>
                      <tr>
                        {(zones.rows.length === 0 ? ["Пример"] : zones.rows.map((_,i)=> i===0?"Кампания Б":"…"))
                          .map((v,idx)=><td key={idx} className="border px-3 py-2">{v}</td>)}
                        {zones.metrics.map((_,idx)=><td key={idx} className="border px-3 py-2 text-right">###</td>)}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </main>

          {/* SIDEBAR RIGHT */}
          <aside className="lg:w-96 lg:shrink-0 lg:order-last">
            <div className="lg:sticky lg:top-16 space-y-4">
              {/* Блок Атрибуты */}
              <section className="rounded-2xl border bg-white p-4 h-[34vh] flex flex-col">
                <h3 className="font-semibold">Атрибуты</h3>
                <input
                  value={qAttr}
                  onChange={(e)=>setQAttr(e.target.value)}
                  placeholder="Поиск по атрибутам…"
                  className="mt-2 mb-2 w-full rounded-md border px-3 py-2 text-sm"
                />
                <div className="min-h-0 flex-1 overflow-auto space-y-2">
                  {viewAttributes.map(a=>(
                    <button
                      key={a}
                      draggable
                      onDragStart={(e)=>onDragStartAttr(e,a)}
                      className="w-full text-left rounded-md border px-3 py-2 text-sm bg-white hover:bg-slate-50 active:bg-slate-100"
                      title="Перетащите в Фильтры или Строки"
                    >
                      {a}
                    </button>
                  ))}
                  {viewAttributes.length===0 && <div className="text-sm text-gray-500">Ничего не найдено</div>}
                </div>
              </section>

              {/* Блок Метрики */}
              <section className="rounded-2xl border bg-white p-4 h-[34vh] flex flex-col">
                <h3 className="font-semibold">Метрики</h3>
                <input
                  value={qMet}
                  onChange={(e)=>setQMet(e.target.value)}
                  placeholder="Поиск по метрикам…"
                  className="mt-2 mb-2 w-full rounded-md border px-3 py-2 text-sm"
                />
                <div className="min-h-0 flex-1 overflow-auto space-y-2">
                  {viewMetrics.map(m=>(
                    <button
                      key={m}
                      draggable
                      onDragStart={(e)=>onDragStartMetric(e,m)}
                      className="w-full text-left rounded-md border px-3 py-2 text-sm bg-white hover:bg-slate-50 active:bg-slate-100"
                      title="Перетащите в Метрики (столбцы)"
                    >
                      {m}
                    </button>
                  ))}
                  {viewMetrics.length===0 && <div className="text-sm text-gray-500">Ничего не найдено</div>}
                </div>
              </section>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ===== Компоненты ===== */

function DropZone({
  title, hint, items, onDragOver, onDrop, onRemove, onClear
}: {
  title: string;
  hint?: string;
  items: string[];
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onRemove: (val: string) => void;
  onClear: () => void;
}) {
  return (
    <section onDragOver={onDragOver} onDrop={onDrop} className="rounded-2xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <button onClick={onClear} className="text-xs text-blue-600 hover:underline">Очистить</button>
      </div>
      {hint && <p className="text-sm text-gray-500 mt-1">{hint}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map(v=>(
          <span key={v} className="group inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm bg-slate-50">
            {v}
            <button
              onClick={()=>onRemove(v)}
              className="rounded-full border px-1 text-xs text-gray-500 hover:bg-white"
              title="Удалить"
            >
              ×
            </button>
          </span>
        ))}
        {items.length===0 && <span className="text-sm text-gray-400">Перетащите элементы сюда</span>}
      </div>
    </section>
  );
}

function norm(s: string){ return s.toLowerCase().normalize("NFKD"); }
