'use client';
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

/** ---------- Мок-данные для дашборда ---------- */
type Row = {
  campaignId: number;
  campaignName: string;
  country: string;
  city: string;
  device: "Desktop" | "Mobile" | "Tablet";
  imps: number;
  clicks: number;
};

const MOCK: Row[] = [
  { campaignId: 817144, campaignName: "c2c_auto_avito_select_t1_jan-feb_2025_byps", country: "Россия", city: "Москва",            device: "Desktop", imps: 120000, clicks: 600 },
  { campaignId: 817144, campaignName: "c2c_auto_avito_select_t1_jan-feb_2025_byps", country: "Россия", city: "Москва",            device: "Mobile",  imps: 210000, clicks: 900 },
  { campaignId: 817144, campaignName: "c2c_auto_avito_select_t1_jan-feb_2025_byps", country: "Россия", city: "Санкт-Петербург",   device: "Mobile",  imps:  80000, clicks: 320 },

  { campaignId: 815459, campaignName: "Default AD",                                     country: "Россия",   city: "Москва",       device: "Desktop", imps:  90000, clicks: 360 },
  { campaignId: 815459, campaignName: "Default AD",                                     country: "Казахстан",city: "Алматы",       device: "Mobile",  imps:  60000, clicks: 180 },

  { campaignId: 815931, campaignName: "Test1",                                          country: "Россия",   city: "Новосибирск",  device: "Desktop", imps:  30000, clicks:  60 },
  { campaignId: 815931, campaignName: "Test1",                                          country: "Россия",   city: "Москва",       device: "Tablet",  imps:  10000, clicks:  30 },

  { campaignId: 819306, campaignName: "Летувль_охват_август",                           country: "Россия",   city: "Москва",       device: "Desktop", imps: 500000, clicks: 1500 },
];

/** Соответствие РК → бренд (как в списке кампаний) */
const BRAND_BY_CAMPAIGN: Record<number, string> = {
  819306: "Бренд 1",
  817144: "Бренд 2",
  815459: "Бренд 2",
  815931: "Бренд 2",
  // если добавятся новые — просто дополни мапу
};

const fmtN = (n:number) => n.toLocaleString("ru-RU");

