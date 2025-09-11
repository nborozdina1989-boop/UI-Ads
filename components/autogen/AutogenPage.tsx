'use client';
import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import TabsAutogen from '@/components/autogen/TabsAutogen';
import { StatusIcon } from '@/components/autogen/StatusIcon';
import { CODE_TYPES } from '@/lib/codeTypes';
import { inferSupplierByTitle, SUPPLIER_LABEL, SupplierKey } from '@/lib/suppliers';

type RowStatus = 'ok'|'warn'|'dirty';
type Row = {
  id: number; title: string; banners: number;
  supplier?: SupplierKey | '';
  med?: boolean; ivt?: boolean; view?: boolean;
  codeType?: string;
  auditorUrl?: string; redirect?: string; externalIdMacro?: string;
  gaidIdfa?: string; bundleId?: string; exss?: string; vastVersion?: string;
  status: RowStatus; pendingChanges?: boolean;
};

const INITIAL: Row[] = [
  { id: 4471765, title: 'Yandex', banners: 1, supplier: 'yandex', med:false, ivt:false, view:false, codeType:'', status:'ok' },
  { id: 4471766, title: 'IVI',    banners: 1, supplier: '',        med:false, ivt:false, view:false, codeType:'', status:'warn' },
  { id: 4471767, title: 'Hyper',  banners: 1, supplier: '',        med:false, ivt:false, view:false, codeType:'', status:'warn' },
];

type VisibleCols = {
  supplier: boolean; med: boolean; ivt: boolean; view: boolean; codeType: boolean; banners: boolean;
  auditorUrl: boolean; redirect: boolean; externalIdMacro: boolean; gaidIdfa: boolean; bundleId: boolean; exss: boolean; vastVersion: boolean;
};
const DEFAULT_VIS: VisibleCols = {
  supplier: true, med: true, ivt: true, view: true, codeType: true, banners: true,
  auditorUrl: false, redirect: false, externalIdMacro: false, gaidIdfa: false, bundleId: false, exss: false, vastVersion: false
};

function ColumnsMenu({vis,setVis}:{vis:VisibleCols,setVis:(v:VisibleCols)=>void}) {
  const toggle=(k:keyof VisibleCols)=> setVis({...vis,[k]:!vis[k]});
  return (
    <details className="relative">
      <summary className="px-3 py-1.5 border rounded-md bg-white cursor-pointer select-none">Колонки ＋</summary>
      <div className="absolute z-10 mt-2 w-72 bg-white border rounded-md shadow p-3 grid grid-cols-1 gap-2">
        <label className="flex gap-2"><input type="checkbox" checked={vis.auditorUrl} onChange={()=>toggle('auditorUrl')}/> URL аудитора</label>
        <label className="flex gap-2"><input type="checkbox" checked={vis.redirect} onChange={()=>toggle('redirect')}/> Редирект</label>
        <label className="flex gap-2"><input type="checkbox" checked={vis.externalIdMacro} onChange={()=>toggle('externalIdMacro')}/> Макрос внешнего ID</label>
        <label className="flex gap-2"><input type="checkbox" checked={vis.gaidIdfa} onChange={()=>toggle('gaidIdfa')}/> Макрос gaid/idfa</label>
        <label className="flex gap-2"><input type="checkbox" checked={vis.bundleId} onChange={()=>toggle('bundleId')}/> Макрос Bundle ID</label>
        <label className="flex gap-2"><input type="checkbox" checked={vis.exss} onChange={()=>toggle('exss')}/> Макрос exss</label>
        <label className="flex gap-2"><input type="checkbox" checked={vis.vastVersion} onChange={()=>toggle('vastVersion')}/> VAST версия</label>
      </div>
    </details>
  );
}
function DisabledButton({children}:{children:React.ReactNode}) {
  return <button disabled className="px-3 py-1.5 rounded-md border bg-slate-100 text-slate-400 cursor-not-allowed">{children}</button>
}

