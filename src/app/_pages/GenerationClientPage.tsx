'use client';

import styles from "../generation/adriver.module.css";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, Download, Search, RotateCcw, Upload, X } from "lucide-react";
import { getMediaplan, type MediaplanRecord, type PlacementRow } from "@/lib/mediaplan";
import {
  CODE_TYPES,
  SUPPLIERS,
  SUPPLIER_KEYS,
  codeMatchesMetrics,
  codeSupportsIvt,
  codeSupportsViewability,
  findSupplier,
  isRecommendedCode,
  resolveSupplierFromExcel,
  type SupplierKey,
} from "@/lib/autogenSuppliers";

type RowStatus='ok'|'warn'|'dirty';
type CampaignType = 'Медиа+Видео'|'Медиа'|'Видео';

type Row = {
  id: number;
  sourceIndex: number;
  selected: boolean;
  title: string;
  banners: number;
  supplier: SupplierKey;
  supplierName?: string;
  med?: boolean;
  auditorUrl?: string;
  redirect?: boolean;
  ivt?: boolean;
  view?: boolean;
  codeType?: string;
  targetUrl?: string;
  erir?: string;
  comment?: string;
  macroExss?: string;
  macroExtId?: string;
  macroAdvId?: string;
  macroBundleId?: string;
  vastVersion?: '2.0'|'3.0';
  status: RowStatus;
  pendingChanges?: boolean;
  suggestion?: 'matched'|'other'|'excel';
};

type VisibleCols = {
  supplier:boolean;
  med:boolean;
  auditorUrl:boolean;
  redirect:boolean;
  ivt:boolean;
  view:boolean;
  macroExss:boolean;
  macroExtId:boolean;
  macroAdvId:boolean;
  macroBundleId:boolean;
  vastVersion:boolean;
  codeType:boolean;
  banners:boolean;
};

const DEFAULT_VIS: VisibleCols = {
  supplier:true,
  med:true,
  auditorUrl:true,
  redirect:true,
  ivt:true,
  view:true,
  macroExss:false,
  macroExtId:true,
  macroAdvId:true,
  macroBundleId:true,
  vastVersion:false,
  codeType:true,
  banners:true,
};

const INITIAL: Row[] = [
  { id:4773299, sourceIndex:0, selected:true, title:'yandex', banners:1, supplier:'yandex', codeType:'Аудит', status:'ok', suggestion:'matched' },
  { id:4773300, sourceIndex:1, selected:true, title:'VK', banners:1, supplier:'vk', codeType:'Кликовый', macroExss:'{{impression_id}}', status:'ok', suggestion:'matched' },
  { id:4773301, sourceIndex:2, selected:true, title:'DA_', banners:1, supplier:'other', codeType:'', status:'warn', suggestion:'other' },
  { id:4773302, sourceIndex:3, selected:true, title:'Yabbi', banners:1, supplier:'yabbi', codeType:'', status:'warn', suggestion:'matched' },
  { id:4773303, sourceIndex:4, selected:true, title:'Everest', banners:1, supplier:'everest', codeType:'Аудит', macroExss:'%request.request_session%', status:'ok', suggestion:'matched' },
];

const K_GENERATION_ROWS_TMP = 'generation_rows_tmp';
const K_GENERATION_VIS = 'generation_vis_doc_layout_v2';
const K_GENERATION_QID = 'generation_qId';
const K_GENERATION_QTITLE = 'generation_qTitle';
const K_GENERATION_PREP_ROWS = 'generation_prepare_rows';
const K_GENERATION_CONTEXT_MP = 'generation_context_mp';
const K_GENERATION_COMMON = 'generation_common_settings';
const K_GENERATION_CAMPAIGN_TYPE = 'generation_campaign_type';
const LEGACY_GENERATION_QID = 'autogen_qId';
const LEGACY_GENERATION_QTITLE = 'autogen_qTitle';

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

function StatusIcon({status}:{status:RowStatus}){
  if(status==='ok') return <span title="Все обязательные настройки выбраны"><CheckCircle2 className="h-4 w-4 text-emerald-600" /></span>;
  if(status==='dirty') return <span title="Есть неприменённые правки"><Circle className="h-4 w-4 fill-[color:var(--adr-blue)] text-[color:var(--adr-blue)]" /></span>;
  return <span title="Необходимо заполнить обязательные поля"><AlertTriangle className="h-4 w-4 text-amber-600" /></span>;
}

