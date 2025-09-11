'use client';
import { useEffect, useMemo, useState } from 'react';

/** Локальный генератор кода (моки) */
function buildCode(i:{id:number; supplier?:string; ivt?:boolean; view?:boolean; codeType?:string;}){
  const t=(i.codeType||'').toLowerCase();
  if (t.includes('vast')){
    const url=`https://demo.adriver.local/vast?pid=${i.id}&sup=${encodeURIComponent(i.supplier||'unknown')}&ivt=${i.ivt?'1':'0'}&view=${i.view?'1':'0'}&type=${encodeURIComponent(i.codeType||'')}`;
    return {kind:'vast', text:`<VASTAdTagURI><![CDATA[${url}]]></VASTAdTagURI>`};
  }
  if (t.includes('mraid')){
    const url=`https://demo.adriver.local/mraid?pid=${i.id}&sup=${encodeURIComponent(i.supplier||'unknown')}&type=${encodeURIComponent(i.codeType||'')}`;
    return {kind:'mraid', text:`mraid.open('${url}')`};
  }
  const px=`https://demo.adriver.local/audit?pid=${i.id}&sup=${encodeURIComponent(i.supplier||'unknown')}&ivt=${i.ivt?'1':'0'}&view=${i.view?'1':'0'}&type=${encodeURIComponent(i.codeType||'')}`;
  return {kind:'audit', text:px};
}

/** Локальные табы (без импортов) */
function Tabs(){
  const base='/generation';
  const cls="px-3 py-1.5 rounded-md border text-sm";
  return (
    <div className="flex gap-2">
      <a href={base} className={`${cls} bg-white`}>Генерация</a>
      <a href={`${base}/codes`} className={`${cls} bg-slate-900 text-white`}>Коды</a>
    </div>
  );
}

type SupplierKey='yandex'|'ivi'|'ozon'|'hyper'|'vk'|'rambler'|'gpmd';
const SUPPLIER_LABEL:Record<SupplierKey,string>={yandex:'Yandex',ivi:'IVI',ozon:'Ozon',hyper:'Hyper',vk:'VK',rambler:'Rambler',gpmd:'ГПМД'};

type Row={id:number; title:string; banners:number; supplier?:SupplierKey|''; ivt?:boolean; view?:boolean; codeType?:string;};
const readRows=():Row[]=>{ try{const raw=sessionStorage.getItem('autogen_rows'); return raw? JSON.parse(raw):[];}catch{return[];} };

export default function CodesPage(){
  const [rows,setRows]=useState<Row[]>([]);
  useEffect(()=>{ setRows(readRows()); },[]);
  const built=useMemo(()=>rows.map(r=>{
    const out=buildCode({id:r.id,supplier:r.supplier?SUPPLIER_LABEL[r.supplier]:undefined,ivt:!!r.ivt,view:!!r.view,codeType:r.codeType||''});
    return {row:r, code:out.text, kind:out.kind, warn:!r.supplier || !r.codeType};
  }),[rows]);

  const copy=(t:string)=>navigator.clipboard?.writeText(t);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Tabs/>
        <div className="flex items-center gap-2">
          <a href="/generation" className="px-3 py-1.5 rounded-md border bg-white">← Назад к Генерации</a>
          <a href="/404" className="px-3 py-1.5 rounded-md bg-violet-600 text-white">Заказать коды</a>
        </div>
      </div>

      <div className="overflow-auto border rounded-lg">
        <table className="min-w-full bg-white">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase text-slate-500">
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Название</th>
              <th className="px-3 py-2">Поставщик</th>
              <th className="px-3 py-2">Тип кода</th>
              <th className="px-3 py-2">Код</th>
              <th className="px-3 py-2">Действия</th>
              <th className="px-3 py-2">Статус</th>
            </tr>
          </thead>
          <tbody>
            {built.map(({row,code,kind,warn})=>(
              <tr key={row.id} className="border-t hover:bg-slate-50 text-sm">
                <td className="px-3 py-2">{row.id}</td>
                <td className="px-3 py-2">{row.title}</td>
                <td className="px-3 py-2">{row.supplier?SUPPLIER_LABEL[row.supplier]:'—'}</td>
                <td className="px-3 py-2">{row.codeType||'—'}</td>
                <td className="px-3 py-2">
                  <textarea readOnly value={code} rows={kind==='vast'?3:2} className="w-[520px] max-w-full border rounded p-2 font-mono text-xs bg-slate-50"/>
                </td>
                <td className="px-3 py-2"><button onClick={()=>copy(code)} className="px-2 py-1 border rounded">Скопировать</button></td>
                <td className="px-3 py-2">{warn? <span className="text-amber-600">⚠️</span> : <span className="text-green-600">✔︎</span>}</td>
              </tr>
            ))}
            {built.length===0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                Пусто. Вернись на «Генерация» и нажми «Далее».
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
