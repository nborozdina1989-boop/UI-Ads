"use client";

import React from "react";

type Props = {
  activeGroup?: "tree" | "list";
  onGroupChange?: (v: "tree" | "list") => void;
  fav?: boolean;
  own?: boolean;
  deleg?: boolean;
  onToggleFav?: () => void;
  onToggleOwn?: () => void;
  onToggleDeleg?: () => void;
  sort?: string;
  onSortChange?: (v: string) => void;
};

export default function CampaignFilters({
  activeGroup = "tree",
  onGroupChange,
  fav = false,
  own = false,
  deleg = false,
  onToggleFav,
  onToggleOwn,
  onToggleDeleg,
  sort = "created_desc",
  onSortChange,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2 items-center justify-between mb-4">
      <div className="flex gap-2">
        <button
          onClick={() => onGroupChange && onGroupChange("tree")}
          className={`px-3 py-1 rounded-[var(--adr-radius-sm)] text-sm ${
            activeGroup === "tree"
              ? "bg-[var(--adr-blue)] text-white"
              : "bg-white text-[var(--adr-text)] border border-[var(--adr-border)]"
          }`}
        >
          Иерархия
        </button>
        <button
          onClick={() => onGroupChange && onGroupChange("list")}
          className={`px-3 py-1 rounded-[var(--adr-radius-sm)] text-sm ${
            activeGroup === "list"
              ? "bg-[var(--adr-blue)] text-white"
              : "bg-white text-[var(--adr-text)] border border-[var(--adr-border)]"
          }`}
        >
          Список
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onToggleFav}
          className={`px-3 py-1 rounded-[var(--adr-radius-sm)] text-sm border ${
            fav
              ? "bg-[var(--adr-green)] border-[var(--adr-green)] text-[#002E6D]"
              : "bg-white border-[var(--adr-border)] text-[var(--adr-text)]"
          }`}
        >
          Избранное
        </button>
        <button
          onClick={onToggleOwn}
          className={`px-3 py-1 rounded-[var(--adr-radius-sm)] text-sm border ${
            own
              ? "bg-[var(--adr-blue)] border-[var(--adr-blue)] text-white"
              : "bg-white border-[var(--adr-border)] text-[var(--adr-text)]"
          }`}
        >
          Мои
        </button>
        <button
          onClick={onToggleDeleg}
          className={`px-3 py-1 rounded-[var(--adr-radius-sm)] text-sm border ${
            deleg
              ? "bg-[var(--adr-light-blue)] border-[var(--adr-light-blue)] text-[var(--adr-dark-blue)]"
              : "bg-white border-[var(--adr-border)] text-[var(--adr-text)]"
          }`}
        >
          Делегированные
        </button>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--adr-text-muted)]">
          Сортировка
        </label>
        <select
          value={sort}
          onChange={(e) => onSortChange && onSortChange(e.target.value)}
          className="text-sm border border-[var(--adr-border)] rounded-[var(--adr-radius-sm)] px-2 py-1 bg-white"
        >
          <option value="created_desc">По дате создания (новые сверху)</option>
          <option value="created_asc">По дате создания (старые сверху)</option>
          <option value="name_asc">По названию (A→Я)</option>
        </select>
      </div>
    </div>
  );
}
