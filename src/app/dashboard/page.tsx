"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, PieChart, Pie, Cell
} from "recharts";

/** Брендовые цвета AdRiver */
const BRAND_BLUE   = "rgb(0,120,215)";
const BRAND_LIGHT  = "rgb(120,210,245)";
const BRAND_GREEN  = "rgb(149,214,0)";
const PIE_COLORS   = ["#0ea5e9", "#e11d48"];

type Placement = {
  id: string; campaignId: string; name: string;
  impressions: number; reach: number; exclusive: number;
  clicks: number; uclicks: number; freq: number; spend: number;
  ivtShare: number; country: string; city?: string;
  device: "web" | "mobile" | "tablet" | "smarttv";
  domain: string;
};

const CAMPAIGNS = [
  { id: "cmp-a", name: "Back-to-School 2025" },
  { id: "cmp-b", name: "Autumn Sale 2025" },
];

/* SmartTV/In-stream → IVI, In-App/Native → Hyper */
const placements: Placement[] = [
  { id: "p1", campaignId: "cmp-a", name: "Yandex / Banner 300x250", impressions: 240000, reach: 160000, exclusive: 90000, clicks: 3800, uclicks: 2900, freq: 1.50, spend: 210000, ivtShare: 2.1, country: "Россия", city: "Москва", device: "web",     domain: "yandex.ru" },
  { id: "p2", campaignId: "cmp-a", name: "VK / Video preroll",       impressions: 180000, reach: 120000, exclusive: 70000, clicks: 2600, uclicks: 2100, freq: 1.60, spend: 240000, ivtShare: 2.8, country: "Россия", city: "Санкт-Петербург", device: "mobile",  domain: "vk.com" },
  { id: "p3", campaignId: "cmp-a", name: "RBC / Banner 728x90",      impressions: 120000, reach:  85000, exclusive: 52000, clicks: 1600, uclicks: 1300, freq: 1.40, spend: 110000, ivtShare: 3.2, country: "Россия", city: "Екатеринбург",    device: "web",     domain: "rbc.ru" },
  { id: "p4", campaignId: "cmp-b", name: "IVI",                      impressions:  80000, reach:  57000, exclusive: 35000, clicks:  900, uclicks:  700, freq: 1.40, spend: 130000, ivtShare: 1.8, country: "Россия", city: "Москва",         device: "smarttv", domain: "ivi.ru" },
  { id: "p5", campaignId: "cmp-b", name: "Hyper",                    impressions: 100000, reach:  72000, exclusive: 42000, clicks: 1400, uclicks: 1100, freq: 1.40, spend:  90000, ivtShare: 2.4, country: "Казахстан", city: "Алматы",       device: "mobile",  domain: "app.example" },
];

const geoAgg = [
  { level: "Страна", name: "Россия", impressions: 520000, clicks: 6900, reach: 420000 },
  { level: "Страна", name: "Казахстан", impressions: 100000, clicks: 1400, reach:  75000 },
  { level: "Город",  name: "Москва", impressions: 260000, clicks: 3400, reach: 200000 },
  { level: "Город",  name: "Санкт-Петербург", impressions: 160000, clicks: 2200, reach: 120000 },
];

const deviceAgg = [
  { device: "все устройства", impressions: 720000, clicks: 9800, reach: 550000 },
  { device: "web",            impressions: 360000, clicks: 5400, reach: 260000 },
  { device: "mobile",         impressions: 280000, clicks: 3800, reach: 220000 },
  { device: "планшеты",       impressions:  40000, clicks:  450, reach:  30000 },
  { device: "smart TV",       impressions:  40000, clicks:  150, reach:  30000 },
];

