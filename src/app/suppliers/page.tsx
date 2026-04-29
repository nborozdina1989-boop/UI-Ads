'use client';

import styles from "../generation/adriver.module.css";
import Link from "next/link";
import { useMemo, useRef, useState } from 'react';
import * as XLSX from "xlsx";
import { Download, Pencil, PlusCircle, Search, Upload } from "lucide-react";
import { CODE_TYPES, SUPPLIERS, SUPPLIER_KEYS, type CodeType } from "@/lib/autogenSuppliers";

type SupplierDraft = {
  id: number | '';
  label: string;
  aliases: string;
  macroExss: string;
  macroAdvId: string;
  macroExtId: string;
  macroBundleId: string;
  allowedCodes: CodeType[];
  defaultCode: CodeType | '';
};

const initialRows = SUPPLIER_KEYS
  .filter((key) => key !== 'other')
  .map((key) => {
    const supplier = SUPPLIERS[key];
    return {
      id: supplier.id,
      label: supplier.label,
      aliases: supplier.aliases.join(', '),
      macroExss: supplier.macros?.macroExss || '',
      macroAdvId: supplier.macros?.macroAdvId || '',
      macroExtId: supplier.macros?.macroExtId || '',
      macroBundleId: supplier.macros?.macroBundleId || '',
      allowedCodes: supplier.recommended,
      defaultCode: supplier.defaultCode,
    };
  });

const emptyDraft: SupplierDraft = {
  id: '',
  label: '',
  aliases: '',
  macroExss: '',
  macroAdvId: '',
  macroExtId: '',
  macroBundleId: '',
  allowedCodes: [],
  defaultCode: '',
};

