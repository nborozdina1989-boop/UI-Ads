"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listCampaigns, listGroups, toggleFavGroup, deleteGroup, type Group } from "@/lib/campaigns";

// универсальная круглая иконка-кнопка (как на вкладке РК)
function IconBtn({
  label,
  title,
  href,
  onClick,
}: {
  label: string;
  title: string;
  href?: string;
  onClick?: () => void;
}) {
  const cls = "h-9 w-9 rounded-full border flex items-center justify-center hover:bg-gray-50";
  const inner = <span className="text-lg leading-none">{label}</span>;
  return href ? (
    <Link href={href} className={cls} aria-label={title} title={title}>
      {inner}
    </Link>
  ) : (
    <button className={cls} aria-label={title} title={title} onClick={onClick}>
      {inner}
    </button>
  );
}

type SortKey = "new"|"old"|"name_asc"|"name_desc";
const sortGroups = (arr:Group[], by:SortKey) => {
  const cmp = {
    new:       (a:Group,b:Group)=> b.createdAt.localeCompare(a.createdAt) || a.name.localeCompare(b.name),
    old:       (a:Group,b:Group)=> a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name),
    name_asc:  (a:Group,b:Group)=> a.name.localeCompare(b.name),
    name_desc: (a:Group,b:Group)=> b.name.localeCompare(a.name),
  }[by];
  return [...arr].sort(cmp);
};

import TabsNav from "./_TabsNav";
export default function CampaignGroupsPage(){
  const [mounted, setMounted] = useState(false);
  useEffect(()=>{ setMounted(true); }, []);

  const [groups, setGroups] = useState<Group[]>([]);
  useEffect(()=>{ if(mounted){ setGroups(listGroups()); } }, [mounted]);

  const [q, setQ] = useState("");
  const [onlyFav, setOnlyFav] = useState(false);
  const [sort, setSort] = useState<SortKey>("new");

  const filtered = useMemo(()=>{
    const needle = q.trim().toLowerCase();
    const base = (onlyFav ? groups.filter(g=>g.fav) : groups);
    return !needle ? base : base.filter(g =>
      g.name.toLowerCase().includes(needle) || (g.hrid||"").toLowerCase().includes(needle)
    );
  }, [groups, q, onlyFav]);

  const shown = useMemo(()=> sortGroups(filtered, sort), [filtered, sort]);
  const idsToQuery = (ids:number[]) => ids.join(",");

  if(!mounted){
    return (
      <div className="mx-auto max-w-7xl p-6">
        <h1 className="text-2xl font-semibold mb-4">Группы</h1>
        <div className="rounded-2xl border bg-white p-8 text-gray-500">Загрузка…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <header className="space-y-3">
        {/* Заголовок + кнопка возврата */}
        <div className="flex items-center justify-between">
          <TabsNav active="groups" /><h1 className="text-2xl font-semibold">Группы</h1>
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50"
            aria-label="Вернуться к списку рекламных кампаний"
            title="Вернуться к списку РК"
          >
          </Link>
        </div>

        {/* Панель поиска/фильтров/сортировки */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Поиск</span>
            <input
              value={q}
              onChange={e=>setQ(e.target.value)}
              placeholder="Название или HR-ID"
              className="w-80 rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-600">Фильтр</span>
            <select
              value={onlyFav ? "fav":"all"}
              onChange={e=>setOnlyFav(e.target.value==="fav")}
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-sky-400"
            >
              <option value="all">Все</option>
              <option value="fav">Избранные</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-600">Сортировка</span>
            <select
              value={sort}
              onChange={e=>setSort(e.target.value as SortKey)}
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-sky-400"
            >
              <option value="new">Новые → старые</option>
              <option value="old">Старые → новые</option>
              <option value="name_asc">Название A→Я</option>
              <option value="name_desc">Название Я→A</option>
            </select>
          </div>
        </div>
      </header>

      {/* Таблица без группировки, стиль как у РК */}
      <section className="rounded-2xl border bg-white">
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-3 py-2 w-10">★</th>
                <th className="px-3 py-2">Название</th>
                <th className="px-3 py-2">Кампаний</th>
                <th className="px-3 py-2">Создана</th>
                <th className="px-3 py-2">Действия</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(g=>(
                <tr key={g.id} className="odd:bg-white even:bg-gray-50 hover:bg-sky-50">
                  <td className="border-t p-2">
                    <button
                      className={`rounded-full border px-2 ${g.fav?"border-amber-400 text-amber-500":"border-gray-300 text-gray-400"}`}
                      onClick={()=>setGroups(toggleFavGroup(g.id))}
                      aria-label={g.fav?"Убрать из избранного":"Добавить в избранное"}
                      title={g.fav?"Убрать из избранного":"Добавить в избранное"}
                    >
                      {g.fav ? "★" : "☆"}
                    </button>
                  </td>
                  <td className="border-t p-2">{g.name}</td>
                  <td className="border-t p-2">{g.campaignIds.length}</td>
                  <td className="border-t p-2">{g.createdAt}</td>
                  <td className="border-t p-2">
                    <div className="flex gap-2">
                      <IconBtn
                        label="📊"
                        title="Дашборд"
                        href={`/dashboard?ids=${idsToQuery(g.campaignIds)}`}
                      />
                      <IconBtn
                        label="🧩"
                        title="Конструктор отчётов"
                        href={`/builder?ids=${idsToQuery(g.campaignIds)}`}
                      />
                      <IconBtn
                        label="🗑️"
                        title="Удалить группу"
                        onClick={()=>setGroups(deleteGroup(g.id))}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {shown.length===0 && (
                <tr><td colSpan={5} className="py-8 text-center text-gray-500">Ничего не найдено</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
