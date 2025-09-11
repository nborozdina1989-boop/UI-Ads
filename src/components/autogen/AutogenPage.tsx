'use client';
import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import TabsAutogen from '@/components/autogen/TabsAutogen';
import { StatusIcon } from '@/components/autogen/StatusIcon';
import { CODE_TYPES } from '@/lib/codeTypes';
import { inferSupplierByTitle, SUPPLIER_LABEL, SupplierKey } from '@/lib/suppliers';

type RowStatus='ok'|'warn'|'dirty';
type Row={ id:number; title:string; banners:number; supplier?:SupplierKey|''; med?:boolean; ivt?:boolean; view?:boolean; codeType?:string; status:RowStatus; pendingChanges?:boolean; };

const INITIAL:Row[]=[
  {id:4471765,title:'Yandex',banners:1,supplier:'yandex',med:false,ivt:false,view:false,codeType:'',status:'ok'},
  {id:4471766,title:'IVI',banners:1,supplier:'',med:false,ivt:false,view:false,codeType:'',status:'warn'},
  {id:4471767,title:'Hyper',banners:1,supplier:'',med:false,ivt:false,view:false,codeType:'',status:'warn'}
];

export default function AutogenPage(){
  const [rows,setRows]=useState<Row[]>(INITIAL);
  const [qId,setQId]=useState(''); const [qTitle,setQTitle]=useState('');
  const [selectAll,setSelectAll]=useState(false);
  const [modalWarn,setModalWarn]=useState<null|{warn:number}>(null);
  const base = usePathname().startsWith('/generation')? '/generation' : '/autogen';

  const filtered=useMemo(()=>rows.filter(r=>{
    const a=qId===''||String(r.id).includes(qId); const b=qTitle===''||r.title.toLowerCase().includes(qTitle.toLowerCase());
    return a&&b;
  }),[rows,qId,qTitle]);

  const markDirty=(i:number)=>setRows(p=>{const c=[...p]; c[i]={...c[i],status:c[i].status==='ok'?'dirty':c[i].status,pendingChanges:true}; return c;});
  const applyRow=(i:number)=>setRows(p=>{const c=[...p]; const r=c[i]; c[i]={...r,status:r.supplier?'ok':'warn',pendingChanges:false}; return c;});
  const suggestRow=(i:number)=>setRows(p=>{const c=[...p]; const r=c[i]; const rand=CODE_TYPES[Math.floor(Math.random()*CODE_TYPES.length)]; c[i]={...r,codeType:rand,status:'ok',pendingChanges:false}; return c;});
  const detect=(i:number)=>setRows(p=>{const c=[...p]; const r=c[i]; const d=inferSupplierByTitle(r.title); c[i]=d.kind==='single'?{...r,supplier:d.key,status:'ok'}:{...r,supplier:'',status:'warn'}; return c;});
  const proceed=()=>{const warn=rows.filter(r=>r.status!=='ok').length; if(warn){setModalWarn({warn}); return;} try{sessionStorage.setItem('autogen_rows',JSON.stringify(rows));}catch{} window.location.href=`${base}/codes`;};

  const th="px-3 py-2 text-xs uppercase text-slate-500"; const td="px-3 py-2 text-sm border-t";
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <TabsAutogen/>
        <div className="flex gap-2">
          <button disabled className="px-3 py-1.5 rounded-md border bg-slate-100 text-slate-400">Загрузить Excel ⤴︎</button>
          <button disabled className="px-3 py-1.5 rounded-md border bg-slate-100 text-slate-400">Скачать шаблон ⤓</button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-sm text-slate-500">Файл конфигурации</div>
        <select className="border rounded-md px-2 py-1 text-sm bg-white"><option>Системный файл конфигурации</option></select>
        <div className="text-sm text-slate-500">Общие настройки</div>
        <select className="border rounded-md px-2 py-1 text-sm bg-white"><option>Выберите...</option></select>
        <button onClick={proceed} className="ml-auto px-3 py-1.5 rounded-md bg-violet-600 text-white">Далее →</button>
        <button onClick={()=>{setRows(INITIAL);setSelectAll(false);}} title="Сбросить правки" className="px-3 py-1.5 rounded-md border">🧹</button>
      </div>

      <div className="overflow-auto border rounded-lg">
        <table className="min-w-full bg-white">
          <thead><tr className="bg-slate-50">
            <th className={th}><input type="checkbox" checked={selectAll} onChange={()=>setSelectAll(!selectAll)}/></th>
            <th className={th}><div>ID</div><input value={qId} onChange={e=>setQId(e.target.value)} placeholder="Поиск" className="mt-1 w-24 border rounded px-2 py-1 text-xs"/></th>
            <th className={th}><div>Название</div><input value={qTitle} onChange={e=>setQTitle(e.target.value)} placeholder="Поиск" className="mt-1 w-40 border rounded px-2 py-1 text-xs"/></th>
            <th className={th}>Поставщик</th><th className={th}>Mediascope</th><th className={th}>IVT</th><th className={th}>Видимость</th><th className={th}>Тип кода</th><th className={th}>Баннеры</th><th className={th}>Статус</th><th className={th}>Действия</th>
          </tr></thead>
          <tbody>
            {filtered.map(r=>{const i=rows.findIndex(x=>x.id===r.id); return (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className={td}><input type="checkbox" checked={selectAll} readOnly/></td>
                <td className={td}>{r.id}</td>
                <td className={td}><div className="flex items-center gap-2"><button onClick={()=>detect(i)} className="text-xs px-2 py-0.5 border rounded">авто</button><span>{r.title}</span></div></td>
                <td className={td}>
                  <select value={r.supplier||''} onChange={e=>{const v=e.target.value as SupplierKey|''; setRows(p=>{const c=[...p]; c[i]={...c[i],supplier:v}; return c;}); markDirty(i);}} className="border rounded px-2 py-1 bg-white">
                    <option value="">—</option>
                    {(Object.keys(SUPPLIER_LABEL) as SupplierKey[]).map(k=><option key={k} value={k}>{SUPPLIER_LABEL[k]}</option>)}
                  </select>
                </td>
                <td className={td}><input type="checkbox" checked={!!r.med} onChange={e=>{setRows(p=>{const c=[...p]; c[i]={...c[i],med:e.target.checked}; return c;}); markDirty(i);}}/></td>
                <td className={td}><input type="checkbox" checked={!!r.ivt} onChange={e=>{setRows(p=>{const c=[...p]; c[i]={...c[i],ivt:e.target.checked}; return c;}); markDirty(i);}}/></td>
                <td className={td}><input type="checkbox" checked={!!r.view} onChange={e=>{setRows(p=>{const c=[...p]; c[i]={...c[i],view:e.target.checked}; return c;}); markDirty(i);}}/></td>
                <td className={td}>
                  <select value={r.codeType||''} onChange={e=>{setRows(p=>{const c=[...p]; c[i]={...c[i],codeType:e.target.value}; return c;}); markDirty(i);}} className="border rounded px-2 py-1 bg-white min-w-72">
                    <option value="">Выбрать</option>
                    {CODE_TYPES.map(ct=> <option key={ct} value={ct}>{ct}</option>)}
                  </select>
                </td>
                <td className={td}>{r.banners}</td>
                <td className={td}><StatusIcon status={r.status}/></td>
                <td className={td}><div className="flex gap-2"><button onClick={()=>applyRow(i)} className="px-2 py-1 border rounded">Применить</button><button onClick={()=>suggestRow(i)} className="px-2 py-1 border rounded">Получить подсказку</button></div></td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {modalWarn && (<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-20">
        <div className="bg-white rounded-lg shadow p-6 w-[520px]">
          <div className="text-lg font-semibold mb-2">Есть незаполненные строки</div>
          <p className="text-sm text-slate-600 mb-4">Можно продолжить (с рисками) или вернуться и исправить.</p>
          <div className="flex gap-2 justify-end">
            <button onClick={()=>setModalWarn(null)} className="px-3 py-1.5 border rounded">Вернуться</button>
            <a href={`${base}/codes`} className="px-3 py-1.5 rounded bg-violet-600 text-white">Продолжить</a>
          </div>
        </div>
      </div>)}
    </div>
  );
}