type DomainRow = { domain: string; fact: string; impressions: number; clicks: number; actions: number; ivtShare: number };
const domains: DomainRow[] = [
  { domain: "yandex.ru", fact: "выполняется", impressions: 240000, clicks: 3800, actions: 260, ivtShare: 2.1 },
  { domain: "vk.com",    fact: "выполняется", impressions: 180000, clicks: 2600, actions: 210, ivtShare: 2.8 },
  { domain: "rbc.ru",    fact: "риски",       impressions: 120000, clicks: 1600, actions: 140, ivtShare: 3.2 },
  { domain: "ivi.ru",    fact: "выполняется", impressions:  80000, clicks:  900, actions:  90, ivtShare: 1.8 },
];

const ivt = { valid: 95.4, invalid: 4.6 };

/* utils */
function fmt(n: number) { return new Intl.NumberFormat("ru-RU").format(n); }
function aggregate(rows: Placement[]) {
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  const clicks      = rows.reduce((s, r) => s + r.clicks, 0);
  const uclicks     = rows.reduce((s, r) => s + r.uclicks, 0);
  const reach       = rows.reduce((s, r) => s + r.reach, 0);
  const exclusive   = rows.reduce((s, r) => s + r.exclusive, 0);
  const spend       = rows.reduce((s, r) => s + r.spend, 0);
  const freq        = reach ? impressions / reach : 0;
  const ivtShare    = impressions ? rows.reduce((s,r)=>s+r.ivtShare*r.impressions,0)/impressions : 0;
  return { impressions, clicks, uclicks, reach, exclusive, spend, freq, ivtShare };
}

/* клик-вне */
function useClickOutside<T extends HTMLElement>(onClickOutside: () => void) {
  const ref = useRef<T|null>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClickOutside();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClickOutside]);
  return ref;
}

