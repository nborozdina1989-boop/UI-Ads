'use client';
import React from "react";
export default function TagPills({ tags }:{ tags:string[] }) {
  if (!tags?.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {tags.map(t=>(
        <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">#{t}</span>
      ))}
    </div>
  );
}
