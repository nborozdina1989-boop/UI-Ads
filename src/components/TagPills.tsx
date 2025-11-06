'use client';
import React from 'react';

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
            className="rounded-full bg-white text-xs text-sky-600 ring-1 ring-sky-400 px-2 py-0.5 hover:bg-sky-50"
            aria-label="Добавить тег"
          >
            +
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
          className="group inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700 ring-1 ring-sky-200 hover:bg-sky-100"
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
              ×
            </button>
          )}
        </span>
      ))}
      {onAdd && (
        <button
          onClick={onAdd}
          className="rounded-full bg-white text-xs text-sky-600 ring-1 ring-sky-400 px-2 py-0.5 hover:bg-sky-50"
          aria-label="Добавить тег"
        >
          +
        </button>
      )}
    </div>
  );
}
