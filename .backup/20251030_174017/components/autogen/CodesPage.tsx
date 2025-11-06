'use client';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import TabsAutogen from '@/components/autogen/TabsAutogen';
import { buildCode } from '@/lib/codeBuilder';
import { SUPPLIER_LABEL, SupplierKey } from '@/lib/suppliers';

type Row={id:number; title:string; banners:number; supplier?:SupplierKey|''; med?:boolean; ivt?:boolean; view?:boolean; codeType?:string;};
const readRows=():Row[]=>{try{const raw=sessionStorage.getItem('autogen_rows');return raw?JSON.parse(raw):[]}catch{return[];}};

export default function CodesPage(){
  const [rows,setRows]=useState<Row[]>([]);
  const base = usePathname().startsWith('/generation')? '/generation' : '/autogen';
  useEffect(()=>{ setRows(readRows()); },[]);
  const built=useMemo(()=>rows.map(r=>{const o=buildCode({id:r.id,title:r.title,supplier:r.supplier?SUPPLIER_LABEL[r.supplier]:undefined,ivt:!!r.ivt,view:!!r.view,codeType:r.codeType||''});return{row:r,code:o.text,kind:o.kind,warn:!r.supplier||!r.codeType};}),[rows]);
  const copy=(t:string)=>navigator.clipboard?.writeText(t);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <TabsAutogen/>
        <div className="flex gap-2"><a href={base} className="px-3 py-1.5 rounded-md border bg-white">← Назад к Генерации</a><a href="/404" className="px-3 py-1.5 rounded-md bg-violet-600 text-white">Заказать коды</a></div>
      </div>
      <div className="overflow-auto border rounded-lg">
        <table className="min-w-full bg-white">
          <thead><tr className="bg-slate-50 text-xs uppercase text-slate-500">
            <th className="px-3 py-2">ID</th><th className="px-3 py-2">Название</th><th className="px-3 py-2">Поставщик</th><th className="px-3 py-2">Тип кода</th><th className="px-3 py-2">Код</th><th className="px-3 py-2">Действия</th><th className="px-3 py-2">Статус</th>
          </tr></thead>
          <tbody>
            {built.map(({row,code,kind,warn})=>(
              <tr key={row.id} className="border-t hover:bg-slate-50 text-sm">
                <td className="px-3 py-2">{row.id}</td>
                <td className="px-3 py-2">{row.title}</td>
                <td className="px-3 py-2">{row.supplier?SUPPLIER_LABEL[row.supplier]:'—'}</td>
                <td className="px-3 py-2">{row.codeType||'—'}</td>
                <td className="px-3 py-2"><textarea readOnly value={code} rows={kind==='vast'?3:2} className="w-[520px] max-w-full border rounded p-2 font-mono text-xs bg-slate-50"/></td>
                <td className="px-3 py-2"><button onClick={()=>copy(code)} className="px-2 py-1 border rounded">Скопировать</button></td>
                <td className="px-3 py-2">{warn?<span className="text-amber-600">⚠️</span>:<span className="text-green-600">✔︎</span>}</td>
              </tr>
            ))}
            {built.length===0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">Пусто. Вернись на «Генерация» и нажми «Далее».</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
