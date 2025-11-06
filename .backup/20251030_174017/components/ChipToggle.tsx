'use client';
import React from 'react';

type Opt<T extends string> = { label: string; value: T };

export function ChipToggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: Opt<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {label ? <span className="text-sm text-gray-500">{label}</span> : null}
      <div className="flex flex-wrap gap-1">
        {options.map(o => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={`px-2 py-1 text-sm rounded-full border transition
                ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'}
              `}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
