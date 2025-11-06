'use client';
import React, { useMemo, useState } from "react";
import Link from "next/link";
import MultiSelect, { type Option } from "@/components/MultiSelect";
import { listDeleted, purgeOldDeleted, restoreCampaigns } from "@/lib/campaigns";

function daysLeft(iso:string, ttlDays=30){
  const gone = (Date.now() - new Date(iso).getTime())/86400000;
  return Math.max(0, Math.ceil(ttlDays - gone));
}

export default function CampaignsDeletedPage(){
  purgeOldDeleted();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [brands, setBrands] = useState<string[]>([]);
  const all = listDeleted();
  const brandOpts:Option[] = useMemo(()=> Array.from(new Set(all.map(a=>a.brand))).map(b=>({value:b, label:b})), [all]);

  const list = all.filter(d=>{
    const okBrand = brands.length? brands.includes(d.brand): true;
    const okQ = q? (`${d.id} ${d.name} ${d.brand}`.toLowerCase().includes(q.toLowerCase())) : true;
    return okBrand && okQ;
  });

  const toggle = (id:number)=> setSel(prev=>{const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n;});
  const restore = ()=> { const ids = Array.from(sel); if(ids.length===0) return; restoreCampaigns(ids); setSel(new Set()); location.href="/campaigns"; };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-2xl font-bold">Удалённые кампании</div>
        <Link href="/campaigns" className="rounded-full bg-white px-4 py-2 text-sm text-sky-700 ring-1 ring-sky-600 hover:bg-sky-50">← К списку РК</Link>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-600">Поиск</label>
        <input value={q} onChange={e=>setQ(e.target.value)} className="rounded-md border px-3 py-1.5 text-sm" placeholder="ID, название, бренд"/>
        <div className="w-64">
          <MultiSelect options={brandOpts} selected={brands} onChange={setBrands} placeholder="Бренды"/>
        </div>
        {sel.size>0 && <button onClick={restore} className="ml-auto rounded-full bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700">Восстановить выбранные</button>}
      </div>

      <div className="rounded-xl border bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="bg-gray-100 p-2 w-8"></th>
              <th className="bg-gray-100 p-2 text-left">ID</th>
              <th className="bg-gray-100 p-2 text-left">Название</th>
              <th className="bg-gray-100 p-2 text-left">Бренд</th>
              <th className="bg-gray-100 p-2 text-left">Удалена</th>
              <th className="bg-gray-100 p-2 text-left">Осталось дней</th>
            </tr>
          </thead>
          <tbody>
            {list.map(d=>(
              <tr key={d.id} className="odd:bg-white even:bg-gray-50">
                <td className="border-t p-2"><input type="checkbox" checked={sel.has(d.id)} onChange={()=>toggle(d.id)}/></td>
                <td className="border-t p-2 font-mono">{d.id}</td>
                <td className="border-t p-2">{d.name}</td>
                <td className="border-t p-2">{d.brand}</td>
                <td className="border-t p-2">{new Date(d.deletedAt).toLocaleDateString()}</td>
                <td className="border-t p-2">{daysLeft(d.deletedAt)}</td>
              </tr>
            ))}
            {list.length===0 && <tr><td colSpan={6} className="py-8 text-center text-gray-500">Пусто</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
