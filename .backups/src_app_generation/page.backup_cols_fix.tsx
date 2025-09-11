'use client';
import styles from "./adriver.module.css";
import { useMemo, useState, useEffect } from 'react';

// sessionStorage helpers
const ssGet = <T,>(k:string, fallback:T):T => { try { const v=sessionStorage.getItem(k); return v? JSON.parse(v):fallback; } catch { return fallback; } };
const ssSet = (k:string, v:any) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} };

/** Локальные константы — без импортов, чтобы ничего вне generation не трогать */
const CODE_TYPES = [
  'Кликовый','Аудит','Аудит с проверкой IVT','Аудит с проверкой IVT, видимости',
  'Партнерская видимость (VK) Медиа с проверкой IVT','Аудит с проверкой видимости',
  'Счётчик VAST','Счётчик VAST с проверкой IVT',
  'Партнерская видимость (VK) Видео с проверкой IVT',
  'Аудит видео с проверкой IVT, видимости',
  'Аудит видео с проверкой IVT, видимости (интегрированный)',
  'Mraid с проверкой IVT, видимости','Mraid видео с проверкой IVT, видимости',
  'Аудит видео','Аудит видео с проверкой IVT','Аудит видео с проверкой видимости',
  'Сторонний аудит','Аудит ABF'
] as const;

type SupplierKey = 'yandex'|'ivi'|'ozon'|'hyper'|'vk'|'rambler'|'gpmd';
const SUPPLIER_LABEL: Record<SupplierKey,string> = {
  yandex:'Yandex', ivi:'IVI', ozon:'Ozon', hyper:'Hyper', vk:'VK', rambler:'Rambler', gpmd:'ГПМД'
};
const SUPPLIER_SYNONYMS: Record<SupplierKey,string[]> = {
  yandex:['yandex','яндекс','yandex video','videonet','yndx','yandexdisplay'],
  ivi:['ivi','иви','ivi.ru'],
  ozon:['ozon','озон'],
  hyper:['hyper','хайпер','гипер','hyperadx','hyper adx'],
  vk:['vk','vkontakte','вк','mytarget','вконтакте'],
  rambler:['rambler','рамблер'],
  gpmd:['гпмд','gpm','gazprom media','gpm digital']
};
function inferSupplierByTitle(title:string){
  const t=(title||'').toLowerCase();
  const hits = (Object.keys(SUPPLIER_SYNONYMS) as SupplierKey[])
    .filter(k => SUPPLIER_SYNONYMS[k].some(s=>t.includes(s)));
  if (hits.length===1) return {kind:'single', key:hits[0] as SupplierKey} as const;
  if (hits.length>1)   return {kind:'multiple', keys:Array.from(new Set(hits)) as SupplierKey[]} as const;
  return {kind:'none'} as const;
}

