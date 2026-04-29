"use client";
import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function CampaignsDeletedPage() {
  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-2xl font-bold">Удалённые кампании</div>
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1 rounded-full bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>К списку РК</span>
        </Link>
      </div>
      <p className="text-gray-500 text-sm max-w-2xl">
        В этой версии прототипа модуль «Удалённые кампании» отключён. Мы оставляем только основной сценарий работы со
        списком РК (все группировки, выбор чекбоксами, архив, избранное, загрузку медиаплана).
      </p>
    </div>
  );
}