/* Комбобокс Кампании (поиск+список) — широкое окно */
function CampaignCombobox({
  items, value, onChange,
}: { items: { id: string; name: string }[]; value: string; onChange: (id: string) => void; }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useClickOutside<HTMLDivElement>(()=>setOpen(false));

  const selected = items.find(i => i.id === value) || { id: "all", name: "Все кампании" };
  const filtered = [{ id: "all", name: "Все кампании" }].concat(
    items.filter(i => i.name.toLowerCase().includes(query.trim().toLowerCase()))
  );

  return (
    <div className="relative" ref={ref}>
      <label className="text-sm text-gray-600 block mb-1">Кампания</label>
      <button type="button" className="w-full rounded-md border px-3 py-2 text-left text-sm bg-white"
              onClick={()=>setOpen(o=>!o)}>
        {selected.name}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-[min(100vw,48rem)] max-w-[50vw] rounded-md border bg-white shadow">
          <input
            autoFocus placeholder="Поиск кампании…" className="w-full border-b px-3 py-2 text-sm outline-none"
            value={query} onChange={e=>setQuery(e.target.value)}
          />
          <ul className="max-h-64 overflow-auto py-1">
            {filtered.map(item=>(
              <li key={item.id}>
                <button
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-100 ${item.id===value ? "bg-slate-50 font-medium" : ""}`}
                  onClick={() => { onChange(item.id); setOpen(false); }}
                >
                  {item.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ===== Страница ===== */
export default function CampaignDashboard() {
  // фильтры
  const [periodFrom, setPeriodFrom] = useState("2025-08-01");
  const [periodTo,   setPeriodTo]   = useState("2025-08-30");
  const [device, setDevice]         = useState<"all"|"web"|"mobile"|"tablet"|"smarttv">("all");
  const [country, setCountry]       = useState<"all"|"Россия"|"Казахстан">("all");
  const [city, setCity]             = useState<"all"|"Москва"|"Санкт-Петербург"|"Екатеринбург"|"Алматы">("all");
  const [campaignId, setCampaignId] = useState<string>("all");

  // отбор
  const filtered = useMemo(() => placements.filter(p => {
    const okDevice  = device==="all" ? true : p.device===device;
    const okCountry = country==="all" ? true : p.country===country;
    const okCity    = city==="all" ? true : p.city===city;
    const okCamp    = campaignId==="all" ? true : p.campaignId===campaignId;
    return okDevice && okCountry && okCity && okCamp;
  }), [device, country, city, campaignId]);

  const totals = useMemo(() => aggregate(filtered), [filtered]);
  const chartByPlacement = useMemo(() =>
    filtered.map(p => ({ placement: p.name, impressions: p.impressions, clicks: p.clicks, spend: p.spend }))
  , [filtered]);

  return (
    <div className="min-h-dvh bg-slate-50">
      {/* ШАПКА */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-7xl px-4 py-3 space-y-3">
          {/* ОДНА СТРОКА: Период • Страна • Город • Устройство */}
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {/* Период — компактный */}
            <div className="flex items-center gap-2 shrink-0">
              <label className="text-sm text-gray-600 whitespace-nowrap">Период</label>
              <input type="date" value={periodFrom} onChange={e=>setPeriodFrom(e.target.value)}
                     className="w-[150px] rounded-md border px-2 py-1 text-sm" />
              <span className="text-gray-500">—</span>
              <input type="date" value={periodTo} onChange={e=>setPeriodTo(e.target.value)}
                     className="w-[150px] rounded-md border px-2 py-1 text-sm" />
            </div>

            {/* Страна */}
            <div className="flex items-center gap-2 shrink-0">
              <label className="text-sm text-gray-600 whitespace-nowrap">Страна</label>
              <select value={country} onChange={e=>{setCountry(e.target.value as any); setCity("all");}}
                      className="w-[160px] rounded-md border px-2 py-1 text-sm">
                <option value="all">все</option>
                <option>Россия</option>
                <option>Казахстан</option>
              </select>
            </div>

            {/* Город */}
            <div className="flex items-center gap-2 shrink-0">
              <label className="text-sm text-gray-600 whitespace-nowrap">Город (РФ)</label>
              <select value={city} onChange={e=>setCity(e.target.value as any)}
                      className="w-[180px] rounded-md border px-2 py-1 text-sm">
                <option value="all">все</option>
                <option>Москва</option>
                <option>Санкт-Петербург</option>
                <option>Екатеринбург</option>
                <option>Алматы</option>
              </select>
            </div>

            {/* Устройство */}
            <div className="flex items-center gap-2 shrink-0">
              <label className="text-sm text-gray-600 whitespace-nowrap">Устройство</label>
              <select value={device} onChange={e=>setDevice(e.target.value as any)}
                      className="w-[180px] rounded-md border px-2 py-1 text-sm">
                <option value="all">все устройства</option>
                <option value="web">web</option>
                <option value="mobile">mobile</option>
                <option value="tablet">планшеты</option>
                <option value="smarttv">smart TV</option>
              </select>
            </div>
          </div>

          {/* КАМПАНИЯ — широкая строка ниже */}
          <div className="flex">
            <div className="w-full xl:w-1/2 pr-0 xl:pr-4">
              <CampaignCombobox items={CAMPAIGNS} value={campaignId} onChange={setCampaignId} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4 space-y-4">
        {/* KPI */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Kpi title="Показы"          value={fmt(totals.impressions)} />
          <Kpi title="Охват"            value={fmt(totals.reach)} />
          <Kpi title="Экскл. аудитория" value={fmt(totals.exclusive)} />
          <Kpi title="Клики"            value={fmt(totals.clicks)} />
          <Kpi title="Уник. клики"      value={fmt(totals.uclicks)} />
          <Kpi title="Частота"          value={totals.freq.toFixed(2)} />
        </section>

        {/* Комбинированный график */}
        <section className="rounded-2xl border bg-white p-4">
          <h3 className="font-semibold mb-3">По размещениям: Показы, Клики и Бюджет</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartByPlacement}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="placement" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60}/>
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="impressions" name="Показы" stackId="a" fill={BRAND_BLUE} />
                <Bar yAxisId="left" dataKey="clicks"      name="Клики"  stackId="a" fill={BRAND_LIGHT} />
                <Line yAxisId="right" type="monotone" dataKey="spend" name="Бюджет ₽" stroke={BRAND_GREEN} strokeWidth={2} dot={false}/>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* По размещениям + Итого */}
        <CardBlock title="По размещениям">
          <div className="overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100">
                  {["Размещение","Показы","Охват","Экскл. аудитория","Клики","Уник. клики","Частота","Бюджет ₽","Доля IVT %"].map(h=>(
                    <th key={h} className="border px-3 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p=>(
                  <tr key={p.id}>
                    <td className="border px-3 py-2 font-medium">{p.name}</td>
                    <td className="border px-3 py-2">{fmt(p.impressions)}</td>
                    <td className="border px-3 py-2">{fmt(p.reach)}</td>
                    <td className="border px-3 py-2">{fmt(p.exclusive)}</td>
                    <td className="border px-3 py-2">{fmt(p.clicks)}</td>
                    <td className="border px-3 py-2">{fmt(p.uclicks)}</td>
                    <td className="border px-3 py-2">{p.freq.toFixed(2)}</td>
                    <td className="border px-3 py-2">{fmt(p.spend)}</td>
                    <td className="border px-3 py-2">{p.ivtShare.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td className="border px-3 py-2">Итого</td>
                  <td className="border px-3 py-2">{fmt(totals.impressions)}</td>
                  <td className="border px-3 py-2">{fmt(totals.reach)}</td>
                  <td className="border px-3 py-2">{fmt(totals.exclusive)}</td>
                  <td className="border px-3 py-2">{fmt(totals.clicks)}</td>
                  <td className="border px-3 py-2">{fmt(totals.uclicks)}</td>
                  <td className="border px-3 py-2">{totals.freq.toFixed(2)}</td>
                  <td className="border px-3 py-2">{fmt(totals.spend)}</td>
                  <td className="border px-3 py-2">{totals.ivtShare.toFixed(1)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardBlock>

        {/* Гео + Устройства */}
        <section className="grid gap-4 lg:grid-cols-2">
          <CardBlock title="Всего по кампании: Геозоны">
            <SimpleTable
              head={["Уровень","Название","Показы","Клики","Охват"]}
              rows={geoAgg.map(g=>[g.level,g.name,fmt(g.impressions),fmt(g.clicks),fmt(g.reach)])}
            />
          </CardBlock>
          <CardBlock title="Всего по кампании: Типы устройств">
            <SimpleTable
              head={["Устройство","Показы","Клики","Охват"]}
              rows={deviceAgg.map(d=>[d.device,fmt(d.impressions),fmt(d.clicks),fmt(d.reach)])}
            />
          </CardBlock>
        </section>

        {/* IVT + Домены */}
        <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <CardBlock title="IVT (Доля недействительного трафика)">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[{ name: "Валидный", value: ivt.valid }, { name: "IVT", value: ivt.invalid }]}
                    dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label
                  >
                    {[0,1].map(i=> <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardBlock>

          <CardBlock title="Статистика по доменам">
            <div className="overflow-auto">
              <SimpleTable
                head={["Домен","Факт","Показы","Клики","Целевые действия","Доля IVT %"]}
                rows={domains.map(r=>[r.domain,r.fact,fmt(r.impressions),fmt(r.clicks),fmt(r.actions),r.ivtShare.toFixed(1)])}
              />
            </div>
          </CardBlock>
        </section>
      </main>
    </div>
  );
}

/* UI helpers */
function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
function CardBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-white p-4">
      <h3 className="font-semibold mb-3">{title}</h3>
      {children}
    </section>
  );
}
function SimpleTable({ head, rows }: { head: string[]; rows: (string|number)[][] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-slate-100">
          {head.map(h=><th key={h} className="border px-3 py-2 text-left">{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r,i)=>(
          <tr key={i}>{r.map((c,idx)=><td key={idx} className="border px-3 py-2">{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}
