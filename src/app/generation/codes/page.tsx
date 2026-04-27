'use client';
import styles from "../adriver.module.css";
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronUp, ClipboardCopy, Download, ExternalLink, History, RotateCw } from "lucide-react";
import { markMediaplanPositionsGenerated } from "@/lib/mediaplan";

/** Типы */
type SupplierKey='yandex'|'ivi'|'ozon'|'hyper'|'vk'|'rambler'|'gpmd';
type Row={id:number; sourceIndex:number; title:string; supplier?:SupplierKey|''; ivt?:boolean; view?:boolean; codeType?:string;};
type Batch={id:number; createdAt:number; items:Row[]; status:'ready'|'warn'; mediaplanId?:string};

/** Справочники */
const SUPPLIER_LABEL:Record<SupplierKey,string>={yandex:'Yandex',ivi:'IVI',ozon:'Ozon',hyper:'Hyper',vk:'VK',rambler:'Rambler',gpmd:'ГПМД'};

/** Код по строке (ленивая генерация) */
function buildCode(r:Row){
  const t=(r.codeType||'').toLowerCase();
  if(t.includes('vast')){
    const url=`https://demo.adriver.local/vast?pid=${r.id}&sup=${encodeURIComponent(r.supplier?SUPPLIER_LABEL[r.supplier]:'unknown')}&ivt=${r.ivt?'1':'0'}&view=${r.view?'1':'0'}&type=${encodeURIComponent(r.codeType||'')}`;
    return `<VASTAdTagURI><![CDATA[${url}]]></VASTAdTagURI>`;
  }
  if(t.includes('mraid')){
    const url=`https://demo.adriver.local/mraid?pid=${r.id}&sup=${encodeURIComponent(r.supplier?SUPPLIER_LABEL[r.supplier]:'unknown')}&type=${encodeURIComponent(r.codeType||'')}`;
    return `mraid.open('${url}')`;
  }
  const px=`https://demo.adriver.local/audit?pid=${r.id}&sup=${encodeURIComponent(r.supplier?SUPPLIER_LABEL[r.supplier]:'unknown')}&ivt=${r.ivt?'1':'0'}&view=${r.view?'1':'0'}&type=${encodeURIComponent(r.codeType||'')}`;
  return px;
}

/** Хранилище в сессии */
const ssGet=<T,>(k:string,f:T):T=>{try{const v=sessionStorage.getItem(k);return v?JSON.parse(v):f;}catch{return f;}};
const ssSet=(k:string,v:unknown)=>{try{sessionStorage.setItem(k,JSON.stringify(v));}catch{}};

/** Чтение "последней партии" из /generation */
const readRows=():Row[]=>{try{const raw=sessionStorage.getItem('autogen_rows');return raw?JSON.parse(raw):[]}catch{return[]}};
const readBatches=():Batch[]=>ssGet('autogen_batches',[]);
const writeBatches=(b:Batch[])=>ssSet('autogen_batches',b);

/** Компоненты */
function Tabs(){
  const base='/generation';
  const cls="px-3 py-1.5 rounded-md border text-sm";
  return (
    <div className={styles.tabs}>
      <a href={base} className={`${cls} ${styles.tab}`}>Генерация</a>
      <a href={`${base}/codes`} className={`${cls} ${styles.tab} ${styles.tabActive}`}>Коды</a>
    </div>
  );
}

