'use client';
import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download, RotateCcw, Star, X } from "lucide-react";
import { listCampaigns, exportExcel, type Campaign } from "@/lib/campaigns";
import { getArchivedIds, getArchivedAt, restoreCampaigns, getFavCampaignIds, toggleFavCampaign, isFavCampaign } from "@/lib/archfav";

function Tabs() {
  const path = usePathname();
  const Tab = ({href,label}:{href:string;label:string}) => (
    <Link href={href}
      className={`rounded-full px-3 py-1.5 text-sm ${path===href? "bg-sky-600 text-white":"bg-white text-sky-700 ring-1 ring-sky-600 hover:bg-sky-50"}`}>{label}</Link>
  );
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">
        <Tab href="/campaigns" label="РК"/>
        <Tab href="/campaigns/groups" label="Группы"/>
        <Tab href="/campaigns/archive" label="Архив"/>
      </div>
      <Link
        href="/campaigns/tracker-sites"
        className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Трекерные сайты
      </Link>
    </div>
  );
}

type GroupMode = "none"|"brand"|"adv"|"tree";
type SortMode = "arch_desc"|"arch_asc"|"name_asc"|"name_desc";
type FlatBucket = { __flat: Campaign[] };
type FlatGrouped = Record<string, FlatBucket>;
type TreeGrouped = Record<string, Record<string, FlatBucket>>;

function isFlatBucket(bucket: FlatBucket | Record<string, FlatBucket>): bucket is FlatBucket {
  return "__flat" in bucket;
}

function countBucket(bucket: FlatBucket | Record<string, FlatBucket>) {
  if (isFlatBucket(bucket)) return bucket.__flat.length;
  return Object.values(bucket).reduce((n, v) => n + v.__flat.length, 0);
}

function getTreeEntries(bucket: FlatBucket | Record<string, FlatBucket>) {
  if (isFlatBucket(bucket)) return [] as [string, FlatBucket][];
  return Object.entries(bucket);
}

