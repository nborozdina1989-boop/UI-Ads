'use client';

import styles from "../adriver.module.css";
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, RotateCcw, Upload } from "lucide-react";
import { codeRequiresCreative, type SupplierKey } from "@/lib/autogenSuppliers";

type Row = {
  id:number;
  sourceIndex:number;
  title:string;
  banners:number;
  supplier?:SupplierKey;
  codeType?:string;
  targetUrl?:string;
  erir?:string;
  comment?:string;
  macroExss?:string;
  macroExtId?:string;
  macroAdvId?:string;
  macroBundleId?:string;
  vastVersion?: '2.0'|'3.0';
};

type BannerRow = Row & {
  bannerIndex: number;
  bannerId: string;
  creativeName?: string;
  creativeUploaded?: boolean;
};

const K_GENERATION_PREP_ROWS = 'generation_prepare_rows';
const K_GENERATION_ROWS = 'generation_rows';
const K_GENERATION_COMMON = 'generation_common_settings';

const ssGet = <T,>(key:string, fallback:T):T => {
  try {
    const value = sessionStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const ssSet = (key:string, value:unknown) => {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
};

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

function buildBannerRows(rows: Row[]): BannerRow[] {
  return rows.flatMap((row) => {
    const count = Math.max(1, Number(row.banners) || 1);
    return Array.from({ length: count }, (_, index) => ({
      ...row,
      bannerIndex: index + 1,
      bannerId: `${row.id}-${index + 1}`,
      comment: row.comment || `Креатив № ${index + 1}`,
    }));
  });
}

function GenerationUploadContent(){
  const searchParams = useSearchParams();
  const mediaplanId = searchParams.get('mp') || '';
  const [rows,setRows] = useState<BannerRow[]>([]);
  const [commonSettings,setCommonSettings] = useState<string[]>([]);
  const [notice,setNotice] = useState('');

  useEffect(() => {
    const source = ssGet<Row[]>(K_GENERATION_PREP_ROWS, []);
    setRows(buildBannerRows(source));
    setCommonSettings(ssGet<string[]>(K_GENERATION_COMMON, []));
  }, []);

  const hasCreativeUploads = useMemo(() => rows.some((row) => codeRequiresCreative(row.codeType)), [rows]);
  const ready = useMemo(() => rows.every((row) => !codeRequiresCreative(row.codeType) || row.creativeUploaded), [rows]);

  function updateRow(bannerId:string, patch:Partial<BannerRow>) {
    setRows((prev) => prev.map((row) => row.bannerId === bannerId ? { ...row, ...patch } : row));
  }

  function uploadCreative(bannerId:string) {
    updateRow(bannerId, { creativeUploaded:true, creativeName:'creative_uploaded.zip' });
    setNotice('Креатив загружен и применен к сценарию.');
  }

  function chooseCreative(bannerId:string) {
    updateRow(bannerId, { creativeUploaded:true, creativeName:'campaign_creative_vpaid' });
    setNotice('Выбран ранее загруженный креатив.');
  }

  function uploadAllCreatives() {
    setRows((prev) => prev.map((row) => codeRequiresCreative(row.codeType) ? { ...row, creativeUploaded:true, creativeName:'campaign_creative_shared' } : row));
    setNotice('Единый креатив загружен и применен ко всем подходящим сценариям.');
  }

  function resetAll() {
    setRows((prev) => prev.map((row) => ({ ...row, targetUrl:'', erir:'', comment:`Креатив № ${row.bannerIndex}`, creativeUploaded:false, creativeName:'' })));
    setNotice('Настройки второго шага сброшены.');
  }

  function generateCodes() {
    ssSet(K_GENERATION_ROWS, rows);
    sessionStorage.removeItem(K_GENERATION_PREP_ROWS);
    window.location.href = mediaplanId ? `/generation/codes?mp=${mediaplanId}` : '/generation/codes';
  }

  return (
    <div className={`${styles.theme} ${styles.adminPage}`}>
      <div className={styles.adminTopbar}>
        <Tabs/>
        <div className={styles.toolbar}>
          <a href={mediaplanId ? `/generation?mp=${mediaplanId}` : '/generation'} className={`${styles.btn} ${styles.btnGhost}`}>
            <ArrowLeft className="h-4 w-4" />
            <span>Назад</span>
          </a>
          <button onClick={resetAll} title="Сбросить" className={`${styles.btn} ${styles.btnGhost}`}>
            <RotateCcw className="h-4 w-4" />
          </button>
          {hasCreativeUploads && (
            <button onClick={uploadAllCreatives} className={`${styles.btn} ${styles.btnGhost}`}>
              <Upload className="h-4 w-4" />
              <span>Загрузить креатив</span>
            </button>
          )}
          <button onClick={generateCodes} disabled={!ready || rows.length === 0} className={`${styles.btn} ${styles.btnPrimary}`}>
            <span>Сгенерировать коды</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className={`${styles.alert}`}>
        <div className="font-medium text-slate-900">Загрузка креатива и проверка параметров</div>
        <div className="text-sm text-slate-600">
          Общие настройки подтянуты с предыдущего шага: {commonSettings.length ? commonSettings.join(', ') : 'не выбраны'}. Тип кода здесь не меняется, для изменения вернитесь назад.
        </div>
      </div>

      {notice && (
        <div className={`${styles.toast}`}>
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      {hasCreativeUploads && !ready && (
        <div className={`${styles.alert} ${styles.alertWarn}`}>
          Для MRAID и VPAID нужно загрузить или выбрать креатив перед генерацией кодов.
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="px-3 py-2 text-xs uppercase text-slate-500 text-left">Сценарий</th>
              <th className="px-3 py-2 text-xs uppercase text-slate-500 text-left">URL баннера</th>
              <th className="px-3 py-2 text-xs uppercase text-slate-500 text-left">ЕРИР</th>
              <th className="px-3 py-2 text-xs uppercase text-slate-500 text-left">Комментарий</th>
              <th className="px-3 py-2 text-xs uppercase text-slate-500 text-left">Креатив</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const uploadRequired = codeRequiresCreative(row.codeType);
              return (
                <tr key={row.bannerId} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-sm border-t">
                    <div className="font-medium">{row.id}: {row.title}</div>
                    <div className="text-xs text-slate-500">Креатив #{row.bannerIndex} · {row.codeType || 'Тип кода не выбран'}</div>
                  </td>
                  <td className="px-3 py-2 text-sm border-t">
                    <input value={row.targetUrl || ''} onChange={(event)=>updateRow(row.bannerId,{targetUrl:event.target.value})} placeholder="https://adriver.ru" className="w-full"/>
                  </td>
                  <td className="px-3 py-2 text-sm border-t">
                    <input value={row.erir || ''} onChange={(event)=>updateRow(row.bannerId,{erir:event.target.value})} placeholder="erir_token или макрос" className="w-full"/>
                  </td>
                  <td className="px-3 py-2 text-sm border-t">
                    <input value={row.comment || ''} onChange={(event)=>updateRow(row.bannerId,{comment:event.target.value})} className="w-full"/>
                  </td>
                  <td className="px-3 py-2 text-sm border-t">
                    {uploadRequired ? (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={()=>uploadCreative(row.bannerId)} className={`${styles.btn} ${styles.btnGhost}`}>
                          <Upload className="h-4 w-4" />
                          <span>Загрузить</span>
                        </button>
                        <button type="button" onClick={()=>chooseCreative(row.bannerId)} className={`${styles.btn} ${styles.btnGhost}`}>Выбрать</button>
                        {row.creativeUploaded && <span className={styles.chip}>{row.creativeName}</span>}
                      </div>
                    ) : (
                      <span className="text-slate-500">Не требуется</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <div className={`${styles.alert}`}>
          Нет выбранных сценариев. Вернитесь на первый шаг генерации.
        </div>
      )}
    </div>
  );
}

export default function GenerationUploadPage() {
  return (
    <Suspense fallback={null}>
      <GenerationUploadContent />
    </Suspense>
  );
}