function ColumnsMenu({vis,setVis}:{vis:VisibleCols,setVis:(v:VisibleCols)=>void}){
  const toggle=(k:keyof VisibleCols)=>setVis({...vis,[k]:!vis[k]});
  const items: [keyof VisibleCols, string][] = [
    ['supplier','Поставщик'],
    ['med','Mediascope'],
    ['auditorUrl','URL аудитора'],
    ['redirect','Редирект'],
    ['ivt','IVT'],
    ['view','Видимость'],
    ['macroExss','Макрос exss'],
    ['macroExtId','Макрос внешнего ID'],
    ['macroAdvId','Макрос gaid/idfa'],
    ['macroBundleId','Макрос Bundle ID'],
    ['vastVersion','VAST версия'],
    ['codeType','Тип кода'],
    ['banners','Баннеры'],
  ];
  return (
    <details className="relative">
      <summary className="px-3 py-1.5 border rounded-md bg-white cursor-pointer select-none">Колонки ＋</summary>
      <div className="absolute right-0 z-10 mt-2 w-80 bg-white border rounded-md shadow p-3 grid gap-2">
        {items.map(([key,label]) => (
          <label key={key} className="flex gap-2"><input type="checkbox" checked={vis[key]} onChange={()=>toggle(key)}/> {label}</label>
        ))}
      </div>
    </details>
  );
}

