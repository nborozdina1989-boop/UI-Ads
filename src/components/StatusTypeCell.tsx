"use client";
import React from "react";
import { Handshake, House } from "lucide-react";

type Props = { type?: string; status?: string; };

export default function StatusTypeCell({ type, status }: Props) {
  const s = String(status || "").trim().toLowerCase();
  const enabled = s === "включена" || s === "активна" || s === "enabled" || s === "active";
  const dot = enabled ? "bg-[color:var(--adr-green)]" : "bg-slate-300";
  const t = String(type || "").trim().toLowerCase();
  const isDeleg = t.startsWith("дел");

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block h-3 w-3 rounded-full ${dot}`}
        title={status || ""}
        aria-label={status || ""}
      />
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--adr-light-blue)]/10 text-[color:var(--adr-blue)] ring-1 ring-[color:var(--adr-light-blue)]/50"
        title={type || ""}
        aria-label={type || ""}
      >
        {isDeleg ? <Handshake className="h-3 w-3" strokeWidth={2} /> : <House className="h-3 w-3" strokeWidth={2} />}
      </span>
    </div>
  );
}