export default function ArchivePage(){
  const [mounted, setMounted] = useState(false);
  useEffect(()=>{ setMounted(true); },[]);

  const [q, setQ] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [groupMode, setGroupMode] = useState<GroupMode>("none");
  const [sort, setSort] = useState<SortMode>("arch_desc");

  const all = listCampaigns();
  const archivedIds = useMemo(()=> new Set(getArchivedIds()),[]);
  const favSet = useMemo(()=> new Set(getFavCampaignIds()),[]);

  const filtered = useMemo(()=>{
    const term = q.trim().toLowerCase();
    return all
      .filter(c => archivedIds.has(c.id))
      .filter(c => !term || [c.id, c.name, c.brand, c.advertiser].some(x=> String(x||"").toLowerCase().includes(term)))
      .filter(c => favOnly ? favSet.has(c.id) : true);
  }, [all, archivedIds, q, favOnly, favSet]);

  const sorted = useMemo(()=>{
    const byName = (a:Campaign,b:Campaign)=> a.name.localeCompare(b.name,"ru");
    const byArch = (a:Campaign,b:Campaign)=> {
      const ad = new Date(getArchivedAt(a.id)||0).getTime();
      const bd = new Date(getArchivedAt(b.id)||0).getTime();
      return ad - bd;
    };
    const arr = [...filtered];
    switch (sort) {
      case "name_asc": return arr.sort(byName);
      case "name_desc": return arr.sort((a,b)=>-byName(a,b));
      case "arch_asc": return arr.sort(byArch);
      default: return arr.sort((a,b)=>-byArch(a,b));
    }
  }, [filtered, sort]);

  const grouped = useMemo<FlatGrouped | TreeGrouped>(()=>{
    if (groupMode==="none") return { "Архив": { "__flat": sorted } };
    if (groupMode==="brand"){
      const m: FlatGrouped = {};
      sorted.forEach(c=>{ const k = c.brand || "Без бренда"; (m[k] ||= { "__flat": [] }).__flat.push(c); });
      return m;
    }
    if (groupMode==="adv"){
      const m: FlatGrouped = {};
      sorted.forEach(c=>{ const k = c.advertiser || "Без рекламодателя"; (m[k] ||= { "__flat": [] }).__flat.push(c); });
      return m;
    }
    const m: TreeGrouped = {};
    sorted.forEach(c=>{
      const a = c.advertiser || "Без рекламодателя";
      const b = c.brand || "Без бренда";
      (m[a] ||= {}); (m[a][b] ||= { "__flat": [] }).__flat.push(c);
    });
    return m;
  }, [sorted, groupMode]);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const toggleSel = (id:number)=> setSelected(prev=>{ const n=new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const clearSel = ()=> setSelected(new Set());
  const ids = Array.from(selected);

  const exportAction = ()=> exportExcel(sorted.filter(c=>selected.has(c.id)));
  const restoreAction = ()=> { if(!ids.length) return; if(confirm(`Разархивировать ${ids.length} камп.?`)){ restoreCampaigns(ids); clearSel(); alert("Вернули из архива."); location.reload(); } };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Tabs/>

      {!mounted ? (
        <div className="rounded-2xl border bg-white p-8 text-gray-500">Загрузка…</div>
      ) : (
        <>
          <header className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Поиск</label>
              <input value={q} onChange={e=> setQ(e.target.value)} placeholder="ID, название, бренд/рекламодатель"
                    className="rounded-md border px-3 py-1.5 text-sm"/>
            </div>

            <label className="flex items-center gap-2 text-sm">
              Группировать
              <select value={groupMode} onChange={e=>setGroupMode(e.target.value as GroupMode)} className="rounded-md border px-2 py-1.5 text-sm">
                <option value="none">Нет</option>
                <option value="brand">Бренд</option>
                <option value="adv">Рекламодатель</option>
                <option value="tree">Иерархия</option>
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm">
              Показать
              <select value={favOnly ? "fav":"all"} onChange={e=>setFavOnly(e.target.value==="fav")} className="rounded-md border px-2 py-1.5 text-sm">
                <option value="all">Все</option>
                <option value="fav">Избранные</option>
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm">
              Сортировка
              <select value={sort} onChange={e=>setSort(e.target.value as SortMode)} className="rounded-md border px-2 py-1.5 text-sm">
                <option value="arch_desc">Сначала новые (архив)</option>
                <option value="arch_asc">Сначала старые (архив)</option>
                <option value="name_asc">Название A→Z</option>
                <option value="name_desc">Название Z→A</option>
              </select>
            </label>
          </header>

          {selected.size>0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 ring-1 ring-sky-200">
              <div className="text-sm text-sky-900">Выбрано: <b>{selected.size}</b></div>
              <button onClick={exportAction} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-sky-700 ring-1 ring-sky-600" title="Экспорт Excel"><Download className="h-4 w-4" /></button>
              <button onClick={restoreAction} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-emerald-700 ring-1 ring-emerald-600" title="Разархивировать"><RotateCcw className="h-4 w-4" /></button>
              <button onClick={()=>clearSel()} className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-700 ring-1 ring-gray-300" title="Сбросить"><X className="h-4 w-4" /></button>
            </div>
          )}

          <div className="space-y-6">
            {Object.entries(grouped).map(([label, bucket])=>(
              <section key={label} className="rounded-2xl border bg-white p-4 shadow-sm">
                {Object.keys(grouped).length>1 && (
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-left text-xl font-semibold">
                      {label} <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {countBucket(bucket)}
                      </span>
                    </div>
                  </div>
                )}
                <div className="overflow-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="bg-gray-100 p-2 w-8"></th>
                        <th className="bg-gray-100 p-2 w-8"></th>
                        <th className="bg-gray-100 p-2 text-left">ID</th>
                        <th className="bg-gray-100 p-2 text-left">Название / Архивирована</th>
                        <th className="bg-gray-100 p-2 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      { (groupMode!=="tree")
                        ? ((isFlatBucket(bucket) ? bucket.__flat : [])).map((c:Campaign)=> (
                            <tr key={c.id} className="odd:bg-white even:bg-gray-50 hover:bg-sky-50">
                              <td className="border-t p-2"><input type="checkbox" checked={(new Set(selected)).has(c.id)} onChange={()=>toggleSel(c.id)}/></td>
                              <td className="border-t p-2">
                                <button onClick={()=>{ toggleFavCampaign(c.id); location.reload(); }} className="inline-flex rounded-full p-1 hover:bg-sky-50">
                                  <Star className={`h-4 w-4 ${isFavCampaign(c.id) ? "fill-[color:var(--adr-green)] text-[color:var(--adr-green)]" : "text-[color:var(--adr-text-muted)]"}`} />
                                </button>
                              </td>
                              <td className="border-t p-2 font-mono text-sky-700 underline-offset-2 hover:underline"><Link href={`/campaigns/${c.id}`}>{c.id}</Link></td>
                              <td className="border-t p-2">
                                <div className="text-sky-700 underline-offset-2 hover:underline"><Link href={`/campaigns/${c.id}`}>{c.name}</Link></div>
                                <div className="text-xs text-gray-500">Архивирована: {new Date(getArchivedAt(c.id)||0).toLocaleDateString("ru-RU")}</div>
                              </td>
                              <td className="border-t p-2 text-right">
                                <button onClick={()=>exportExcel([c])} title="Экспорт Excel" className="mr-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-sky-700 ring-1 ring-sky-600"><Download className="h-4 w-4" /></button>
                                <button onClick={()=>{ restoreCampaigns([c.id]); location.reload(); }} title="Разархивировать" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-emerald-700 ring-1 ring-emerald-600"><RotateCcw className="h-4 w-4" /></button>
                              </td>
                            </tr>
                          ))
                        : getTreeEntries(bucket).map(([brand, bkt])=>(
                            <React.Fragment key={String(brand)}>
                              <tr><td colSpan={5} className="bg-gray-50 p-2 font-semibold">{brand}</td></tr>
                              {bkt.__flat.map((c:Campaign)=> (
                                <tr key={c.id} className="odd:bg-white even:bg-gray-50 hover:bg-sky-50">
                                  <td className="border-t p-2"><input type="checkbox" checked={(new Set(selected)).has(c.id)} onChange={()=>toggleSel(c.id)}/></td>
                                  <td className="border-t p-2">
                                    <button onClick={()=>{ toggleFavCampaign(c.id); location.reload(); }} className="inline-flex rounded-full p-1 hover:bg-sky-50">
                                      <Star className={`h-4 w-4 ${isFavCampaign(c.id) ? "fill-[color:var(--adr-green)] text-[color:var(--adr-green)]" : "text-[color:var(--adr-text-muted)]"}`} />
                                    </button>
                                  </td>
                                  <td className="border-t p-2 font-mono text-sky-700 underline-offset-2 hover:underline"><Link href={`/campaigns/${c.id}`}>{c.id}</Link></td>
                                  <td className="border-t p-2">
                                    <div className="text-sky-700 underline-offset-2 hover:underline"><Link href={`/campaigns/${c.id}`}>{c.name}</Link></div>
                                    <div className="text-xs text-gray-500">Архивирована: {new Date(getArchivedAt(c.id)||0).toLocaleDateString("ru-RU")}</div>
                                  </td>
                                  <td className="border-t p-2 text-right">
                                    <button onClick={()=>exportExcel([c])} title="Экспорт Excel" className="mr-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-sky-700 ring-1 ring-sky-600"><Download className="h-4 w-4" /></button>
                                    <button onClick={()=>{ restoreCampaigns([c.id]); location.reload(); }} title="Разархивировать" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-emerald-700 ring-1 ring-emerald-600"><RotateCcw className="h-4 w-4" /></button>
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))
                      }
                      {("__flat" in bucket ? bucket.__flat.length : 0)===0 && groupMode!=="tree" && (<tr><td colSpan={5} className="py-8 text-center text-gray-500">Ничего не найдено</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
