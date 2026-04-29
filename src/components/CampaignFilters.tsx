"use client";
import React, { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Star } from "lucide-react";

type GroupMode = "none" | "brand" | "adv" | "tree";
type SortMode =
  | "created_desc" | "created_asc" | "name_asc" | "name_desc"
  | "imps_desc" | "imps_asc"
  | "clicks_desc" | "clicks_asc"
  | "ctr_desc" | "ctr_asc";

type SearchInputProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suggestions?: string[];
  className?: string;
};
function SearchInput({ value, onChange, placeholder, suggestions, className }: SearchInputProps) {
  const id = suggestions ? `si-${(placeholder || "").replace(/\s+/g, "-").toLowerCase()}` : undefined;
  return (
    <div className={`min-w-0 rounded-xl border border-[color:var(--adr-border)] px-2 py-1.5 ${className || ""}`}>
      <input
        list={suggestions ? id : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || ""}
        className="w-full min-w-0 bg-transparent outline-none text-sm text-[color:var(--adr-text)] placeholder:text-[color:var(--adr-text-muted)]"
      />
      {suggestions && (
        <datalist id={id}>
          {suggestions.map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
    </div>
  );
}

interface Props {
  q: string;
  onQChange: (v: string) => void;
  own: boolean;
  onOwnChange: (v: boolean) => void;
  delegated: boolean;
  onDelegatedChange: (v: boolean) => void;
  status: "all" | "active" | "inactive";
  onStatusChange: (v: "all" | "active" | "inactive") => void;
  favOnly: boolean;
  onFavChange: (v: boolean) => void;
  groupMode: GroupMode;
  onGroupChange: (v: GroupMode) => void;
  sort: SortMode;
  onSortChange: (v: SortMode) => void;

  idFilter: string;
  onIdFilterChange: (v: string) => void;
  brandFilter: string;
  onBrandFilterChange: (v: string) => void;
  advFilter: string;
  onAdvFilterChange: (v: string) => void;
  tagFilter: string;
  onTagFilterChange: (v: string) => void;
  measFilter: string;
  onMeasFilterChange: (v: string) => void;
  allMeasures: string[];
  idOptions?: string[];
  brandOptions?: string[];
  advOptions?: string[];
  tagOptions?: string[];

  onReset: () => void;
}

export default function CampaignFilters(props: Props) {
  const {
    q,onQChange,own,onOwnChange,delegated,onDelegatedChange,
    status,onStatusChange,favOnly,onFavChange,
    groupMode,onGroupChange,sort,onSortChange,
    idFilter,onIdFilterChange,brandFilter,onBrandFilterChange,
    advFilter,onAdvFilterChange,tagFilter,onTagFilterChange,
    measFilter,onMeasFilterChange,allMeasures,
    idOptions = [], brandOptions = [], advOptions = [], tagOptions = [],
    onReset
  } = props;

  const [showAdvanced, setShowAdvanced] = useState(false);
  const btnBase = "rounded-full px-3 py-1.5 text-sm transition-colors";
  const btnOff = "bg-white text-[color:var(--adr-text)] hover:bg-[color:var(--adr-light-blue)]/10 border border-[color:var(--adr-border)]";
  const btnOn  = "bg-[color:var(--adr-light-blue)]/12 text-[color:var(--adr-blue)] border border-[color:var(--adr-light-blue)]/60";

  return (
    <div className="mb-4 rounded-2xl border border-[color:var(--adr-border)] bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => onQChange(e.target.value)}
          placeholder="Поиск по названию / ID / бренду / рекламодателю"
          className="min-w-0 flex-[1_1_260px] rounded-xl border border-[color:var(--adr-border)] px-3 py-2 text-sm text-[color:var(--adr-text)] outline-none focus:border-[color:var(--adr-light-blue)] focus:ring-0"
        />
        <button
          type="button"
          onClick={() => setShowAdvanced((p) => !p)}
          className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm text-[color:var(--adr-text)] border border-[color:var(--adr-border)] hover:bg-[color:var(--adr-light-blue)]/10"
        >
          {showAdvanced ? "Скрыть фильтры" : "Фильтры"}
          {showAdvanced ? <ChevronUp className="h-3.5 w-3.5 text-[color:var(--adr-blue)]" /> : <ChevronDown className="h-3.5 w-3.5 text-[color:var(--adr-blue)]" />}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="text-sm text-[color:var(--adr-blue)] hover:text-[color:var(--adr-dark-blue)]"
        >
          Сбросить
        </button>
        <Link
          href="/mediaplan/upload"
          className="rounded-full bg-[color:var(--adr-blue)] px-3 py-1.5 text-sm text-white hover:bg-[color:var(--adr-dark-blue)] whitespace-nowrap sm:ml-auto"
        >
          Добавить медиаплан
        </Link>
      </div>

      {showAdvanced && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => onOwnChange(!own)} className={`${btnBase} ${own ? btnOn : btnOff}`}>Свои</button>
            <button type="button" onClick={() => onDelegatedChange(!delegated)} className={`${btnBase} ${delegated ? btnOn : btnOff}`}>Делегированные</button>
            <button type="button" onClick={() => onStatusChange(status === "active" ? "all" : "active")} className={`${btnBase} ${status === "active" ? btnOn : btnOff}`}>Включенные</button>
            <button type="button" onClick={() => onStatusChange(status === "inactive" ? "all" : "inactive")} className={`${btnBase} ${status === "inactive" ? btnOn : btnOff}`}>Завершенные</button>
            <button type="button" onClick={() => onFavChange(!favOnly)} className={`${btnBase} ${favOnly ? btnOn : btnOff} flex items-center gap-1`}>
              <Star className={`h-3.5 w-3.5 ${favOnly ? "text-[color:var(--adr-green)] fill-[color:var(--adr-green)]" : "text-[color:var(--adr-text-muted)]"}`} />
              Избранное
            </button>

            <select value={groupMode} onChange={(e) => onGroupChange(e.target.value as GroupMode)} className="min-w-0 max-w-full rounded-xl border border-[color:var(--adr-border)] px-3 py-1.5 text-sm text-[color:var(--adr-text)] focus:border-[color:var(--adr-light-blue)]">
              <option value="none">Без группировки</option>
              <option value="brand">Бренд</option>
              <option value="adv">Рекламодатель</option>
              <option value="tree">Иерархия</option>
            </select>

            <select value={sort} onChange={(e) => onSortChange(e.target.value as SortMode)} className="min-w-0 max-w-full rounded-xl border border-[color:var(--adr-border)] px-3 py-1.5 text-sm text-[color:var(--adr-text)] focus:border-[color:var(--adr-light-blue)]">
              <option value="created_desc">Сначала новые</option>
              <option value="created_asc">Сначала старые</option>
              <option value="name_asc">Название A→Z</option>
              <option value="name_desc">Название Z→A</option>
              <option value="imps_desc">Показы ↓</option>
              <option value="imps_asc">Показы ↑</option>
              <option value="clicks_desc">Клики ↓</option>
              <option value="clicks_asc">Клики ↑</option>
              <option value="ctr_desc">CTR ↓</option>
              <option value="ctr_asc">CTR ↑</option>
            </select>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-[color:var(--adr-text-muted)] pr-2">Доп. поиск:</span>
            <SearchInput value={idFilter} onChange={onIdFilterChange} placeholder="ID" className="w-full sm:w-[160px]" suggestions={idOptions} />
            <SearchInput value={brandFilter} onChange={onBrandFilterChange} placeholder="Бренд" className="w-full sm:w-[180px]" suggestions={brandOptions} />
            <SearchInput value={advFilter} onChange={onAdvFilterChange} placeholder="Рекламодатель" className="w-full sm:w-[200px]" suggestions={advOptions} />
            <SearchInput value={tagFilter} onChange={onTagFilterChange} placeholder="Поиск по тегам" className="w-full sm:w-[220px]" suggestions={tagOptions} />
            <SearchInput value={measFilter} onChange={onMeasFilterChange} placeholder="Тип измерения" suggestions={allMeasures} className="w-full sm:w-[220px]" />
          </div>
        </>
      )}
    </div>
  );
}
