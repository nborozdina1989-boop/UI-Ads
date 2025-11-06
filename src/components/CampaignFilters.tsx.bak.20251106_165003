"use client";
import React, { useState } from "react";
import Link from "next/link";

type GroupMode = "none" | "brand" | "adv" | "tree";
type SortMode = "created_desc" | "created_asc" | "name_asc" | "name_desc";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;

  tags: string;
  onTagsChange: (v: string) => void;

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

  // НОВОЕ: отдельные поиски
  searchId: string;
  onSearchIdChange: (v: string) => void;

  searchName: string;
  onSearchNameChange: (v: string) => void;

  searchBrand: string;
  onSearchBrandChange: (v: string) => void;

  searchAdvertiser: string;
  onSearchAdvertiserChange: (v: string) => void;

  onReset: () => void;
}

export default function CampaignFilters({
  search,
  onSearchChange,
  tags,
  onTagsChange,
  own,
  onOwnChange,
  delegated,
  onDelegatedChange,
  status,
  onStatusChange,
  favOnly,
  onFavChange,
  groupMode,
  onGroupChange,
  sort,
  onSortChange,
  searchId,
  onSearchIdChange,
  searchName,
  onSearchNameChange,
  searchBrand,
  onSearchBrandChange,
  searchAdvertiser,
  onSearchAdvertiserChange,
  onReset,
}: Props) {
  const [showAdvanced, setShowAdvanced] = useState(true); // по умолчанию сейчас открыто, как на скрине

  const btnBase =
    "rounded-full px-3 py-1.5 text-sm transition-colors";
  const btnOff = "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200";
  const btnOn = "bg-sky-50 text-sky-700 border border-sky-200";

  return (
    <div className="mb-4 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
      {/* ряд 1 */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Поиск по названию / ID / бренду / рекламодателю"
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-0"
        />

        <button
          type="button"
          onClick={() => setShowAdvanced((p) => !p)}
          className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm text-slate-700 border border-slate-200 hover:bg-slate-50"
        >
          {showAdvanced ? "Скрыть фильтры" : "Фильтры"}
          <span className="text-xs">{showAdvanced ? "▴" : "▾"}</span>
        </button>

        <button
          type="button"
          onClick={onReset}
          className="text-sm text-sky-600 hover:text-sky-700"
        >
          Сбросить
        </button>

        <Link
          href="/mediaplan/upload"
          className="ml-auto rounded-full bg-sky-600 px-3 py-1.5 text-sm text-white hover:bg-sky-700 whitespace-nowrap"
        >
          Добавить медиаплан
        </Link>
      </div>

      {/* ряд 2 (кнопки) */}
      {showAdvanced && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOwnChange(!own)}
              className={`${btnBase} ${own ? btnOn : btnOff}`}
            >
              Свои
            </button>
            <button
              type="button"
              onClick={() => onDelegatedChange(!delegated)}
              className={`${btnBase} ${delegated ? btnOn : btnOff}`}
            >
              Делегированные
            </button>

            <button
              type="button"
              onClick={() =>
                onStatusChange(status === "active" ? "all" : "active")
              }
              className={`${btnBase} ${status === "active" ? btnOn : btnOff}`}
            >
              Активные
            </button>
            <button
              type="button"
              onClick={() =>
                onStatusChange(status === "inactive" ? "all" : "inactive")
              }
              className={`${btnBase} ${status === "inactive" ? btnOn : btnOff}`}
            >
              Не активные
            </button>

            <button
              type="button"
              onClick={() => onFavChange(!favOnly)}
              className={`${btnBase} ${favOnly ? btnOn : btnOff} flex items-center gap-1`}
            >
              <span>⭐</span> Избранное
            </button>

            <input
              value={tags}
              onChange={(e) => onTagsChange(e.target.value)}
              placeholder="Теги (через запятую)"
              className="min-w-[180px] rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-sky-400 focus:ring-0"
            />

            <select
              value={groupMode}
              onChange={(e) => onGroupChange(e.target.value as GroupMode)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:border-sky-400"
            >
              <option value="none">Без группировки</option>
              <option value="brand">Бренд</option>
              <option value="adv">Рекламодатель</option>
              <option value="tree">Иерархия</option>
            </select>

            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value as SortMode)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:border-sky-400"
            >
              <option value="created_desc">Сначала новые</option>
              <option value="created_asc">Сначала старые</option>
              <option value="name_asc">Название A→Z</option>
              <option value="name_desc">Название Z→A</option>
            </select>
          </div>

          {/* ряд 3 — отдельные поиски */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 pr-2">Доп. поиск:</span>

            <input
              value={searchId}
              onChange={(e) => onSearchIdChange(e.target.value)}
              placeholder="ID"
              className="w-[90px] rounded-xl border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-sky-400"
            />
            <input
              value={searchName}
              onChange={(e) => onSearchNameChange(e.target.value)}
              placeholder="РК"
              className="w-[150px] rounded-xl border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-sky-400"
            />
            <input
              value={searchBrand}
              onChange={(e) => onSearchBrandChange(e.target.value)}
              placeholder="Бренд"
              className="w-[140px] rounded-xl border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-sky-400"
            />
            <input
              value={searchAdvertiser}
              onChange={(e) => onSearchAdvertiserChange(e.target.value)}
              placeholder="Рекламодатель"
              className="w-[160px] rounded-xl border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-sky-400"
            />
          </div>
        </>
      )}
    </div>
  );
}
