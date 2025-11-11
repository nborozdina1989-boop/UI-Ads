"use client";
import React from "react";

type Props = { type?: string; status?: string; };

export default function StatusTypeCell({ type, status }: Props) {
  const s = String(status || "").trim().toLowerCase();
  const enabled = s === "включена" || s === "активна" || s === "enabled" || s === "active";
  const dot = enabled ? "bg-emerald-500" : "bg-slate-300";
  const t = String(type || "").trim().toLowerCase();
  const isDeleg = t.startsWith("дел");
  const icon = isDeleg ? "🤝" : "🏠";

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block h-3 w-3 rounded-full ${dot}`}
        title={status || ""}
        aria-label={status || ""}
      />
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-50 ring-1 ring-sky-200 text-sky-700 text-xs"
        title={type || ""}
        aria-label={type || ""}
      >
        {icon}
      </span>
    </div>
  );
}