function CodeTypePicker({ row, onChange }: { row: Row; onChange: (codeType: string) => void }) {
  const [query, setQuery] = useState('');
  const filteredTypes = CODE_TYPES.filter((type) => type.toLowerCase().includes(query.trim().toLowerCase()));
  const label = row.codeType || 'Выбрать';
  return (
    <details className={styles.codePicker}>
      <summary className={styles.codePickerSummary}>
        <span className={row.codeType ? '' : 'text-slate-500'}>{label}</span>
        {row.codeType && (
          isRecommendedCode(row.supplier, row, row.codeType)
            ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            : <AlertTriangle className="h-4 w-4 text-amber-600" />
        )}
      </summary>
      <div className={styles.codePickerMenu}>
        <label className={styles.codeSearch}>
          <Search className="h-4 w-4 text-slate-400" />
          <input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Поиск" />
        </label>
        <div className={styles.codeOptions}>
          <button type="button" onClick={()=>onChange('')} className={styles.codeOption}>
            <Circle className="h-4 w-4 text-slate-300" />
            <span>Не выбрано</span>
          </button>
          {filteredTypes.map((type) => {
            const recommended = isRecommendedCode(row.supplier, row, type);
            const metrics = codeMatchesMetrics(row, type);
            const selected = row.codeType === type;
            return (
              <button key={type} type="button" onClick={()=>onChange(type)} className={`${styles.codeOption} ${selected ? styles.codeOptionActive : ''}`}>
                <Circle className={`h-4 w-4 ${selected ? 'fill-[color:var(--adr-blue)] text-[color:var(--adr-blue)]' : 'text-slate-300'}`} />
                {recommended ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                {!metrics && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                <span>{type}</span>
              </button>
            );
          })}
        </div>
      </div>
    </details>
  );
}

function withSupplierDefaults(row: Row, supplier: SupplierKey, source: Row['suggestion'] = 'matched'): Row {
  const config = SUPPLIERS[supplier];
  const codeType = supplier === 'other' ? row.codeType || '' : row.codeType || config.defaultCode;
  return normalizeRow({
    ...row,
    supplier,
    supplierName: config.label,
    codeType,
    macroExss: config.macros?.macroExss || '',
    macroExtId: config.macros?.macroExtId || '',
    macroAdvId: config.macros?.macroAdvId || '',
    macroBundleId: config.macros?.macroBundleId || '',
    erir: config.macros?.macroErir || row.erir || '',
    suggestion: supplier === 'other' ? 'other' : source,
  });
}

function normalizeRow(row: Row): Row {
  const selected = row.selected !== false;
  const status: RowStatus = selected && row.codeType ? (row.pendingChanges ? 'dirty' : 'ok') : 'warn';
  return {
    ...row,
    selected,
    supplier: row.supplier || 'other',
    supplierName: row.supplier === 'other' && row.supplierName ? row.supplierName : SUPPLIERS[row.supplier || 'other'].label,
    banners: Math.max(1, Number(row.banners) || 1),
    vastVersion: row.vastVersion || '3.0',
    status,
  };
}

function buildGenerationRowsFromMediaplan(item: MediaplanRecord): Row[] {
  const generated = new Set(item.generatedPositionIndexes || []);
  const importRows = item.import?.rows || [];
  if (importRows.length) {
    return importRows
      .map((row: PlacementRow, index) => {
        const ivt = row.measurement_type === 'ivt' || row.measurement_type === 'full_verification';
        const view = row.measurement_type === 'audit_viewability' || row.measurement_type === 'full_verification';
        const supplier = findSupplier(row.supplier || row.platform_name);
        return withSupplierDefaults({
          id: index + 1,
          sourceIndex: index,
          selected: true,
          title: row.platform_name || row.banner_name || `Позиция ${index + 1}`,
          banners: row.banner_name ? 1 : 1,
          supplier,
          med: Boolean(row.auditor_mediascope),
          auditorUrl: row.auditor_url || '',
          redirect: row.auditor_redirect === 'true',
          ivt,
          view,
          codeType: row.code_type || '',
          targetUrl: row.target_url || '',
          erir: row.macro_erir || '',
          macroExss: row.macro_exss || '',
          macroExtId: row.macro_ext_id || '',
          macroAdvId: row.macro_adv_id || '',
          macroBundleId: row.macro_bundle_id || '',
          vastVersion: row.vast_version === '2.0' ? '2.0' : '3.0',
          status: 'warn',
        }, supplier);
      })
      .filter((row) => !generated.has(row.sourceIndex));
  }

  return (item.scenarioNames || [])
    .map((scenario, index) => withSupplierDefaults({
      id: index + 1,
      sourceIndex: index,
      selected: true,
      title: scenario,
      banners: 1,
      supplier: findSupplier(scenario),
      codeType: '',
      status: 'warn',
    }, findSupplier(scenario)))
    .filter((row) => !generated.has(row.sourceIndex));
}

function parseExcelRows(workbook: XLSX.WorkBook, currentRows: Row[]): Row[] {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (!records.length) return currentRows;
  const byId = new Map(currentRows.map((row) => [String(row.id), row]));
  return records.map((record, index) => {
    const id = String(record.profile_id || record.pid || record.ID || record.id || '').trim();
    const base = byId.get(id) || currentRows[index] || INITIAL[index] || INITIAL[0];
    const supplierName = String(record.supplier_name || record['Поставщик'] || record.Supplier || '').trim();
    const supplier = supplierName ? resolveSupplierFromExcel(supplierName) : base.supplier;
    const codeType = String(record.code_id || record.Code || record['Тип кода'] || base.codeType || '').trim();
    return normalizeRow({
      ...base,
      supplier,
      supplierName: supplier === 'other' && supplierName ? supplierName : SUPPLIERS[supplier].label,
      codeType: codeType || (supplier !== 'other' ? SUPPLIERS[supplier].defaultCode : ''),
      targetUrl: String(record.target_url || record['URL баннера'] || base.targetUrl || '').trim(),
      erir: String(record.erir || record['ЕРИР'] || base.erir || '').trim(),
      comment: String(record.comment || record['Комментарий'] || base.comment || '').trim(),
      macroExss: String(record.exss || record.macro_exss || base.macroExss || '').trim(),
      macroExtId: String(record.aextid || record.macro_ext_id || base.macroExtId || '').trim(),
      macroAdvId: String(record.advid || record.macro_adv_id || base.macroAdvId || '').trim(),
      macroBundleId: String(record.bundleid || record.macro_bundle_id || base.macroBundleId || '').trim(),
      banners: Number(record.banners || record['Баннеры'] || base.banners || 1),
      suggestion: 'excel',
      pendingChanges: false,
    });
  });
}

export default function GenerationPage(){
  const searchParams = useSearchParams();
  const mediaplanId = searchParams.get('mp') || '';
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rows,setRows]=useState<Row[]>(()=>INITIAL.map((row) => withSupplierDefaults(row, row.supplier)));
  const [vis,setVis]=useState<VisibleCols>(DEFAULT_VIS);
  const [qId,setQId]=useState('');
  const [qTitle,setQTitle]=useState('');
  const [campaignType,setCampaignType]=useState<CampaignType>('Медиа+Видео');
  const [commonSettings,setCommonSettings]=useState<string[]>([]);
  const [modalWarn,setModalWarn]=useState<null|{warn:number}>(null);
  const [resetConfirm,setResetConfirm]=useState(false);
  const [notice,setNotice]=useState('');
  const [activeMediaplanTitle, setActiveMediaplanTitle] = useState('');
  const [sourceRows, setSourceRows] = useState<Row[] | null>(null);
  const [storageReady,setStorageReady]=useState(false);

  useEffect(() => {
    setVis(ssGet(K_GENERATION_VIS, DEFAULT_VIS));
    setQId(ssGet([K_GENERATION_QID, LEGACY_GENERATION_QID],''));
    setQTitle(ssGet([K_GENERATION_QTITLE, LEGACY_GENERATION_QTITLE],''));
    setCampaignType(ssGet(K_GENERATION_CAMPAIGN_TYPE,'Медиа+Видео'));
    setCommonSettings(ssGet(K_GENERATION_COMMON,[]));
    setStorageReady(true);
  }, []);

  useEffect(()=>{ if(storageReady) ssSet(K_GENERATION_QID, qId); },[qId, storageReady]);
  useEffect(()=>{ if(storageReady) ssSet(K_GENERATION_QTITLE, qTitle); },[qTitle, storageReady]);
  useEffect(()=>{ if(storageReady) ssSet(K_GENERATION_VIS, vis); },[vis, storageReady]);
  useEffect(()=>{ if(storageReady) ssSet(K_GENERATION_ROWS_TMP, rows); },[rows, storageReady]);
  useEffect(()=>{ if(storageReady) ssSet(K_GENERATION_CAMPAIGN_TYPE, campaignType); },[campaignType, storageReady]);
  useEffect(()=>{ if(storageReady) ssSet(K_GENERATION_COMMON, commonSettings); },[commonSettings, storageReady]);

  useEffect(() => {
    if (!mediaplanId) {
      const suggested = INITIAL.map((row) => withSupplierDefaults(row, row.supplier));
      setRows(suggested);
      setSourceRows(suggested);
      setNotice('Проставлены настройки по умолчанию по поставщикам.');
      return;
    }
    const mediaplan = getMediaplan(mediaplanId);
    if (!mediaplan) return;
    const nextRows = buildGenerationRowsFromMediaplan(mediaplan);
    setRows(nextRows);
    setSourceRows(nextRows);
    setQId('');
    setQTitle('');
    setActiveMediaplanTitle(mediaplan.title);
    setNotice('Проставлены настройки по умолчанию по поставщикам.');
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

  const allSelected = rows.length > 0 && rows.every((row) => row.selected);
  const selectedCount = rows.filter((row) => row.selected).length;
  const otherSupplierNames = useMemo(
    () => Array.from(new Set(rows.filter((row) => row.supplier === 'other').map((row) => row.supplierName || row.title).filter(Boolean))),
    [rows]
  );

  function updateRow(i:number, patch:Partial<Row>){
    setRows(prev=>prev.map((row,index)=> index === i ? normalizeRow({...row, ...patch, pendingChanges: true}) : row));
  }
  function changeCodeType(i:number, codeType:string){
    setRows(prev=>prev.map((row,index)=> {
      if (index !== i) return row;
      return normalizeRow({
        ...row,
        codeType,
        ivt: codeType ? row.ivt && codeSupportsIvt(codeType) : row.ivt,
        view: codeType ? row.view && codeSupportsViewability(codeType) : row.view,
        pendingChanges: true,
      });
    }));
  }
  function toggleAllSelected(value:boolean){
    setRows(prev=>prev.map((row)=>normalizeRow({...row, selected:value})));
  }
  function changeSupplier(i:number, supplier:SupplierKey){
    setRows(prev=>prev.map((row,index)=> index === i ? withSupplierDefaults({...row, codeType:''}, supplier) : row));
  }
  function resetAll(){
    setRows(sourceRows || INITIAL.map((row) => withSupplierDefaults(row, row.supplier)));
    setVis(DEFAULT_VIS);
    setCampaignType('Медиа+Видео');
    setCommonSettings([]);
    setNotice('Настройки таблицы сброшены.');
    setResetConfirm(false);
  }
  function statusHelp(r: Row){
    const reasons:string[]=[];
    if(!r.selected) reasons.push('Сценарий снят с генерации');
    if(r.selected && !r.codeType) reasons.push('Тип кода не выбран');
    if(r.pendingChanges) reasons.push('Есть ручные правки');
    return reasons.length? reasons.join(' · '): 'ОК';
  }
  function proceed(){
    const warn=rows.filter(r=>r.selected && !r.codeType).length;
    if(warn){ setModalWarn({warn}); return; }
    const selectedRows = rows.filter((row) => row.selected);
    try{
      sessionStorage.setItem(K_GENERATION_PREP_ROWS, JSON.stringify(selectedRows));
      sessionStorage.setItem(K_GENERATION_COMMON, JSON.stringify(commonSettings));
    }catch{}
    window.location.href=mediaplanId ? `/generation/upload?mp=${mediaplanId}` : '/generation/upload';
  }
  function downloadTemplate(){
    const worksheet = XLSX.utils.json_to_sheet(rows.map((row) => ({
      profile_id: row.id,
      profile_name: row.title,
      supplier_name: row.supplier === 'other' ? '' : SUPPLIERS[row.supplier].label,
      code_id: row.codeType || '',
      target_url: row.targetUrl || '',
      erir: row.erir || '',
      comment: row.comment || '',
      exss: row.macroExss || '',
      aextid: row.macroExtId || '',
      advid: row.macroAdvId || '',
      bundleid: row.macroBundleId || '',
      banners: row.banners,
    })));
    const help = XLSX.utils.aoa_to_sheet([
      ['code_id', ...CODE_TYPES],
      ['supplier_name', ...SUPPLIER_KEYS.map((key) => SUPPLIERS[key].label)],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, worksheet, 'Generation');
    XLSX.utils.book_append_sheet(wb, help, 'Справка');
    XLSX.writeFile(wb, 'autogeneration_2_template.xlsx');
  }
  async function uploadExcel(file: File | undefined){
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type:'array' });
    const nextRows = parseExcelRows(workbook, rows);
    setRows(nextRows);
    setNotice('Настройки из Excel применены к таблице генерации.');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }
  const toggleCommon = (value:string) => {
    setCommonSettings((prev) => prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]);
  };

  const auditorCols = [vis.med, vis.auditorUrl, vis.redirect].filter(Boolean).length;
  const metricCols = [vis.ivt, vis.view].filter(Boolean).length;
  const th=`${styles.generationTh}`;
  const td=`${styles.generationTd}`;

  return (
    <div className={`${styles.theme} ${styles.generationPage}`}>
      <div className={styles.breadcrumb}>
        <Link href="/campaigns">Список кампаний</Link>
        <span>→</span>
        <span>{activeMediaplanTitle || '815538: TEST'}</span>
      </div>

      <div className={styles.generationTabsRow}>
        <Tabs/>
      </div>

      <div className={styles.generationToolbar}>
        <label className={styles.toolbarField}>
          <span>Тип кампании</span>
          <select value={campaignType} onChange={(event)=>setCampaignType(event.target.value as CampaignType)}>
            <option>Медиа+Видео</option>
            <option>Медиа</option>
            <option>Видео</option>
          </select>
        </label>
        <details className={styles.toolbarDropdown}>
          <summary>
            <span>Общие настройки</span>
            <strong>{commonSettings.length ? commonSettings.join(', ') : 'Выберите...'}</strong>
          </summary>
          <div className={styles.toolbarDropdownMenu}>
            <label><input type="checkbox" checked={commonSettings.includes('postclick_inapp')} onChange={()=>toggleCommon('postclick_inapp')}/> Учёт PostClick/PostView для InApp</label>
            <label><input type="checkbox" checked={commonSettings.includes('third_party_click_audit')} onChange={()=>toggleCommon('third_party_click_audit')}/> Сторонний аудит клика</label>
          </div>
        </details>
        <button onClick={proceed} disabled={selectedCount === 0} className={`${styles.btn} ${styles.btnPrimary}`}>
          <span>Далее</span>
          <ArrowRight className="h-4 w-4" />
        </button>
        <button onClick={()=>setResetConfirm(true)} title="Сбросить настройки" className={styles.iconBtn}>
          <RotateCcw className="h-4 w-4" />
        </button>
        <div className={styles.toolbarSpacer} />
        <div className={styles.toolbarActions}>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event)=>uploadExcel(event.target.files?.[0])}/>
          <button type="button" onClick={()=>fileInputRef.current?.click()} className={`${styles.btn} ${styles.btnGhost}`}>
            <Upload className="h-4 w-4" />
            <span>Загрузить Excel</span>
          </button>
          <button type="button" onClick={downloadTemplate} className={`${styles.btn} ${styles.btnGhost}`}>
            <Download className="h-4 w-4" />
            <span>Скачать шаблон</span>
          </button>
          <ColumnsMenu vis={vis} setVis={setVis}/>
        </div>
      </div>

      <div className={styles.toastStack}>
        {notice && (
          <div className={styles.toast}>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span>{notice}</span>
            <button type="button" onClick={()=>setNotice('')} className={styles.toastClose} title="Закрыть"><X className="h-4 w-4" /></button>
          </div>
        )}
        {mediaplanId && activeMediaplanTitle && (
          <div className={styles.toast}>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span>Генерация кодов для медиаплана «{activeMediaplanTitle}»</span>
          </div>
        )}
        {otherSupplierNames.length > 0 && (
          <div className={`${styles.toast} ${styles.toastWarn}`}>
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span>Поставщик не найден: {otherSupplierNames.slice(0, 3).join(', ')}{otherSupplierNames.length > 3 ? '...' : ''}</span>
          </div>
        )}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.generationTable}>
          <colgroup>
            <col className={styles.colStatus} />
            <col className={styles.colId} />
            <col className={styles.colTitle} />
            {vis.med && <col className={styles.colCheck} />}
            {vis.auditorUrl && <col className={styles.colUrl} />}
            {vis.redirect && <col className={styles.colCheck} />}
            {vis.ivt && <col className={styles.colCheck} />}
            {vis.view && <col className={styles.colCheck} />}
            {vis.supplier && <col className={styles.colSupplier} />}
            {vis.macroExtId && <col className={styles.colMacro} />}
            {vis.macroAdvId && <col className={styles.colMacro} />}
            {vis.macroBundleId && <col className={styles.colMacro} />}
            {vis.macroExss && <col className={styles.colMacro} />}
            {vis.vastVersion && <col className={styles.colVast} />}
            {vis.codeType && <col className={styles.colCode} />}
            {vis.banners && <col className={styles.colBanners} />}
          </colgroup>
          <thead>
            <tr>
              <th className={th} rowSpan={2}>
                <div className={styles.statusHeader}>
                  <input type="checkbox" checked={allSelected} onChange={(event)=>toggleAllSelected(event.target.checked)} />
                </div>
              </th>
              <th className={th} rowSpan={2}>
                <div>ID</div>
                <input value={qId} onChange={e=>setQId(e.target.value)} placeholder="Поиск" className={styles.headerSearch}/>
              </th>
              <th className={th} rowSpan={2}>
                <div>Название</div>
                <input value={qTitle} onChange={e=>setQTitle(e.target.value)} placeholder="Поиск" className={styles.headerSearch}/>
              </th>
              {auditorCols > 0 && <th className={th} colSpan={auditorCols}>Внешний аудитор</th>}
              {metricCols > 0 && <th className={th} colSpan={metricCols}>Метрики</th>}
              {vis.supplier && <th className={th} rowSpan={2}>Поставщик</th>}
              {vis.macroExtId && <th className={th} rowSpan={2}>Макрос внешнего ID</th>}
              {vis.macroAdvId && <th className={th} rowSpan={2}>Макрос gaid/idfa</th>}
              {vis.macroBundleId && <th className={th} rowSpan={2}>Макрос Bundle ID</th>}
              {vis.macroExss && <th className={th} rowSpan={2}>Макрос exss</th>}
              {vis.vastVersion && <th className={th} rowSpan={2}>VAST версия</th>}
              {vis.codeType && <th className={th} rowSpan={2}>Тип кода</th>}
              {vis.banners && <th className={th} rowSpan={2}>Баннеры</th>}
            </tr>
            {(auditorCols > 0 || metricCols > 0) && (
            <tr>
              {vis.med && <th className={th}>Mediascope</th>}
              {vis.auditorUrl && <th className={th}>URL аудитора</th>}
              {vis.redirect && <th className={th}>Редирект</th>}
              {vis.ivt && <th className={th}>IVT</th>}
              {vis.view && <th className={th}>Видимость</th>}
            </tr>
            )}
          </thead>
          <tbody>
            {filtered.map(r=>{
              const i=rows.findIndex(x=>x.id===r.id);
              return (
                <tr key={`${r.id}-${r.sourceIndex}`} className="hover:bg-slate-50">
                  <td className={td}>
                    <div className={styles.statusCell}>
                      <input type="checkbox" checked={r.selected} onChange={(event)=>updateRow(i,{selected:event.target.checked})}/>
                      <span title={statusHelp(r)}><StatusIcon status={r.status}/></span>
                    </div>
                  </td>
                  <td className={td}>{r.id}</td>
                  <td className={td}><span>{r.title}</span></td>
                  {vis.med && <td className={td}><input type="checkbox" checked={!!r.med} onChange={e=>updateRow(i,{med:e.target.checked, auditorUrl:e.target.checked ? '' : r.auditorUrl})}/></td>}
                  {vis.auditorUrl && <td className={td}><input value={r.auditorUrl || ''} onChange={e=>updateRow(i,{auditorUrl:e.target.value, med:false})} placeholder="https://..." /></td>}
                  {vis.redirect && <td className={td}><input type="checkbox" checked={!!r.redirect} onChange={e=>updateRow(i,{redirect:e.target.checked})}/></td>}
                  {vis.ivt && <td className={td}><input type="checkbox" checked={!!r.ivt} onChange={e=>updateRow(i,{ivt:e.target.checked})}/></td>}
                  {vis.view && <td className={td}><input type="checkbox" checked={!!r.view} onChange={e=>updateRow(i,{view:e.target.checked})}/></td>}
                  {vis.supplier && (
                    <td className={td}>
                      <div className={styles.cellControlWrap}>
                        <select value={r.supplier} onChange={e=>changeSupplier(i, e.target.value as SupplierKey)} className="border rounded px-2 py-1 bg-white">
                          {SUPPLIER_KEYS.map(k=><option key={k} value={k}>{SUPPLIERS[k].label}</option>)}
                        </select>
                        {r.supplier === 'other' && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                      </div>
                    </td>
                  )}
                  {vis.macroExss && <td className={td}><input value={r.macroExss || ''} onChange={e=>updateRow(i,{macroExss:e.target.value})} /></td>}
                  {vis.macroExtId && <td className={td}><input value={r.macroExtId || ''} onChange={e=>updateRow(i,{macroExtId:e.target.value})} /></td>}
                  {vis.macroAdvId && <td className={td}><input value={r.macroAdvId || ''} onChange={e=>updateRow(i,{macroAdvId:e.target.value})} /></td>}
                  {vis.macroBundleId && <td className={td}><input value={r.macroBundleId || ''} onChange={e=>updateRow(i,{macroBundleId:e.target.value})} /></td>}
                  {vis.vastVersion && <td className={td}><select value={r.vastVersion || '3.0'} onChange={e=>updateRow(i,{vastVersion:e.target.value as '2.0'|'3.0'})}><option>2.0</option><option>3.0</option></select></td>}
                  {vis.codeType && <td className={td}><CodeTypePicker row={r} onChange={(codeType)=>changeCodeType(i, codeType)} /></td>}
                  {vis.banners && <td className={td}><input type="number" min={1} value={r.banners} onChange={e=>updateRow(i,{banners:Number(e.target.value)})} /></td>}
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
              Тип кода обязателен для выбранных сценариев. Заполните его или снимите сценарий с генерации.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setModalWarn(null)} className={`${styles.btn} ${styles.btnGhost}`}>Вернуться</button>
            </div>
          </div>
        </div>
      )}
      {resetConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-20">
          <div className="bg-white rounded-lg shadow p-6 w-[520px]">
            <div className="text-lg font-semibold mb-2">Сбросить настройки?</div>
            <p className="text-sm text-slate-600 mb-4">
              Будут очищены настройки таблицы, выбранные колонки, тип кампании, общие настройки и количество баннеров вернется к значению 1.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setResetConfirm(false)} className={`${styles.btn} ${styles.btnGhost}`}>Отмена</button>
              <button onClick={resetAll} className={`${styles.btn} ${styles.btnPrimary}`}>Сбросить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