function CodesPageContent(){
  const searchParams = useSearchParams();
  const mediaplanId = searchParams.get('mp') || '';
  const [batches,setBatches]=useState<Batch[]>([]);
  const [collapsed,setCollapsed]=useState<Record<number,boolean>>(()=>ssGet('codes_collapsed',{}));
  const [selected,setSelected]=useState<Set<string>>(()=>new Set(ssGet<string[]>('codes_selected',[])));
  const [selectAll,setSelectAll]=useState(false);
  const [contextMp, setContextMp] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  /** Создаём новую партию из последнего шага "Далее" (если есть) */
  useEffect(()=>{
    const cur = readRows();
    let list = readBatches();
    if (mediaplanId) {
      try { sessionStorage.setItem('autogen_context_mp', mediaplanId); } catch {}
      setContextMp(mediaplanId);
    } else {
      try { setContextMp(sessionStorage.getItem('autogen_context_mp') || ''); } catch {}
    }
    if(cur.length){
      const lastId = list[0]?.id ?? 267;
      const status:Batch['status']=cur.every(r=>r.supplier && r.codeType)?'ready':'warn';
      const batch:Batch={id:lastId+1, createdAt:Date.now(), items:cur, status, mediaplanId: mediaplanId || sessionStorage.getItem('autogen_context_mp') || ''};
      list = [batch, ...list].slice(0,10); // максимум 10 партий для демо
      writeBatches(list);
      sessionStorage.removeItem('autogen_rows');
    }
    setBatches(list);
  },[mediaplanId]);

  /** Персист UI состояний */
  useEffect(()=>ssSet('codes_collapsed',collapsed),[collapsed]);
  useEffect(()=>ssSet('codes_selected',Array.from(selected)),[selected]);

  const visibleBatches = useMemo(
    () => (contextMp ? batches.filter((batch) => batch.mediaplanId === contextMp) : batches),
    [batches, contextMp]
  );

  /** Верхняя панель: свёрнуто/развёрнуто */
  const allCollapsed = useMemo(()=>visibleBatches.length>0 && visibleBatches.every(b=>collapsed[b.id]),[visibleBatches,collapsed]);
  const toggleAll=()=>setCollapsed(prev=>{
    const now:Record<number,boolean>={...prev};
    const v=!allCollapsed;
    visibleBatches.forEach(b=>{ now[b.id]=v; });
    return now;
  });

  /** Выборы */
  const key=(bid:number,rid:number)=>`${bid}:${rid}`;
  const toggleSel=(bid:number,rid:number)=>setSelected(prev=>{const n=new Set(prev); const k=key(bid,rid); if(n.has(k)) n.delete(k); else n.add(k); return n;});
  const onSelectAll=(v:boolean)=>{
    setSelectAll(v);
    setSelected(prev=>{
      const n=new Set(prev);
      visibleBatches.forEach(b=>{
        b.items.forEach(r=>{
          const k=key(b.id,r.id);
          if(v) n.add(k); else n.delete(k);
        });
      });
      return n;
    });
  };

  /** Массовая копия */
  const copySelected=()=>{
    const parts:string[]=[];
    visibleBatches.forEach(b=>{
      b.items.forEach(r=>{
        if(selected.has(key(b.id,r.id))) parts.push(buildCode(r));
      });
    });
    try{ navigator.clipboard?.writeText(parts.join('\n\n')); }catch{}
  };

  /** Метрики/проблемы (для резюме наверху) */
  const issues = useMemo(()=>{
    const missingSupplier:number[]=[]; const missingType:number[]=[];
    visibleBatches.forEach(b=>b.items.forEach(r=>{
      if(!r.supplier) missingSupplier.push(r.id);
      if(!r.codeType) missingType.push(r.id);
    }));
    return {missingSupplier, missingType, count: missingSupplier.length+missingType.length};
  },[visibleBatches]);

  function finalizeCodes(){
    if (!contextMp) return;
    const indexes = Array.from(
      new Set(
        visibleBatches.flatMap((batch) => batch.items.map((item) => item.sourceIndex)).filter((index) => Number.isInteger(index))
      )
    );
    markMediaplanPositionsGenerated(contextMp, indexes);
    setSuccessMessage(`Коды созданы для ${indexes.length} позиций медиаплана.`);
    window.location.href = `/mediaplan/${contextMp}?flash=codes-created`;
  }

  return (
    <div className={`${styles.theme} p-6 space-y-4`}>
      <div className="flex items-center justify-between">
        <Tabs/>
        <div className={styles.toolbar}>
          <label className="flex items-center gap-2"><input type="checkbox" checked={selectAll} onChange={e=>onSelectAll(e.target.checked)}/> Все</label>
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={toggleAll}>{allCollapsed?'Развернуть':'Свернуть'}</button>
          <button className={styles.iconBtn} title="Обновить" onClick={()=>location.reload()}>
            <RotateCw className="h-4 w-4" />
          </button>
          <select className={`${styles.btn}`} defaultValue=""><option value="">Выбрать сценарии</option></select>
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={copySelected}>Скопировать выбранные</button>
          <a href={contextMp ? `/generation?mp=${contextMp}` : "/generation"} className={`${styles.btn} ${styles.btnGhost}`}>
            <ArrowLeft className="h-4 w-4" />
            <span>Назад</span>
          </a>
          {contextMp ? (
            <button type="button" onClick={finalizeCodes} className={`${styles.btn} ${styles.btnPrimary}`}>Заказать коды</button>
          ) : (
            <a href="/404" className={`${styles.btn} ${styles.btnPrimary}`}>Заказать коды</a>
          )}
        </div>
      </div>

      {successMessage && (
        <div className={`${styles.alert}`}>
          <span className="text-slate-700">{successMessage}</span>
        </div>
      )}

      {issues.count>0 && (
        <div className={`${styles.alert} ${styles.alertWarn}`}>
          <div><strong>Есть проблемы:</strong> отсутствуют данные у {issues.count} полей.</div>
          <div className="text-sm">
            Нет поставщика у PID: {issues.missingSupplier.slice(0,3).join(', ')}{issues.missingSupplier.length>3?'…':''};{' '}
            нет типа кода у PID: {issues.missingType.slice(0,3).join(', ')}{issues.missingType.length>3?'…':''}.
          </div>
        </div>
      )}

      {/* Партии */}
      <div className="space-y-3">
        {visibleBatches.map(batch=>{
          const ok = batch.status==='ready';
          const collapsedCls = collapsed[batch.id] ? 'collapsed' : '';
          const d = new Date(batch.createdAt);
          const title = `#${batch.id}  Коды от  ${d.toLocaleDateString()} ${d.toLocaleTimeString().slice(0,5)}`;

          return (
            <div key={batch.id} className={`${styles.card} ${collapsedCls}`}>
              <div className={styles.cardHeader}>
                <div className={styles.headerLeft}>
                  <input type="checkbox" checked={batch.items.every(r=>selected.has(key(batch.id,r.id)))} onChange={e=>{
                    const v=e.target.checked; setSelected(prev=>{const n=new Set(prev); batch.items.forEach(r=>{const k=key(batch.id,r.id); if(v) n.add(k); else n.delete(k);}); return n;});
                  }}/>
                  <button
                    className={`${styles.btn} ${styles.btnGhost}`}
                    onClick={() => setCollapsed((p) => ({ ...p, [batch.id]: !p[batch.id] }))}
                    aria-label={collapsed[batch.id] ? "Развернуть партию" : "Свернуть партию"}
                  >
                    {collapsed[batch.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </button>
                  <a href="/404" className={styles.link}>{title}</a>
                  <span className={styles.badge}>{d.toLocaleDateString()} {d.toLocaleTimeString().slice(0,5)}</span>
                  <span className={styles.badge}><span className={`${styles.dot} ${ok?styles.dotGreen:styles.dotWarn}`} /> {ok?'Готовы':'Есть проблемы'}</span>
                  <span className={`${styles.badge} ${styles.badgeMuted}`}>{batch.items.length} сценария</span>
                </div>
                <div className={styles.headerActions}>
                  <a href="/404" className={styles.iconBtn} title="Excel"><History className="h-4 w-4" /></a>
                  <a href="/404" className={styles.iconBtn} title="Архив"><Download className="h-4 w-4" /></a>
                  <a href="/404" className={styles.iconBtn} title="Коды"><ExternalLink className="h-4 w-4" /></a>
                </div>
              </div>

              <div className="rows">
                <div className={styles.rowsHeader}>
                  <div>ID сценария</div>
                  <div>Название сценария</div>
                  <div></div>
                </div>
                {batch.items.map(r=>{
                  const k = key(batch.id,r.id);
                  const warn = !r.supplier || !r.codeType;
                  return (
                    <div key={k} className={styles.row}>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={selected.has(k)} onChange={()=>toggleSel(batch.id,r.id)}/>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`${styles.dot} ${warn?styles.dotWarn:styles.dotGreen}`} title={warn? 'Требует доп.данных':'Готово'} />
                        <strong>{r.id}</strong>
                        <span>{r.title}</span>
                      </div>
                      <div className={styles.rowActions}>
                        <button className={styles.iconBtn} title="Копировать код" onClick={()=>{ try{navigator.clipboard?.writeText(buildCode(r));}catch{}}}>
                          <ClipboardCopy className="h-4 w-4" />
                        </button>
                        <a className={styles.iconBtn} title="Скачать" href="/404"><Download className="h-4 w-4" /></a>
                        <a className={styles.iconBtn} title="Открыть" href="/404"><ExternalLink className="h-4 w-4" /></a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {visibleBatches.length===0 && (
          <div className={`${styles.alert}`}>
            <span className="text-slate-600">Нет кодов. Вернитесь на «Генерация» и нажмите «Далее».</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CodesPage() {
  return (
    <Suspense fallback={null}>
      <CodesPageContent />
    </Suspense>
  );
}