export default function SuppliersPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<SupplierDraft[]>(initialRows);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<SupplierDraft | null>(null);
  const [notice, setNotice] = useState('');

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) => [row.id, row.label, row.aliases, row.defaultCode].join(' ').toLowerCase().includes(normalized));
  }, [query, rows]);

  function toggleAllowed(code: CodeType) {
    setEditing((draft) => {
      if (!draft) return draft;
      const allowedCodes = draft.allowedCodes.includes(code)
        ? draft.allowedCodes.filter((item) => item !== code)
        : [...draft.allowedCodes, code];
      const defaultCode = draft.defaultCode && allowedCodes.includes(draft.defaultCode) ? draft.defaultCode : allowedCodes[0] || '';
      return { ...draft, allowedCodes, defaultCode };
    });
  }

  function saveDraft() {
    if (!editing?.label.trim()) return;
    setRows((prev) => {
      const id = editing.id || Math.max(0, ...prev.map((row) => Number(row.id) || 0)) + 1;
      const next = { ...editing, id };
      const exists = prev.some((row) => row.id === id);
      return exists ? prev.map((row) => row.id === id ? next : row) : [next, ...prev];
    });
    setEditing(null);
    setNotice('Поставщик сохранен в базе прототипа.');
  }

  function downloadExcel() {
    const sheet = XLSX.utils.json_to_sheet(rows.map((row) => ({
      id: row.id,
      supplier_name: row.label,
      aliases: row.aliases,
      macro_exss: row.macroExss,
      macro_advid: row.macroAdvId,
      macro_aextid: row.macroExtId,
      macro_bundleid: row.macroBundleId,
      allowed_code_types: row.allowedCodes.join('; '),
      default_code_type: row.defaultCode,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Suppliers');
    XLSX.writeFile(wb, 'autogeneration_2_suppliers.xlsx');
  }

  async function uploadExcel(file: File | undefined) {
    if (!file) return;
    const workbook = XLSX.read(await file.arrayBuffer(), { type:'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    const imported = records.map((record, index) => {
      const allowedCodes = String(record.allowed_code_types || '').split(';').map((item) => item.trim()).filter((item): item is CodeType => CODE_TYPES.includes(item as CodeType));
      const defaultCode = String(record.default_code_type || '').trim() as CodeType;
      return {
        id: Number(record.id) || rows.length + index + 1,
        label: String(record.supplier_name || '').trim(),
        aliases: String(record.aliases || '').trim(),
        macroExss: String(record.macro_exss || '').trim(),
        macroAdvId: String(record.macro_advid || '').trim(),
        macroExtId: String(record.macro_aextid || '').trim(),
        macroBundleId: String(record.macro_bundleid || '').trim(),
        allowedCodes,
        defaultCode: allowedCodes.includes(defaultCode) ? defaultCode : allowedCodes[0] || '',
      };
    }).filter((row) => row.label);
    setRows((prev) => [...imported, ...prev.filter((row) => !imported.some((item) => item.id === row.id))]);
    setNotice(`Загружено поставщиков: ${imported.length}.`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <main className={`${styles.theme} ${styles.adminPage}`}>
      <div className={styles.adminTopbar}>
        <div>
          <Link href="/" className={styles.link}>Главная</Link>
          <h1 className="mt-2 text-2xl font-semibold">Поставщики трафика</h1>
          <p className="text-sm text-slate-600">База для автоподсказки: ID, название, синонимы, макросы, допустимые и дефолтные типы кодов.</p>
        </div>
        <div className={styles.toolbar}>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event)=>uploadExcel(event.target.files?.[0])} />
          <button type="button" onClick={()=>setEditing(emptyDraft)} className={`${styles.btn} ${styles.btnPrimary}`}>
            <PlusCircle className="h-4 w-4" />
            <span>Добавить поставщика</span>
          </button>
          <button type="button" onClick={()=>fileInputRef.current?.click()} className={`${styles.btn} ${styles.btnGhost}`}>
            <Upload className="h-4 w-4" />
            <span>Загрузить Excel</span>
          </button>
          <button type="button" onClick={downloadExcel} className={`${styles.btn} ${styles.btnGhost}`}>
            <Download className="h-4 w-4" />
            <span>Скачать Excel</span>
          </button>
        </div>
      </div>

      <label className={styles.codeSearch}>
        <Search className="h-4 w-4 text-slate-400" />
        <input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Поиск по ID, названию, синонимам или типу кода" />
      </label>

      {notice && <div className={styles.toast}>{notice}</div>}

      <div className={styles.tableWrap}>
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="px-3 py-2 text-xs uppercase text-slate-500 text-left">#</th>
              <th className="px-3 py-2 text-xs uppercase text-slate-500 text-left">Название</th>
              <th className="px-3 py-2 text-xs uppercase text-slate-500 text-left">Синонимы</th>
              <th className="px-3 py-2 text-xs uppercase text-slate-500 text-left">Макрос exss</th>
              <th className="px-3 py-2 text-xs uppercase text-slate-500 text-left">Макрос advid</th>
              <th className="px-3 py-2 text-xs uppercase text-slate-500 text-left">Макрос aextid</th>
              <th className="px-3 py-2 text-xs uppercase text-slate-500 text-left">Макрос bundleid</th>
              <th className="px-3 py-2 text-xs uppercase text-slate-500 text-left">Разр. типы кодов</th>
              <th className="px-3 py-2 text-xs uppercase text-slate-500 text-left">Тип по умолчанию</th>
              <th className="px-3 py-2 text-xs uppercase text-slate-500 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-sm border-t">{row.id}</td>
                <td className="px-3 py-2 text-sm border-t font-medium">{row.label}</td>
                <td className="px-3 py-2 text-sm border-t max-w-64 truncate" title={row.aliases}>{row.aliases || '—'}</td>
                <td className="px-3 py-2 text-sm border-t">{row.macroExss || '—'}</td>
                <td className="px-3 py-2 text-sm border-t">{row.macroAdvId || '—'}</td>
                <td className="px-3 py-2 text-sm border-t">{row.macroExtId || '—'}</td>
                <td className="px-3 py-2 text-sm border-t">{row.macroBundleId || '—'}</td>
                <td className="px-3 py-2 text-sm border-t max-w-72">
                  <span className="line-clamp-2">{row.allowedCodes.join(', ') || 'Любой'}</span>
                </td>
                <td className="px-3 py-2 text-sm border-t">{row.defaultCode || '—'}</td>
                <td className="px-3 py-2 text-sm border-t text-right">
                  <button type="button" onClick={()=>setEditing(row)} className={styles.iconBtn} title="Редактировать">
                    <Pencil className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="w-[720px] max-w-[calc(100vw-2rem)] rounded-lg bg-white p-5 shadow-xl">
            <div className="text-lg font-semibold">{editing.id ? 'Редактировать поставщика' : 'Добавить поставщика'}</div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm">ID<input value={editing.id} onChange={(event)=>setEditing({ ...editing, id:Number(event.target.value) || '' })} /></label>
              <label className="grid gap-1 text-sm">Название<input value={editing.label} onChange={(event)=>setEditing({ ...editing, label:event.target.value })} /></label>
              <label className="grid gap-1 text-sm md:col-span-2">Синонимы для автоподсказки<input value={editing.aliases} onChange={(event)=>setEditing({ ...editing, aliases:event.target.value })} /></label>
              <label className="grid gap-1 text-sm">Макрос exss<input value={editing.macroExss} onChange={(event)=>setEditing({ ...editing, macroExss:event.target.value })} /></label>
              <label className="grid gap-1 text-sm">Макрос advid<input value={editing.macroAdvId} onChange={(event)=>setEditing({ ...editing, macroAdvId:event.target.value })} /></label>
              <label className="grid gap-1 text-sm">Макрос aextid<input value={editing.macroExtId} onChange={(event)=>setEditing({ ...editing, macroExtId:event.target.value })} /></label>
              <label className="grid gap-1 text-sm">Макрос bundleid<input value={editing.macroBundleId} onChange={(event)=>setEditing({ ...editing, macroBundleId:event.target.value })} /></label>
              <label className="grid gap-1 text-sm md:col-span-2">Тип кода по умолчанию
                <select value={editing.defaultCode} onChange={(event)=>setEditing({ ...editing, defaultCode:event.target.value as CodeType | '' })}>
                  <option value="">Выбрать</option>
                  {editing.allowedCodes.map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-4">
              <div className="mb-2 text-sm font-medium">Допустимые типы кодов</div>
              <div className="grid max-h-56 gap-2 overflow-auto rounded-md border p-3 md:grid-cols-2">
                {CODE_TYPES.map((code) => (
                  <label key={code} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editing.allowedCodes.includes(code)} onChange={()=>toggleAllowed(code)} />
                    <span>{code}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={()=>setEditing(null)} className={`${styles.btn} ${styles.btnGhost}`}>Отмена</button>
              <button type="button" onClick={saveDraft} className={`${styles.btn} ${styles.btnPrimary}`}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
