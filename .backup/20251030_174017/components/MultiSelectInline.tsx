'use client';
import React, { useMemo, useRef, useState } from 'react';

export function MultiSelectInline({
  label,
  options,
  values,
  onChange,
  placeholder = 'Выбрать…',
}: {
  label: string;
  options: string[];
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [needle, setNeedle] = useState('');
  const box = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const n = needle.trim().toLowerCase();
    return n ? options.filter(o => o.toLowerCase().includes(n)) : options;
  }, [needle, options]);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!box.current) return;
      if (!box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const toggleVal = (v: string) => {
    const has = values.includes(v);
    onChange(has ? values.filter(x => x !== v) : [...values, v]);
  };

  const clear = () => onChange([]);

  return (
    <div className="relative" ref={box}>
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <button
        type="button"
        onClick={() => setOpen(s => !s)}
        className="border border-gray-300 rounded px-3 py-2 text-left w-[280px] bg-white hover:border-gray-400"
      >
        {values.length ? `${values.length} выбрано` : placeholder}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-[320px] rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <input
              value={needle}
              onChange={e => setNeedle(e.target.value)}
              placeholder="Поиск…"
              className="w-full border rounded px-2 py-1 text-sm outline-none focus:border-gray-400"
            />
          </div>
          <div className="max-h-64 overflow-auto">
            {filtered.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">Ничего не найдено</div>
            ) : filtered.map(o => {
              const checked = values.includes(o);
              return (
                <label key={o} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleVal(o)}
                  />
                  <span className="truncate">{o}</span>
                </label>
              );
            })}
          </div>
          <div className="flex items-center justify-between p-2 border-t border-gray-100">
            <button
              type="button"
              onClick={clear}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Очистить
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Сохранить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
