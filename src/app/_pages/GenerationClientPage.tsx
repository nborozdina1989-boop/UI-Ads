'use client';
import styles from "../generation/adriver.module.css";
import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, Download, RotateCcw, Upload } from "lucide-react";
import { getMediaplan, type MediaplanRecord, type PlacementRow } from "@/lib/mediaplan";

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

/** Локальные UI-кусочки */
function Tabs() {
  const base='/generation';
  const cls="px-3 py-1.5 rounded-md border text-sm";
  return (
    <div className={styles.tabs}>
      <a href={base} className={`${cls} ${styles.tab} ${styles.tabActive}`}>Генерация</a>
      <a href={`${base}/codes`} className={`${cls} ${styles.tab}`}>Коды</a>
    </div>
  );
}
function StatusIcon({status}:{status:'ok'|'warn'|'dirty'}){
  if(status==='ok') return <span title="ОК"><CheckCircle2 className="h-4 w-4 text-emerald-600" /></span>;
  if(status==='dirty') return <span title="Есть неприменённые правки"><Circle className="h-4 w-4 fill-[color:var(--adr-blue)] text-[color:var(--adr-blue)]" /></span>;
  return <span title="Не найдено"><AlertTriangle className="h-4 w-4 text-amber-600" /></span>;
}
function ColumnsMenu({vis,setVis}:{vis:VisibleCols,setVis:(v:VisibleCols)=>void}){
  const toggle=(k:keyof VisibleCols)=>setVis({...vis,[k]:!vis[k]});
  return (
    <details className="relative">
      <summary className="px-3 py-1.5 border rounded-md bg-white cursor-pointer select-none">Колонки ＋</summary>
      <div className="absolute z-10 mt-2 w-72 bg-white border rounded-md shadow p-3 grid gap-2">
        <label className="flex gap-2"><input type="checkbox" checked={vis.supplier} onChange={()=>toggle('supplier')}/> Поставщик</label>
        <label className="flex gap-2"><input type="checkbox" checked={vis.med} onChange={()=>toggle('med')}/> Внешний аудитор (Mediascope)</label>
        <label className="flex gap-2"><input type="checkbox" checked={vis.ivt} onChange={()=>toggle('ivt')}/> IVT</label>
        <label className="flex gap-2"><input type="checkbox" checked={vis.view} onChange={()=>toggle('view')}/> Видимость</label>
        <label className="flex gap-2"><input type="checkbox" checked={vis.codeType} onChange={()=>toggle('codeType')}/> Тип кода</label>
        <label className="flex gap-2"><input type="checkbox" checked={vis.banners} onChange={()=>toggle('banners')}/> Баннеры</label>
      </div>
    </details>
  );
}

/** Данные */
type RowStatus='ok'|'warn'|'dirty';
type Row={ id:number; sourceIndex:number; title:string; banners:number; supplier?:SupplierKey|''; med?:boolean; ivt?:boolean; view?:boolean; codeType?:string; status:RowStatus; pendingChanges?:boolean; };
const INITIAL: Row[] = [
  { id:4471765, sourceIndex:0, title:'Yandex', banners:1, supplier:'yandex', med:false, ivt:false, view:false, codeType:'', status:'ok' },
  { id:4471766, sourceIndex:1, title:'IVI',    banners:1, supplier:'',        med:false, ivt:false, view:false, codeType:'', status:'warn' },
  { id:4471767, sourceIndex:2, title:'Hyper',  banners:1, supplier:'',        med:false, ivt:false, view:false, codeType:'', status:'warn' },
];
type VisibleCols = { supplier:boolean; med:boolean; ivt:boolean; view:boolean; codeType:boolean; banners:boolean; };
const DEFAULT_VIS:VisibleCols={ supplier:true,med:true,ivt:true,view:true,codeType:true,banners:true };

