'use client';
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listSchedules, saveSchedule, deleteSchedule, type Schedule } from "@/lib/reports";

export default function ReportsSchedulePage(){
  const [items, setItems] = useState<Schedule[]>([]);
  const [emails, setEmails] = useState<string>("user@domain.ru");
  const [freq, setFreq] = useState<Schedule["freq"]>("Ежедневно");

  useEffect(()=> setItems(listSchedules()), []);

  const create = ()=>{
    const s:Schedule = {
      id: "s"+Date.now(),
      name: `task_${new Date().toISOString().slice(0,10)}`,
      freq, emails: emails.split(/[,;\s]+/).filter(Boolean),
      enabled: true,
      createdAt: new Date().toISOString()
    };
    saveSchedule(s);
    setItems(listSchedules());
  };
  const toggle = (id:string)=> {
    const arr = listSchedules();
    const i = arr.findIndex(x=>x.id===id);
    if(i>=0){ arr[i].enabled=!arr[i].enabled; localStorage.setItem("adriver/reports/schedule", JSON.stringify(arr)); setItems(arr); }
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-2xl font-bold">Расписание</div>
        <Link href="/builder" className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm text-sky-700 ring-1 ring-sky-600 hover:bg-sky-50">
          <ArrowLeft className="h-4 w-4" />
          <span>К конструктору</span>
        </Link>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div>
          <div className="mb-1 text-xs font-medium uppercase text-gray-500">Расписание</div>
          <select value={freq} onChange={e=>setFreq(e.target.value as Schedule["freq"])}
                  className="w-full rounded-md border px-3 py-2 text-sm">
            <option>Ежедневно</option><option>Раз в неделю</option><option>Раз в месяц</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <div className="mb-1 text-xs font-medium uppercase text-gray-500">E-mail</div>
          <input value={emails} onChange={e=>setEmails(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm"
                 placeholder="user@domain.ru, user2@domain.ru"/>
          <div className="mt-2 rounded-lg bg-sky-50 p-2 text-xs text-sky-900">
            Первый отчёт придёт завтра в 09:00 по московскому времени.
          </div>
        </div>
      </div>

      <button onClick={create} className="mb-4 rounded-full bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700">
        Создать задачу
      </button>

      <div className="rounded-xl border bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="bg-gray-100 p-2 text-left">Название задачи</th>
              <th className="bg-gray-100 p-2 text-left">Частота</th>
              <th className="bg-gray-100 p-2 text-left">E-mail</th>
              <th className="bg-gray-100 p-2 text-left">ID</th>
              <th className="bg-gray-100 p-2 text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {items.map(s=>(
              <tr key={s.id} className="odd:bg-white even:bg-gray-50">
                <td className="border-t p-2">{s.name}</td>
                <td className="border-t p-2">{s.freq}</td>
                <td className="border-t p-2">{s.emails.join(", ")}</td>
                <td className="border-t p-2">{s.id.slice(1)}</td>
                <td className="border-t p-2 text-right">
                  <label className="mr-2 inline-flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={s.enabled} onChange={()=>toggle(s.id)} />
                    Активна
                  </label>
                  <button onClick={()=>{ deleteSchedule(s.id); setItems(listSchedules()); }}
                          className="rounded-full bg-white px-3 py-1 text-xs text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50">
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
            {items.length===0 && <tr><td colSpan={5} className="py-8 text-center text-gray-500">Задач пока нет</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
