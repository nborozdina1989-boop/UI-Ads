'use client';
import React from 'react';
import { Plus, X } from "lucide-react";

type Props = {
  tags: string[];
  onAdd?: () => void;
  onRemove?: (t: string) => void;
  onClickTag?: (t: string) => void;
};

export default function TagPills({ tags, onAdd, onRemove, onClickTag }: Props) {
  if (!tags || tags.length === 0) {
    return (
      <div className="mt-1 flex flex-wrap gap-1">
        {onAdd && (
          <button
            onClick={onAdd}
            className="inline-flex items-center justify-center rounded-full bg-white text-[color:var(--adr-blue)] ring-1 ring-[color:var(--adr-light-blue)]/80 px-2 py-0.5 hover:bg-[color:var(--adr-light-blue)]/10"
            aria-label="Добавить тег"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {tags.map((t) => (
        <span
          key={t}
          className="group inline-flex items-center rounded-full bg-[color:var(--adr-light-blue)]/10 px-2 py-0.5 text-xs text-[color:var(--adr-blue)] ring-1 ring-[color:var(--adr-light-blue)]/40 hover:bg-[color:var(--adr-light-blue)]/20"
          title="Нажми для фильтра"
        >
          <button
            onClick={() => onClickTag && onClickTag(t)}
            className="outline-none"
          >
            {t}
          </button>
          {onRemove && (
            <button
              onClick={() => onRemove(t)}
              className="ml-1 leading-none opacity-0 group-hover:opacity-100"
              aria-label="Удалить тег"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      {onAdd && (
        <button
          onClick={onAdd}
          className="inline-flex items-center justify-center rounded-full bg-white text-[color:var(--adr-blue)] ring-1 ring-[color:var(--adr-light-blue)]/80 px-2 py-0.5 hover:bg-[color:var(--adr-light-blue)]/10"
          aria-label="Добавить тег"
        >
          <Plus className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