const K_GENERATION_ROWS_TMP = 'generation_rows_tmp';
const K_GENERATION_VIS = 'generation_vis';
const K_GENERATION_QID = 'generation_qId';
const K_GENERATION_QTITLE = 'generation_qTitle';
const K_GENERATION_ROWS = 'generation_rows';
const K_GENERATION_CONTEXT_MP = 'generation_context_mp';
const LEGACY_GENERATION_ROWS_TMP = 'autogen_rows_tmp';
const LEGACY_GENERATION_VIS = 'autogen_vis';
const LEGACY_GENERATION_QID = 'autogen_qId';
const LEGACY_GENERATION_QTITLE = 'autogen_qTitle';

/** sessionStorage helpers */
const ssGet = <T,>(keys:string|string[], fallback:T):T => {
  try {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const key of list) {
      const value = sessionStorage.getItem(key);
      if (value) return JSON.parse(value);
    }
    return fallback;
  } catch {
    return fallback;
  }
};
const ssSet = (key:string, v:unknown) => { try { sessionStorage.setItem(key, JSON.stringify(v)); } catch {} };

function detectSupplier(value: string | undefined): SupplierKey | '' {
  const normalized = String(value || '').toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('янд') || normalized.includes('yandex')) return 'yandex';
  if (normalized.includes('ivi')) return 'ivi';
  if (normalized.includes('ozon')) return 'ozon';
  if (normalized.includes('hyper')) return 'hyper';
  if (normalized.includes('vk')) return 'vk';
  if (normalized.includes('rambler')) return 'rambler';
  if (normalized.includes('гпм') || normalized.includes('gpmd')) return 'gpmd';
  return '';
}

function buildGenerationRowsFromMediaplan(item: MediaplanRecord): Row[] {
  const generated = new Set(item.generatedPositionIndexes || []);
  const importRows = item.import?.rows || [];
  if (importRows.length) {
    return importRows
      .map((row: PlacementRow, index) => {
        const ivt = row.measurement_type === 'ivt' || row.measurement_type === 'full_verification';
        const view = row.measurement_type === 'audit_viewability' || row.measurement_type === 'full_verification';
        const supplier = detectSupplier(row.supplier);
        const codeType = row.code_type || '';
        return {
          id: index + 1,
          sourceIndex: index,
          title: row.platform_name || row.banner_name || `Позиция ${index + 1}`,
          banners: row.banner_name ? 1 : 1,
          supplier,
          med: Boolean(row.auditor_mediascope),
          ivt,
          view,
          codeType,
          status: supplier && codeType ? 'ok' : 'warn',
        };
      })
      .filter((row) => !generated.has(row.sourceIndex));
  }

  return (item.scenarioNames || [])
    .map((scenario, index) => ({
      id: index + 1,
      sourceIndex: index,
      title: scenario,
      banners: 1,
      supplier: '',
      med: false,
      ivt: false,
      view: false,
      codeType: '',
      status: 'warn' as const,
    }))
    .filter((row) => !generated.has(row.sourceIndex));
}

