"use client";
import React, {useRef, useState} from "react";

type Props = {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  className?: string;
};
export default function TokenInput({ values, onChange, placeholder, suggestions, className }: Props){
  const [text, setText] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const commit = (raw: string) => {
    const parts = raw.split(/[,\s;]+/).map(s=>s.trim()).filter(Boolean);
    if(!parts.length) return;
    const set = new Set(values);
    parts.forEach(p=>set.add(p));
    onChange(Array.from(set));
    setText("");
  };
  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if(e.key==="Enter" || e.key===","){ e.preventDefault(); commit(text); }
    if(e.key==="Backspace" && text==="" && values.length){ onChange(values.slice(0,-1)); }
  };
  const removeAt = (i:number)=>{ const n=values.slice(); n.splice(i,1); onChange(n); ref.current?.focus(); };
  const listId = suggestions ? `ti-${(placeholder||"").replace(/\s+/g,"-")}` : undefined;
  return (
    <div className={`min-w-[140px] flex items-center flex-wrap gap-1 rounded-xl border border-slate-200 px-2 py-1.5 ${className||""}`}>
      {values.map((v,i)=>(
        <span key={`${v}-${i}`} className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          {v}
          <button onClick={()=>removeAt(i)} className="ml-1 text-slate-500 hover:text-slate-700">×</button>
        </span>
      ))}
      <input
        ref={ref}
        list={listId}
        value={text}
        onChange={(e)=>setText(e.target.value)}
        onBlur={()=>commit(text)}
        onKeyDown={onKeyDown}
        placeholder={values.length? "" : (placeholder||"")}
        className="flex-1 min-w-[80px] outline-none text-sm placeholder:text-slate-400"
      />
      {suggestions && <datalist id={listId}>{suggestions.map(s=><option key={s} value={s}/>)}</datalist>}
    </div>
  );
}
