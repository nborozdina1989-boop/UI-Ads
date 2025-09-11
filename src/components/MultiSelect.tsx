'use client';
import React, { useEffect, useMemo, useRef, useState } from "react";

export type Option = { value: string; label: string; hint?: string };

export default function MultiSelect({
  options, selected, onChange, placeholder="Выберите...", className=""
}:{
  options: Option[];
  selected: string[];
  onChange: (v:string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const onDoc = (e:MouseEvent) => { if(ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e:KeyboardEvent) => { if(e.key==="Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return ()=>{ document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  },[]);

  const filtered = useMemo(()=>{
    const q = query.trim().toLowerCase();
    if(!q) return options;
    return options.filter(o => (o.label+" "+(o.hint||"")).toLowerCase().includes(q));
  },[options, query]);

  const allVisibleSelected = filtered.every(o => selected.includes(o.value)) && filtered.length>0;

  const toggle = (val:string) => onChange(
    selected.includes(val) ? selected.filter(v=>v!==val) : [...selected, val]
  );
  const selectVisible = () => onChange(Array.from(new Set([...selected, ...filtered.map(o=>o.value)])));
  const clearVisible  = () => onChange(selected.filter(v => !filtered.map(o=>o.value).includes(v)));

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={()=>setOpen(v=>!v)}
        className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-gray-50">
        <span className="truncate">
          {selected.length>0 ? `Выбрано: ${selected.length}` : placeholder}
        </span>
        <svg className="ml-2 h-4 w-4 opacity-60" viewBox="0 0 20 20"><path d="M5 7l5 6 5-6H5z" /></svg>
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg">
          <div className="p-2">
            <input value={query} onChange={e=>setQuery(e.target.value)} autoFocus
                   placeholder="Поиск…" className="w-full rounded-md border px-2 py-1.5 text-sm" />
          </div>
          <div className="max-h-64 overflow-auto">
            {filtered.map(o=>(
              <label key={o.value} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50">
                <input type="checkbox" checked={selected.includes(o.value)} onChange={()=>toggle(o.value)} />
                <span className="truncate">{o.label}</span>
                {o.hint && <span className="ml-auto text-xs text-gray-500">{o.hint}</span>}
              </label>
            ))}
            {filtered.length===0 && <div className="px-3 py-2 text-sm text-gray-500">Ничего не найдено</div>}
          </div>
          <div className="flex items-center justify-between border-t p-2 text-xs">
            <button onClick={selectVisible} className="rounded px-2 py-1 hover:bg-gray-50">Выбрать видимые</button>
            <button onClick={clearVisible}  className="rounded px-2 py-1 hover:bg-gray-50">Снять видимые</button>
          </div>
        </div>
      )}
    </div>
  );
}