/** Страница */
export default function GenerationPage(){
  const searchParams = useSearchParams();
  const mediaplanId = searchParams.get('mp') || '';
  const [rows,setRows]=useState<Row[]>(()=>ssGet([K_GENERATION_ROWS_TMP, LEGACY_GENERATION_ROWS_TMP], INITIAL));
  const [vis,setVis]=useState<VisibleCols>(()=>ssGet([K_GENERATION_VIS, LEGACY_GENERATION_VIS], DEFAULT_VIS));
  const [qId,setQId]=useState(()=>ssGet([K_GENERATION_QID, LEGACY_GENERATION_QID],''));
  const [qTitle,setQTitle]=useState(()=>ssGet([K_GENERATION_QTITLE, LEGACY_GENERATION_QTITLE],''));
  const [selectAll,setSelectAll]=useState(false);
  const [modalWarn,setModalWarn]=useState<null|{warn:number}>(null);
  const [bulk,setBulk]=useState({ivt:false, view:false, med:false});
  const [activeMediaplanTitle, setActiveMediaplanTitle] = useState('');
  const [sourceRows, setSourceRows] = useState<Row[] | null>(null);

  useEffect(()=>ssSet(K_GENERATION_QID, qId),[qId]);
  useEffect(()=>ssSet(K_GENERATION_QTITLE, qTitle),[qTitle]);
  useEffect(()=>ssSet(K_GENERATION_VIS, vis),[vis]);
  useEffect(()=>ssSet(K_GENERATION_ROWS_TMP, rows),[rows]);

  useEffect(() => {
    if (!mediaplanId) return;
    const mediaplan = getMediaplan(mediaplanId);
    if (!mediaplan) return;
    const nextRows = buildGenerationRowsFromMediaplan(mediaplan);
    setRows(nextRows);
    setSourceRows(nextRows);
    setQId('');
    setQTitle('');
    setActiveMediaplanTitle(mediaplan.title);
    try {
      sessionStorage.setItem(K_GENERATION_CONTEXT_MP, mediaplanId);
      sessionStorage.setItem(K_GENERATION_ROWS_TMP, JSON.stringify(nextRows));
    } catch {}
  }, [mediaplanId]);

  const filtered=useMemo(()=>rows.filter(r=>{
    const okId=qId.trim()===''||String(r.id).includes(qId.trim());
    const okT=qTitle.trim()===''||r.title.toLowerCase().includes(qTitle.trim().toLowerCase());
    return okId&&okT;
  }),[rows,qId,qTitle]);

  function markDirty(i:number){
    setRows(p=>{const c=[...p]; c[i]={...c[i],status:c[i].status==='ok'?'dirty':c[i].status,pendingChanges:true}; return c;});
  }
  function suggestAll(){
    setRows(prev=>prev.map(r=>({
      ...r,
      codeType: CODE_TYPES[Math.floor(Math.random()*CODE_TYPES.length)],
      status: 'ok',
      pendingChanges:false
    })));
  }
  function resetAll(){ setRows(sourceRows || INITIAL); setSelectAll(false); }
  function applyBulk(){
    setRows(prev=> prev.map(r=> selectAll ? {...r, ivt:bulk.ivt, view:bulk.view, med:bulk.med} : r));
  }
  function statusHelp(r: Row){
    const reasons:string[]=[];
    if(!r.supplier) reasons.push('Поставщик не выбран');
    if(!r.codeType) reasons.push('Тип кода не выбран');
    if(r.pendingChanges) reasons.push('Есть неприменённые правки');
    return reasons.length? reasons.join(' · '): 'ОК';
  }
  function proceed(){
    const warn=rows.filter(r=>r.status!=='ok').length;
    if(warn){ setModalWarn({warn}); return; }
    try{ sessionStorage.setItem(K_GENERATION_ROWS, JSON.stringify(rows)); }catch{}
    window.location.href=mediaplanId ? `/generation/codes?mp=${mediaplanId}` : '/generation/codes';
  }

  const th="px-3 py-2 text-xs uppercase text-slate-500"; const td="px-3 py-2 text-sm border-t";

  return (
    <div className={`${styles.theme} p-6 space-y-4`}>
      <div className="flex items-center justify-between">
        <Tabs/>
        <div className="flex items-center gap-2">
          <button disabled className={`${styles.btn} ${styles.btnGhost}`}>
            <Upload className="h-4 w-4" />
            <span>Загрузить Excel</span>
          </button>
          <button disabled className={`${styles.btn} ${styles.btnGhost}`}>
            <Download className="h-4 w-4" />
            <span>Скачать шаблон</span>
          </button>
          <ColumnsMenu vis={vis} setVis={setVis}/>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-sm text-slate-500">Файл конфигурации</div>
        <select className="border rounded-md px-2 py-1 text-sm bg-white"><option>Системный файл конфигурации</option></select>
        <div className="text-sm text-slate-500">Общие настройки</div>
        <select className="border rounded-md px-2 py-1 text-sm bg-white"><option>Выберите...</option></select>
        <button onClick={suggestAll} className={`${styles.btn} ${styles.btnGhost}`}>Получить подсказку</button>
        <button onClick={proceed} className={`ml-auto ${styles.btn} ${styles.btnPrimary}`}>
          <span>Далее</span>
          <ArrowRight className="h-4 w-4" />
        </button>
        <button onClick={resetAll} title="Сбросить" className={`${styles.btn} ${styles.btnGhost}`}>
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {mediaplanId && activeMediaplanTitle && (
        <div className={`${styles.alert}`}>
          <div className="font-medium text-slate-900">Генерация кодов для медиаплана «{activeMediaplanTitle}»</div>
          <div className="text-sm text-slate-600">В генерацию подставлены только позиции без кодов из текущего медиаплана. Если вы несколько раз дозагружали позиции и ещё не выпускали для них коды, здесь будет весь актуальный список без созданных кодов.</div>
        </div>
      )}

      {mediaplanId && activeMediaplanTitle && rows.length === 0 && (
        <div className={`${styles.alert}`}>
          <div className="font-medium text-slate-900">Для этого медиаплана нет позиций без кодов</div>
          <div className="text-sm text-slate-600">Все текущие позиции уже помечены как позиции с созданными кодами.</div>
        </div>
      )}

      <div className="flex items-center gap-4 my-2">
        <label className='flex items-center gap-2'><input type='checkbox' checked={bulk.med} onChange={e=>setBulk({...bulk, med:e.target.checked})}/> Mediascope</label>
        <label className='flex items-center gap-2'><input type='checkbox' checked={bulk.ivt} onChange={e=>setBulk({...bulk, ivt:e.target.checked})}/> IVT</label>
        <label className='flex items-center gap-2'><input type='checkbox' checked={bulk.view} onChange={e=>setBulk({...bulk, view:e.target.checked})}/> Видимость</label>
        <button onClick={applyBulk} className={`${styles.btn} ${styles.btnGhost}`}>Применить к выбранным (по отмеченным)</button>
      </div>

      <div className={` border rounded-lg`}>
        <table className={`min-w-full bg-white `}>
          <thead>
            <tr className="bg-slate-50">
              <th className={th}><input type="checkbox" checked={selectAll} onChange={()=>setSelectAll(!selectAll)} /></th>
              <th className={th}>
                <div>ID</div>
                <input value={qId} onChange={e=>setQId(e.target.value)} placeholder="Поиск" className="mt-1 w-24 border rounded px-2 py-1 text-xs"/>
              </th>
              <th className={th}>Статус</th>
              <th className={th}>
                <div>Название</div>
                <input value={qTitle} onChange={e=>setQTitle(e.target.value)} placeholder="Поиск" className="mt-1 w-40 border rounded px-2 py-1 text-xs"/>
              </th>
              {vis.supplier && <th className={th}>Поставщик</th>}
              {vis.med && <th className={th}>Внешний аудитор<br/>Mediascope</th>}
              {vis.ivt && <th className={th}>Метрики<br/>IVT</th>}
              {vis.view && <th className={th}>Метрики<br/>Видимость</th>}
              {vis.codeType && <th className={th}>Тип кода</th>}
              {vis.banners && <th className={th}>Баннеры</th>}
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
                      className={` border rounded px-2 py-1 bg-white`}
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
              <button onClick={()=>setModalWarn(null)} className={`${styles.btn} ${styles.btnGhost}`}>Вернуться</button>
              <a href={mediaplanId ? `/generation/codes?mp=${mediaplanId}` : "/generation/codes"} className={`${styles.btn} ${styles.btnPrimary}`}>Продолжить</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
