'use client';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import TabsAutogen from '@/components/autogen/TabsAutogen';
import { buildCode } from '@/lib/codeBuilder';
import { SUPPLIER_LABEL, SupplierKey } from '@/lib/suppliers';

type Row = {
  id: number; title: string; banners: number;
  supplier?: SupplierKey | ''; med?: boolean; ivt?: boolean; view?: boolean; codeType?: string;
};

function readRows(): Row[] {
  try { const raw = sessionStorage.getItem('autogen_rows'); return raw ? JSON.parse(raw) as Row[] : []; } catch { return []; }
}

export default function CodesPage(){
  const [rows, setRows] = useState<Row[]>([]);
  const path = usePathname();
  const base = path.startsWith('/generation') ? '/generation' : '/autogen';

  useEffect(()=>{ setRows(readRows()); },[]);

  const built = useMemo(()=> rows.map(r=>{
    const out = buildCode({
      id: r.id, title: r.title,
      supplier: r.supplier ? SUPPLIER_LABEL[r.supplier] : undefined,
      ivt: !!r.ivt, view: !!r.view, codeType: r.codeType || ''
    });
    const warn = !r.supplier || !r.codeType;
    return { row: r, code: out.text, kind: out.kind, warn };
  }),[rows]);

  const total = rows.length; const warns = built.filter(b=>b.warn).length;
  const copy=(t:string)=> navigator.clipboard?.writeText(t);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <TabsAutogen />
        <div className="flex items-center gap-2">
          <a href={base} className="px-3 py-1.5 rounded-md border bg-white">← Назад к Генерации</a>
          <a href="/404" className="px-3 py-1.5 rounded-md bg-violet-600 text-white hover:bg-violet-700">Заказать коды</a>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-sm text-slate-600">Всего позиций: <b>{total}</b></div>
        <div className={`text-sm ${warns? 'text-amber-600':'text-green-600'}`}>
          {warns ? `Требуют внимания: ${warns}` : 'Все позиции готовы'}
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
            {built.map(({row, code, kind, warn})=>(
              <tr key={row.id} className="border-t hover:bg-slate-50 text-sm">
                <td className="px-3 py-2">{row.id}</td>
                <td className="px-3 py-2">{row.title}</td>
                <td className="px-3 py-2">{row.supplier ? SUPPLIER_LABEL[row.supplier] : '—'}</td>
                <td className="px-3 py-2">{row.codeType || '—'}</td>
                <td className="px-3 py-2">
                  <textarea readOnly value={code} rows={kind==='vast'?3:2}
                            className="w-[520px] max-w-full border rounded p-2 font-mono text-xs bg-slate-50"/>
                </td>
                <td className="px-3 py-2">
                  <button onClick={()=>copy(code)} className="px-2 py-1 border rounded">Скопировать</button>
                </td>
                <td className="px-3 py-2">
                  {warn ? <span title="Требует проверки" className="text-amber-600">⚠️</span> : <span className="text-green-600">✔︎</span>}
                </td>
              </tr>
            ))}
            {built.length===0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                Пусто. Вернись на «Генерацию» и нажми «Далее», чтобы сформировать коды.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-500">* Прототип. Генерация идёт на клиенте, данные фиктивные.</div>
    </div>
  );
}
