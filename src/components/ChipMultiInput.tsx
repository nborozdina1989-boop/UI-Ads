"use client";
import React, { useMemo, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
};

function splitCSV(s: string): string[] {
  return (s || "")
    .split(/[,\s;]+/)
    .map(x => x.trim())
    .filter(Boolean);
}

export default function ChipMultiInput({ value, onChange, placeholder, className }: Props) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const tokens = useMemo(() => Array.from(new Set(splitCSV(value))), [value]);

  const commit = (arr: string[]) => onChange(arr.join(", "));

  const addToken = (raw: string) => {
    const parts = splitCSV(raw);
    if (!parts.length) return;
    commit(Array.from(new Set([...tokens, ...parts])));
    setDraft("");
  };

  const removeToken = (t: string) => {
    commit(tokens.filter(x => x !== t));
    inputRef.current?.focus();
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (["Enter","Tab"].includes(e.key) || [",",";"].includes(e.key) || (e.key===" " && draft.trim())) {
      e.preventDefault();
      addToken(draft);
    } else if (e.key==="Backspace" && draft==="" && tokens.length>0) {
      e.preventDefault();
      removeToken(tokens[tokens.length-1]);
    }
  };

  const base = "min-w-[120px] rounded-xl border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-sky-400 focus:ring-0";
  return (
    <div className={`${base} ${className||""} flex flex-wrap gap-1 items-center`} onClick={() => inputRef.current?.focus()}>
      {tokens.map(t => (
        <span key={t} className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200">
          {t}
          <button type="button" aria-label="Удалить" className="ml-1 text-slate-500 hover:text-slate-700" onClick={() => removeToken(t)}>×</button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={draft}
        onChange={(e)=>setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={tokens.length ? "" : placeholder}
        className="flex-1 min-w-[60px] border-0 outline-none text-sm placeholder-slate-400"
      />
    </div>
  );
}