export default function AutogenPage(){
  const [rows, setRows] = useState<Row[]>(INITIAL);
  const [vis, setVis] = useState<VisibleCols>(DEFAULT_VIS);
  const [qId, setQId] = useState(''); const [qTitle, setQTitle] = useState('');
  const [selectAll, setSelectAll] = useState(false);
  const [modalWarn, setModalWarn] = useState<null | {warn: number}>(null);
  const path = usePathname();
  const base = path.startsWith('/generation') ? '/generation' : '/autogen';

  const filtered = useMemo(()=> rows.filter(r=>{
    const okId = qId.trim()==='' || String(r.id).includes(qId.trim());
    const okT  = qTitle.trim()==='' || r.title.toLowerCase().includes(qTitle.trim().toLowerCase());
    return okId && okT;
  }),[rows,qId,qTitle]);

  function markDirty(idx:number){
    setRows(prev=>{ const c=[...prev]; c[idx] = {...c[idx], status: c[idx].status==='ok'?'dirty':c[idx].status, pendingChanges:true}; return c; });
  }
  function applyRow(idx:number){
    setRows(prev=>{ const c=[...prev]; const r=c[idx];
      c[idx] = {...r, status: r.supplier? 'ok':'warn', pendingChanges:false}; return c; });
  }
  function suggestRow(idx:number){
    const rand = CODE_TYPES[Math.floor(Math.random()*CODE_TYPES.length)];
    setRows(prev=>{ const c=[...prev]; const r=c[idx]; c[idx] = {...r, codeType: rand, status:'ok', pendingChanges:false}; return c; });
  }
  function resetAll(){ setRows(INITIAL); setSelectAll(false); }
  function handleAutoDetect(idx:number){
    setRows(prev=>{ const c=[...prev]; const r=c[idx]; const det = inferSupplierByTitle(r.title);
      c[idx] = det.kind==='single' ? {...r, supplier: det.key, status:'ok'} : {...r, supplier:'', status:'warn'}; return c; });
  }
  function proceed(){
    const warnCount = rows.filter(r=> r.status!=='ok').length;
    if (warnCount>0) { setModalWarn({warn: warnCount}); return; }
    try { sessionStorage.setItem('autogen_rows', JSON.stringify(rows)); } catch {}
    window.location.href = `${base}/codes`;
  }

  const header="px-3 py-2 text-xs uppercase text-slate-500";
  const cell="px-3 py-2 text-sm border-t";

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <TabsAutogen />
        <div className="flex items-center gap-2">
          <DisabledButton>Загрузить Excel ⤴︎</DisabledButton>
          <DisabledButton>Скачать шаблон ⤓</DisabledButton>
          <ColumnsMenu vis={vis} setVis={setVis}/>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-sm text-slate-500">Файл конфигурации</div>
        <select className="border rounded-md px-2 py-1 text-sm bg-white"><option>Системный файл конфигурации</option></select>
        <div className="text-sm text-slate-500">Общие настройки</div>
        <select className="border rounded-md px-2 py-1 text-sm bg-white"><option>Выберите...</option></select>
        <button onClick={proceed} className="ml-auto px-3 py-1.5 rounded-md bg-violet-600 text-white hover:bg-violet-700">Далее →</button>
        <button onClick={resetAll} title="Сбросить правки" className="px-3 py-1.5 rounded-md border">🧹</button>
      </div>

      <div className="overflow-auto border rounded-lg">
        <table className="min-w-full bg-white">
          <thead>
            <tr className="bg-slate-50">
              <th className={header}><input type="checkbox" checked={selectAll} onChange={()=>setSelectAll(!selectAll)} /></th>
              <th className={header}>
                <div>ID</div><input value={qId} onChange={e=>setQId(e.target.value)} placeholder="Поиск" className="mt-1 w-24 border rounded px-2 py-1 text-xs"/>
              </th>
              <th className={header}>
                <div>Название</div><input value={qTitle} onChange={e=>setQTitle(e.target.value)} placeholder="Поиск" className="mt-1 w-40 border rounded px-2 py-1 text-xs"/>
              </th>
              {vis.supplier && <th className={header}>Поставщик</th>}
              {vis.med && <th className={header}>Внешний аудитор<br/>Mediascope</th>}
              {vis.ivt && <th className={header}>Метрики<br/>IVT</th>}
              {vis.view && <th className={header}>Метрики<br/>Видимость</th>}
              {vis.codeType && <th className={header}>Тип кода</th>}
              {vis.banners && <th className={header}>Баннеры</th>}
              {vis.auditorUrl && <th className={header}>URL аудитора</th>}
              {vis.redirect && <th className={header}>Редирект</th>}
              {vis.externalIdMacro && <th className={header}>Макрос внешнего ID</th>}
              {vis.gaidIdfa && <th className={header}>Макрос gaid/idfa</th>}
              {vis.bundleId && <th className={header}>Макрос Bundle ID</th>}
              {vis.exss && <th className={header}>Макрос exss</th>}
              {vis.vastVersion && <th className={header}>VAST версия</th>}
              <th className={header}>Статус</th>
              <th className={header}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r=>{
              const i = rows.findIndex(x=>x.id===r.id);
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className={cell}><input type="checkbox" checked={selectAll} readOnly/></td>
                  <td className={cell}>{r.id}</td>
                  <td className={cell}>
                    <div className="flex items-center gap-2">
                      <button onClick={()=>handleAutoDetect(i)} className="text-xs px-2 py-0.5 border rounded">авто</button>
                      <span>{r.title}</span>
                    </div>
                  </td>
                  {vis.supplier && (
                    <td className={cell}>
                      <select value={r.supplier||''} onChange={e=>{ const v=e.target.value as SupplierKey|''; setRows(p=>{const c=[...p]; c[i]={...c[i], supplier:v}; return c;}); markDirty(i); }} className="border rounded px-2 py-1 bg-white">
                        <option value="">—</option>
                        {(Object.keys(SUPPLIER_LABEL) as SupplierKey[]).map(k=><option key={k} value={k}>{SUPPLIER_LABEL[k]}</option>)}
                      </select>
                    </td>
                  )}
                  {vis.med && <td className={cell}><input type="checkbox" checked={!!r.med} onChange={e=>{ setRows(p=>{const c=[...p]; c[i]={...c[i], med:e.target.checked}; return c;}); markDirty(i); }}/></td>}
                  {vis.ivt && <td className={cell}><input type="checkbox" checked={!!r.ivt} onChange={e=>{ setRows(p=>{const c=[...p]; c[i]={...c[i], ivt:e.target.checked}; return c;}); markDirty(i); }}/></td>}
                  {vis.view && <td className={cell}><input type="checkbox" checked={!!r.view} onChange={e=>{ setRows(p=>{const c=[...p]; c[i]={...c[i], view:e.target.checked}; return c;}); markDirty(i); }}/></td>}
                  {vis.codeType && <td className={cell}>
                    <select value={r.codeType||''} onChange={e=>{ setRows(p=>{const c=[...p]; c[i]={...c[i], codeType:e.target.value}; return c;}); markDirty(i); }} className="border rounded px-2 py-1 bg-white min-w-72">
                      <option value="">Выбрать</option>
                      {CODE_TYPES.map(ct=> <option key={ct} value={ct}>{ct}</option>)}
                    </select>
                  </td>}
                  {vis.banners && <td className={cell}>{r.banners}</td>}
                  {vis.auditorUrl && <td className={cell}><input className="border rounded px-2 py-1 w-44" value={r.auditorUrl||''} onChange={e=>{ setRows(p=>{const c=[...p]; c[i]={...c[i], auditorUrl:e.target.value}; return c;}); markDirty(i); }}/></td>}
                  {vis.redirect && <td className={cell}><input className="border rounded px-2 py-1 w-40" value={r.redirect||''} onChange={e=>{ setRows(p=>{const c=[...p]; c[i]={...c[i], redirect:e.target.value}; return c;}); markDirty(i); }}/></td>}
                  {vis.externalIdMacro && <td className={cell}><input className="border rounded px-2 py-1 w-40" value={r.externalIdMacro||''} onChange={e=>{ setRows(p=>{const c=[...p]; c[i]={...c[i], externalIdMacro:e.target.value}; return c;}); markDirty(i); }}/></td>}
                  {vis.gaidIdfa && <td className={cell}><input className="border rounded px-2 py-1 w-40" value={r.gaidIdfa||''} onChange={e=>{ setRows(p=>{const c=[...p]; c[i]={...c[i], gaidIdfa:e.target.value}; return c;}); markDirty(i); }}/></td>}
                  {vis.bundleId && <td className={cell}><input className="border rounded px-2 py-1 w-40" value={r.bundleId||''} onChange={e=>{ setRows(p=>{const c=[...p]; c[i]={...c[i], bundleId:e.target.value}; return c;}); markDirty(i); }}/></td>}
                  {vis.exss && <td className={cell}><input className="border rounded px-2 py-1 w-40" value={r.exss||''} onChange={e=>{ setRows(p=>{const c=[...p]; c[i]={...c[i], exss:e.target.value}; return c;}); markDirty(i); }}/></td>}
                  {vis.vastVersion && <td className={cell}><input className="border rounded px-2 py-1 w-28" value={r.vastVersion||''} onChange={e=>{ setRows(p=>{const c=[...p]; c[i]={...c[i], vastVersion:e.target.value}; return c;}); markDirty(i); }}/></td>}
                  <td className={cell}><StatusIcon status={r.status}/></td>
                  <td className={cell}>
                    <div className="flex gap-2">
                      <button onClick={()=>applyRow(i)} className="px-2 py-1 border rounded">Применить</button>
                      <button onClick={()=>suggestRow(i)} className="px-2 py-1 border rounded">Получить подсказку</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalWarn && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-20">
          <div className="bg-white rounded-lg shadow p-6 w-[520px]">
            <div className="text-lg font-semibold mb-2">Есть незаполненные строки</div>
            <p className="text-sm text-slate-600 mb-4">
              Найдено {modalWarn.warn} строк со статусом «Не найдено» или «Есть правки».
              Вы можете продолжить (с рисками) или вернуться и исправить.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setModalWarn(null)} className="px-3 py-1.5 border rounded">Вернуться</button>
              <a href={`${base}/codes`} className="px-3 py-1.5 rounded bg-violet-600 text-white">Продолжить</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
