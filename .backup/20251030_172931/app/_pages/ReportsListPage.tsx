'use client';
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { listOrders, deleteOrder, type ReportOrder } from "@/lib/reports";

export default function ReportsListPage(){
  const [data, setData] = useState<ReportOrder[]>([]);
  useEffect(()=> setData(listOrders()), []);
  const remove = (id:string)=>{ deleteOrder(id); setData(listOrders()); };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-2xl font-bold">Список отчётов</div>
        <Link href="/builder" className="rounded-full bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700">Заказать отчёт</Link>
      </div>

      <div className="rounded-xl border bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="bg-gray-100 p-2 text-left">Название</th>
              <th className="bg-gray-100 p-2 text-left">Период</th>
              <th className="bg-gray-100 p-2 text-left">Измерения</th>
              <th className="bg-gray-100 p-2 text-left">Метрики</th>
              <th className="bg-gray-100 p-2 text-left">Статус</th>
              <th className="bg-gray-100 p-2 text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {data.map(r=>(
              <tr key={r.id} className="odd:bg-white even:bg-gray-50">
                <td className="border-t p-2">{r.name}</td>
                <td className="border-t p-2">{r.filters.period?.from} → {r.filters.period?.to}</td>
                <td className="border-t p-2">{r.dims.join(", ")}</td>
                <td className="border-t p-2">{r.metrics.join(", ")}</td>
                <td className="border-t p-2">{r.status}</td>
                <td className="border-t p-2 text-right">
                  <button className="mr-2 rounded-full bg-white px-3 py-1 text-xs text-sky-700 ring-1 ring-sky-600 hover:bg-sky-50">Скачать</button>
                  <button onClick={()=>remove(r.id)} className="rounded-full bg-white px-3 py-1 text-xs text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50">Удалить</button>
                </td>
              </tr>
            ))}
            {data.length===0 && <tr><td colSpan={6} className="py-8 text-center text-gray-500">Заказов пока нет</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