/** Локальные UI-кусочки */
function Tabs() {
  const base='/generation';
  const cls="px-3 py-1.5 rounded-md border text-sm";
  return (
    <div className="flex gap-2">
      <a href={base} className={`${cls} bg-slate-900 text-white`}>Генерация</a>
      <a href={`${base}/codes`} className={`${cls} bg-white`}>Коды</a>
    </div>
  );
}
function StatusIcon({status}:{status:'ok'|'warn'|'dirty'}){
  if(status==='ok') return <span title="ОК" className="text-green-600">✔︎</span>;
  if(status==='dirty') return <span title="Есть неприменённые правки" className="text-purple-600">●</span>;
  return <span title="Не найдено" className="text-amber-500">⚠️</span>;
}
function ColumnsMenu({vis,setVis}:{vis:VisibleCols,setVis:(v:VisibleCols)=>void}){
  const toggle=(k:keyof VisibleCols)=>setVis({...vis,[k]:!vis[k]});
  return (
    <details className="relative">
      <summary className="px-3 py-1.5 border rounded-md bg-white cursor-pointer select-none">Колонки ＋</summary>
      <div className="absolute z-10 mt-2 w-72 bg-white border rounded-md shadow p-3 grid gap-2">
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

/** Данные */
type RowStatus='ok'|'warn'|'dirty';
type Row={ id:number; title:string; banners:number; supplier?:SupplierKey|''; med?:boolean; ivt?:boolean; view?:boolean; codeType?:string; status:RowStatus; pendingChanges?:boolean; };
const INITIAL: Row[] = [
  { id:4471765, title:'Yandex', banners:1, supplier:'yandex', med:false, ivt:false, view:false, codeType:'', status:'ok' },
  { id:4471766, title:'IVI',    banners:1, supplier:'',        med:false, ivt:false, view:false, codeType:'', status:'warn' },
  { id:4471767, title:'Hyper',  banners:1, supplier:'',        med:false, ivt:false, view:false, codeType:'', status:'warn' },
];
type VisibleCols = { supplier:boolean; med:boolean; ivt:boolean; view:boolean; codeType:boolean; banners:boolean; auditorUrl:boolean; redirect:boolean; externalIdMacro:boolean; gaidIdfa:boolean; bundleId:boolean; exss:boolean; vastVersion:boolean; };
const DEFAULT_VIS:VisibleCols={ supplier:true,med:true,ivt:true,view:true,codeType:true,banners:true, auditorUrl:false,redirect:false,externalIdMacro:false,gaidIdfa:false,bundleId:false,exss:false,vastVersion:false };

/** Страница */
export default function GenerationPage(){
  const [rows,setRows]=useState<Row[]>(()=>ssGet('autogen_rows_tmp', INITIAL));
  const [vis,setVis]=useState<VisibleCols>(()=>ssGet('autogen_vis', DEFAULT_VIS));
  const [qId,setQId]=useState(()=>ssGet('autogen_qId','')); const [qTitle,setQTitle]=useState(()=>ssGet('autogen_qTitle',''));
  const [selectAll,setSelectAll]=useState(false);
  const [bulk,setBulk]=useState({ivt:false, view:false, med:false});
function applyBulk(){ setRows(prev=> prev.map(r=> selectAll ? {...r, ivt:bulk.ivt, view:bulk.view, med:bulk.med} : r)); }

  useEffect(()=>ssSet('autogen_qId', qId),[qId]);
useEffect(()=>ssSet('autogen_qTitle', qTitle),[qTitle]);
useEffect(()=>ssSet('autogen_vis', vis),[vis]);
useEffect(()=>ssSet('autogen_rows_tmp', rows),[rows]);

()=>rows.filter(r=>{
    const okId=qId.trim()===''||String(r.id).includes(qId.trim());
    const okT=qTitle.trim()===''||r.title.toLowerCase().includes(qTitle.trim().toLowerCase());
    return okId&&okT;
  }),[rows,qId,qTitle]);

  function markDirty(i:number){ setRows(p=>{const c=[...p]; c[i]={...c[i],status:c[i].status==='ok'?'dirty':c[i].status,pendingChanges:true}; return c;}); }
  function applyRow(i:number){ setRows(p=>{const c=[...p]; const r=c[i]; c[i]={...r,status:r.supplier?'ok':'warn',pendingChanges:false}; return c;}); }
  function suggestRow(i:number){ const rand=CODE_TYPES[Math.floor(Math.random()*CODE_TYPES.length)];
    setRows(p=>{const c=[...p]; const r=c[i]; c[i]={...r,codeType:rand,status:'ok',pendingChanges:false}; return c;}); }
  function detect(i:number){ setRows(p=>{const c=[...p]; const r=c[i]; const d=inferSupplierByTitle(r.title); c[i]=d.kind==='single'?{...r,supplier:d.key,status:'ok'}:{...r,supplier:'',status:'warn'}; return c;}); }
  function suggestAll(){ setRows(prev=>prev.map(r=>({...r, codeType: CODE_TYPES[Math.floor(Math.random()*CODE_TYPES.length)], status:"ok", pendingChanges:false}))); }
  function resetAll(){ setRows(INITIAL); setSelectAll(false); }
  function proceed(){
    const warn=rows.filter(r=>r.status!=='ok').length;
    if(warn){ setModalWarn({warn}); return; }
    try{ sessionStorage.setItem('autogen_rows', JSON.stringify(rows)); }catch{}
    window.location.href='/generation/codes';
  }

  const th="px-3 py-2 text-xs uppercase text-slate-500"; const td="px-3 py-2 text-sm border-t";

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Tabs/>
        <div className="flex items-center gap-2">
          <button disabled className="px-3 py-1.5 rounded-md border bg-slate-100 text-slate-400">Загрузить Excel ⤴︎</button>
          <button disabled className="px-3 py-1.5 rounded-md border bg-slate-100 text-slate-400">Скачать шаблон ⤓</button>
          <ColumnsMenu vis={vis} setVis={setVis}/>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-sm text-slate-500">Файл конфигурации</div>
        <select className="border rounded-md px-2 py-1 text-sm bg-white"><option>Системный файл конфигурации</option></select>
        <div className="text-sm text-slate-500">Общие настройки</div>
        <select className="border rounded-md px-2 py-1 text-sm bg-white"><option>Выберите...</option></select> <button onClick={suggestAll} className={styles.btn + " " + styles.btnGhost}>Получить подсказку</button>
        <button onClick={proceed} className={"ml-auto " + styles.btn + " " + styles.btnPrimary}>Далее →</button>
        <button onClick={resetAll} title="Сбросить правки" className="px-3 py-1.5 rounded-md border">🧹</button>
      </div>

      <div className="flex items-center gap-4 my-2">
  <label className='flex items-center gap-2'><input type='checkbox' checked={bulk.med} onChange={e=>setBulk({...bulk, med:e.target.checked})}/> Mediascope</label>
  <label className='flex items-center gap-2'><input type='checkbox' checked={bulk.ivt} onChange={e=>setBulk({...bulk, ivt:e.target.checked})}/> IVT</label>
  <label className='flex items-center gap-2'><input type='checkbox' checked={bulk.view} onChange={e=>setBulk({...bulk, view:e.target.checked})}/> Видимость</label>
  <button onClick={applyBulk} className={styles.btn + ' ' + styles.btnGhost}>Применить к выбранным (по отмеченным)</button>
</div>


        <table className="min-w-full bg-white">
          <thead>
            <tr className="bg-slate-50">
              <th className={th}><input type="checkbox" checked={selectAll} onChange={()=>setSelectAll(!selectAll)} /></th>
              <th className={th}>
                <div>ID</div><input value={qId} onChange={e=>setQId(e.target.value)} placeholder="Поиск" className="mt-1 w-24 border rounded px-2 py-1 text-xs"/>
              </th>
              <th className={th}>Статус</th>
<th className={th}>
                <div>Название</div><input value={qTitle} onChange={e=>setQTitle(e.target.value)} placeholder="Поиск" className="mt-1 w-40 border rounded px-2 py-1 text-xs"/>
              </th>
              {vis.supplier && <th className={th}>Поставщик</th>}
              {vis.med && <th className={th}>Внешний аудитор<br/>Mediascope</th>}
              {vis.ivt && <th className={th}>Метрики<br/>IVT</th>}
              {vis.view && <th className={th}>Метрики<br/>Видимость</th>}
              {vis.codeType && <th className={th}>Тип кода</th>}
              {vis.banners && <th className={th}>Баннеры</th>}
              {vis.auditorUrl && <th className={th}>URL аудитора</th>}
              {vis.redirect && <th className={th}>Редирект</th>}
              {vis.externalIdMacro && <th className={th}>Макрос внешнего ID</th>}
              {vis.gaidIdfa && <th className={th}>Макрос gaid/idfa</th>}
              {vis.bundleId && <th className={th}>Макрос Bundle ID</th>}
              {vis.exss && <th className={th}>Макрос exss</th>}
              {vis.vastVersion && <th className={th}>VAST версия</th>}
              
            </tr>
          </thead>
          <tbody>
            {filtered.map(r=>{
              const i=rows.findIndex(x=>x.id===r.id);
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className={td}><input type="checkbox" checked={selectAll} readOnly/></td>
                  <td className={td}>{r.id}</td>
                  <td className={td}><span title={statusHelp(r)}><StatusIcon status={r.status}/></span></td>
<td className={td}><span>{r.title}</span></td>
                  {vis.supplier && (
                    <td className={td}>
                      <select
                        value={r.supplier||''}
                        onChange={e=>{ const v=e.target.value as SupplierKey|''; setRows(p=>{const c=[...p]; c[i]={...c[i],supplier:v}; return c;}); markDirty(i); }}
                        className="border rounded px-2 py-1 bg-white"
                      >
                        <option value="">—</option>
                        {(Object.keys(SUPPLIER_LABEL) as SupplierKey[]).map(k=>(
                          <option key={k} value={k}>{SUPPLIER_LABEL[k]}</option>
                        ))}
                      </select>
                    </td>
                  )}
                  {vis.med && <td className={td}><input type="checkbox" checked={!!r.med} onChange={e=>{ setRows(p=>{const c=[...p]; c[i]={...c[i],med:e.target.checked}; return c;}); markDirty(i); }}/></td>}
                  {vis.ivt && <td className={td}><input type="checkbox" checked={!!r.ivt} onChange={e=>{ setRows(p=>{const c=[...p]; c[i]={...c[i],ivt:e.target.checked}; return c;}); markDirty(i); }}/></td>}
                  {vis.view && <td className={td}><input type="checkbox" checked={!!r.view} onChange={e=>{ setRows(p=>{const c=[...p]; c[i]={...c[i],view:e.target.checked}; return c;}); markDirty(i); }}/></td>}
                  {vis.codeType && <td className={td}>
                    <select
                      value={r.codeType||''}
                      onChange={e=>{ setRows(p=>{const c=[...p]; c[i]={...c[i],codeType:e.target.value}; return c;}); markDirty(i); }}
                      className="border rounded px-2 py-1 bg-white min-w-72"
                    >
                      <option value="">Выбрать</option>
                      {CODE_TYPES.map(ct=> <option key={ct} value={ct}>{ct}</option>)}
                    </select>
                  </td>}
                  {vis.banners && <td className={td}>{r.banners}</td>}
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
              Вы можете продолжить (с рисками) или вернуться и исправить.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setModalWarn(null)} className="px-3 py-1.5 border rounded">Вернуться</button>
              <a href="/generation/codes" className="px-3 py-1.5 rounded bg-violet-600 text-white">Продолжить</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
