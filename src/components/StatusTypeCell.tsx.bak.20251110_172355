import React from "react";

export default function StatusTypeCell({
  type,
  status,
}: { type: string; status: string }) {
  const isDeleg = type === "Делегированная";
  const isActive = status === "Активна";
  return (
    <div className="flex items-center gap-1" title={`${type}; ${status}`} aria-label={`${type}; ${status}`}>
      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[12px] ${isDeleg ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"}`}>
        {isDeleg ? "🤝" : "🏠"}
      </span>
      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[12px] ${isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"}`}>
        {isActive ? "●" : "○"}
      </span>
    </div>
  );
}