/** ---------- Дашборд ---------- */
export default function DashboardPage() {
  const params = useSearchParams();
  const router = useRouter();

  // ids, пришедшие из списка кампаний
  const idsFromQuery = useMemo(() => {
    const raw = params.get("ids") || "";
    return raw.split(",").map(s => Number(s)).filter(Boolean);
  }, [params]);

  // список всех кампаний в мок-данных
  const allCampaigns = useMemo(() => {
    const map = new Map<number, string>();
    MOCK.forEach(r => map.set(r.campaignId, r.campaignName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, []);

  // список всех брендов, присутствующих в данных
  const allBrands = useMemo(() => {
    const set = new Set<string>();
    MOCK.forEach(r => set.add(BRAND_BY_CAMPAIGN[r.campaignId] || "—"));
    return Array.from(set);
  }, []);

  // выбранные кампании (по умолчанию — из query, иначе все)
  const [selectedIds, setSelectedIds] = useState<number[]>(idsFromQuery.length ? idsFromQuery : allCampaigns.map(c => c.id));
  // выбранные бренды (пустой массив = "все бренды")
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  // фильтры локаций/устройств
  const [country, setCountry] = useState<string>("Все");
  const [city, setCity] = useState<string>("Все");
  const [device, setDevice] = useState<string>("Все");

  // восстановление фильтров
  useEffect(() => {
    try {
      const raw = localStorage.getItem("adriver/dashboard/filters");
      if (raw) {
        const f = JSON.parse(raw);
        setSelectedIds(f.selectedIds?.length ? f.selectedIds : selectedIds);
        setSelectedBrands(Array.isArray(f.selectedBrands) ? f.selectedBrands : []);
        setCountry(f.country || "Все");
        setCity(f.city || "Все");
        setDevice(f.device || "Все");
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // сохранение фильтров
  useEffect(() => {
    localStorage.setItem("adriver/dashboard/filters",
      JSON.stringify({ selectedIds, selectedBrands, country, city, device })
    );
  }, [selectedIds, selectedBrands, country, city, device]);

  // возможные значения для селектов
  const countries = useMemo(() => ["Все", ...Array.from(new Set(MOCK.map(r=>r.country)))], []);
  const cities = useMemo(() => ["Все", ...Array.from(new Set(MOCK.filter(r => country==="Все" || r.country===country).map(r=>r.city)))], [country]);
  const devices = ["Все", "Desktop", "Mobile", "Tablet"];

  // фильтрация строк
  const rows = useMemo(() => {
    return MOCK.filter(r => {
      const brand = BRAND_BY_CAMPAIGN[r.campaignId] || "—";
      return (
        selectedIds.includes(r.campaignId) &&
        (selectedBrands.length === 0 || selectedBrands.includes(brand)) &&
        (country === "Все" || r.country === country) &&
        (city === "Все"    || r.city === city) &&
        (device === "Все"  || r.device === device as any)
      );
    });
  }, [selectedIds, selectedBrands, country, city, device]);

  // агрегаты KPI
  const totals = useMemo(() => {
    const imps = rows.reduce((s,r)=>s+r.imps,0);
    const clicks = rows.reduce((s,r)=>s+r.clicks,0);
    const ctr = imps>0 ? (clicks/imps*100) : 0;
    return { imps, clicks, ctr };
  }, [rows]);

  const toggleId = (id:number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  };
  const toggleBrand = (name:string) => {
    setSelectedBrands(prev => prev.includes(name) ? prev.filter(x=>x!==name) : [...prev, name]);
  };

  const resetFilters = () => {
    setSelectedIds(idsFromQuery.length ? idsFromQuery : allCampaigns.map(c=>c.id));
    setSelectedBrands([]);
    setCountry("Все"); setCity("Все"); setDevice("Все");
  };

  // для конструктора передаём именно набор ID, который реально попал в таблицу (учтён бренд-фильтр)
  const openBuilder = () => {
    const ids = Array.from(new Set(rows.map(r => r.campaignId))).join(",");
    if (!ids) return;
    router.push(`/builder?ids=${ids}`);
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Дашборд</h1>
          <p className="text-sm text-gray-600">KPI и таблица. Фильтры: бренд, РК, страна, город, устройство.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/campaigns" className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50">К кампаниям</Link>
          <button onClick={openBuilder} className="rounded-full bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700">Открыть конструктор</button>
        </div>
      </header>

      {/* Фильтр Бренды + Кампании */}
      <section className="mb-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-4">
          <div className="mb-2 text-sm font-semibold">Бренды</div>
          <div className="flex flex-wrap gap-2">
            {allBrands.map(b => {
              const checked = selectedBrands.includes(b);
              return (
                <button
                  key={b}
                  onClick={()=>toggleBrand(b)}
                  className={`rounded-full px-3 py-1.5 text-xs ring-1 ${checked ? "bg-sky-600 text-white ring-sky-600" : "bg-white text-sky-700 ring-sky-600 hover:bg-sky-50"}`}
                >
                  {b}
                </button>
              );
            })}
            <button onClick={()=>setSelectedBrands(allBrands)} className="rounded-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">Выбрать все</button>
            <button onClick={()=>setSelectedBrands([])} className="rounded-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">Снять все</button>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="mb-2 text-sm font-semibold">Кампании (ID)</div>
          <div className="flex flex-wrap gap-2">
            {allCampaigns.map(c => {
              const checked = selectedIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={()=>toggleId(c.id)}
                  className={`rounded-full px-3 py-1.5 text-xs ring-1 ${checked ? "bg-sky-600 text-white ring-sky-600" : "bg-white text-sky-700 ring-sky-600 hover:bg-sky-50"}`}
                  title={c.name}
                >
                  {c.id}
                </button>
              );
            })}
            <button onClick={()=>setSelectedIds(allCampaigns.map(c=>c.id))} className="rounded-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">Выбрать все</button>
            <button onClick={()=>setSelectedIds([])} className="rounded-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">Снять все</button>
          </div>
        </div>
      </section>

      {/* Гео/девайс фильтры */}
      <section className="mb-4 grid gap-3 md:grid-cols-4">
        <Filter label="Страна">
          <select value={country} onChange={e=>{ setCountry(e.target.value); setCity("Все"); }} className="w-full rounded-md border px-3 py-2 text-sm">
            {["Все", ...Array.from(new Set(MOCK.map(r=>r.country)))].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </Filter>
        <Filter label="Город">
          <select value={city} onChange={e=>setCity(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm">
            {["Все", ...Array.from(new Set(MOCK.filter(r => country==="Все" || r.country===country).map(r=>r.city)))].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </Filter>
        <Filter label="Устройство">
          <select value={device} onChange={e=>setDevice(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm">
            {["Все","Desktop","Mobile","Tablet"].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </Filter>
        <div className="flex items-end">
          <button onClick={resetFilters} className="w-full rounded-md border px-3 py-2 text-sm hover:bg-gray-50">Сброс фильтров</button>
        </div>
      </section>

      {/* KPI */}
      <section className="mb-4 grid gap-3 md:grid-cols-3">
        <Kpi title="Показы" value={fmtN(totals.imps)} />
        <Kpi title="Клики" value={fmtN(totals.clicks)} />
        <Kpi title="CTR" value={`${totals.ctr.toFixed(2)}%`} />
      </section>

      {/* Таблица */}
      <section className="rounded-xl border bg-white">
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr>
                <Th>ID</Th><Th>Кампания</Th><Th>Бренд</Th><Th>Страна</Th><Th>Город</Th><Th>Устройство</Th>
                <Th className="text-right">Показы</Th><Th className="text-right">Клики</Th><Th className="text-right">CTR</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="odd:bg-white even:bg-gray-50">
                  <Td className="font-mono">{r.campaignId}</Td>
                  <Td className="truncate">{r.campaignName}</Td>
                  <Td>{BRAND_BY_CAMPAIGN[r.campaignId] || "—"}</Td>
                  <Td>{r.country}</Td>
                  <Td>{r.city}</Td>
                  <Td>{r.device}</Td>
                  <Td className="text-right">{fmtN(r.imps)}</Td>
                  <Td className="text-right">{fmtN(r.clicks)}</Td>
                  <Td className="text-right">{(r.clicks / r.imps * 100).toFixed(2)}%</Td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><Td colSpan={9} className="py-8 text-center text-gray-500">Нет данных по текущим фильтрам</Td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** ---------- Малые компоненты ---------- */
function Filter({ label, children }:{ label:string; children:React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      {children}
    </div>
  );
}

function Kpi({ title, value }:{ title:string; value:string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Th({ children, className="" }:{ children:React.ReactNode; className?:string }) {
  return <th className={`bg-gray-100 p-2 text-left ${className}`}>{children}</th>;
}
function Td({ children, className="", colSpan }:{ children:React.ReactNode; className?:string; colSpan?:number }) {
  return <td colSpan={colSpan} className={`border-t p-2 ${className}`}>{children}</td>;
}
