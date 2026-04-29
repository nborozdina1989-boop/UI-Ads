'use client';
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Archive,
  BarChart3,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Download,
  FolderPlus,
  Puzzle,
  Star,
  Tag,
  X,
} from "lucide-react";
import { listCampaigns, exportExcel, readCtx, saveCtx, type Campaign } from "@/lib/campaigns";
import { getCampaignStats, type CampaignStats } from "@/lib/campaigns";
import { getFavCampaignIds, toggleFavCampaign, isFavCampaign, getArchivedIds, archiveCampaigns } from "@/lib/archfav";
import { createGroup } from "@/lib/campaigns";
import { logEvent } from "@/lib/analytics";
import CampaignFilters from "@/components/CampaignFilters";
import TagPills from "@/components/TagPills";
import { getCampaignTags, setCampaignTags, getAllTagsMap } from "@/lib/campaigns";
import StatusTypeCell from "@/components/StatusTypeCell";
function Tabs() {
  const path = usePathname();
  const Tab = ({href,label}:{href:string;label:string}) => (
    <Link href={href}
      className={`rounded-full px-3 py-1.5 text-sm ${path===href? "bg-[color:var(--adr-blue)] text-white":"bg-white text-[color:var(--adr-blue)] ring-1 ring-[color:var(--adr-blue)] hover:bg-[color:var(--adr-light-blue)]/12"}`}>{label}</Link>
  );
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">
        <Tab href="/campaigns" label="РК"/>
        <Tab href="/campaigns/groups" label="Группы"/>
        <Tab href="/campaigns/archive" label="Архив"/>
      </div>
      <Link
        href="/campaigns/tracker-sites"
        className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Трекерные сайты
      </Link>
    </div>
  );
}
type GroupMode = "none"|"brand"|"adv"|"tree";
type SortMode =
  | "created_desc"|"created_asc"|"name_asc"|"name_desc"
  | "imps_desc"|"imps_asc"
  | "clicks_desc"|"clicks_asc"
  | "ctr_desc"|"ctr_asc";
type StatusFilter = "all" | "active" | "inactive";
type MeasurementType = "Audit" | "IVT" | "Full" | "Click" | "Audit+Viewability (без IVT)";
type CampaignLike = Pick<Campaign, "id"> & { measures?: unknown };
type FlatBucket = { __flat: Campaign[] };
type FlatTree = Record<string, FlatBucket>;
type NestedTree = Record<string, Record<string, FlatBucket>>;
const dispBrand = (b?:string) => (b && b.trim()) ? b : "Без бренда";
const dispAdv   = (a?:string) => (a && a.trim()) ? a : "Без рекламодателя";
const INT_FORMATTER = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
function fmtInt(n:number){
  return INT_FORMATTER.format(Math.max(0, Math.trunc(n)));
}
function fmtPct(clicks:number, imps:number){
if (!imps) return '0.00%';
  const v = (clicks / imps) * 100;
  return v.toFixed(2).replace('.', ',') + '%';
}
function parseCampaignDate(raw: string): Date | null {
  const value = String(raw || "").trim();
  if (!value) return null;

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;

  const m = value.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const d = new Date(yyyy, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return d;
}
function fmtCampaignDate(raw: string): string {
  const d = parseCampaignDate(raw);
  return d ? d.toLocaleDateString("ru-RU") : "—";
}
function campaignDateSortValue(raw: string): number {
  const d = parseCampaignDate(raw);
  return d ? d.getTime() : 0;
}
function normStats(st: CampaignStats): CampaignStats {
  const clamp = (n:number)=> Math.max(0, Math.trunc(n));
  return {
    today:     { imps: clamp(st.today.imps),     clicks: clamp(st.today.clicks) },
    yesterday: { imps: clamp(st.yesterday.imps), clicks: clamp(st.yesterday.clicks) },
    total:     { imps: clamp(st.total.imps),     clicks: clamp(st.total.clicks) }
  };
}
function TriStateCheckbox({
  checked, indeterminate, onChange, ariaLabel
}:{checked:boolean; indeterminate:boolean; onChange:()=>void; ariaLabel:string;}){
  const ref = useRef<HTMLInputElement>(null);
  useEffect(()=>{ if(ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
  return <input ref={ref} type="checkbox" checked={checked} onChange={onChange} aria-label={ariaLabel}/>;
}
const MEASURE_TYPES: MeasurementType[] = ["Audit","IVT","Full","Click","Audit+Viewability (без IVT)"];
function seeded(id:number){ let x = Math.imul(id ^ 0x9e3779b1, 0x85ebca6b) >>> 0; x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0; x ^= x >>> 16; return x / 0xFFFFFFFF; }
function pickMeasures(id:number): MeasurementType[] { const r = seeded(id); const n = r < 0.5 ? 1 : (r < 0.8 ? 2 : 3); const pool = [...MEASURE_TYPES]; const out: MeasurementType[] = []; let s = r; for (let i=0; i<n; i++){ s = seeded(id + i + 101); const idx = Math.floor(s * pool.length); out.push(pool.splice(idx,1)[0]); } return out; }
function getMeasures(c: CampaignLike): MeasurementType[] { if (Array.isArray(c.measures)) return c.measures.filter((v): v is MeasurementType => typeof v === "string") as MeasurementType[]; const id = Number(c.id) || 0; return pickMeasures(id); }
function measLabelFor(c: CampaignLike){ const ms=getMeasures(c).map(String); const has=(t:string)=>ms.some(m=>m.toLowerCase()===t.toLowerCase()); const hasPref=(p:string)=>ms.some(m=>m.toLowerCase().startsWith(p.toLowerCase())); if(has("audit")&& (has("viewPartnerMedia")||has("viewPartnerVideo"))) return "Audit+Viewability"; if(hasPref("ivt")) return "IVT"; if(has("click")) return "Click"; if(has("adserving")||has("viewAdserving")||has("adservingVideo")||has("adservingVideoView")) return "Full"; return "Audit"; }

export default function CampaignsPage(){
const [mounted, setMounted] = useState(false);
  useEffect(()=>{ setMounted(true); },[]);
  const router = useRouter();
  const params = useSearchParams();
  const initial = readCtx() as Partial<{ q: string; own: boolean; delegated: boolean; status: StatusFilter; groupBy: GroupMode }>;
  const statusParam = params.get("status") ?? initial.status;
  const initialStatus: StatusFilter = statusParam === "active" || statusParam === "inactive" || statusParam === "all" ? statusParam : "all";
  const [q, setQ] = useState(params.get("q") ?? (initial.q||""));
  const [own, setOwn] = useState((params.get("own") ?? (initial.own? "1":"0")) === "1");
  const [delegated, setDelegated] = useState((params.get("deleg") ?? (initial.delegated? "1":"0")) === "1");
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [groupMode, setGroupMode] = useState<GroupMode>((params.get("group") as GroupMode) || (initial.groupBy || "none"));
  const [sort, setSort] = useState<SortMode>((params.get("sort") as SortMode) || "created_desc");
  const [favOnly, setFavOnly] = useState((params.get("fav")||"0")==="1");
  const [tagsMap, setTagsMap] = useState<Record<number, string[]>>(()=>getAllTagsMap());
  // дополнительные фильтры
  const [idFilter, setIdFilter] = useState("");
  const [advFilter, setAdvFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [measFilter, setMeasFilter] = useState("");
  const all = useMemo(() => listCampaigns(), []);
  const allMeasures = useMemo(()=>{ const s=new Set<string>(); all.forEach(c=>getMeasures(c).forEach(m=>s.add(m))); return Array.from(s).sort(); },[all]);
  const idOptions = useMemo(() => Array.from(new Set(all.map((c) => String(c.id)))).sort(), [all]);
  const brandOptions = useMemo(() => Array.from(new Set(all.map((c) => String(c.brand || "").trim()).filter(Boolean))).sort(), [all]);
  const advOptions = useMemo(() => Array.from(new Set(all.map((c) => String(c.advertiser || "").trim()).filter(Boolean))).sort(), [all]);
  const tagOptions = useMemo(() => Array.from(new Set(Object.values(tagsMap).flat().map((t) => t.trim()).filter(Boolean))).sort(), [tagsMap]);
  const resetFilters = () => { setQ(""); setOwn(false); setDelegated(false); setStatus("all"); setFavOnly(false); setIdFilter(""); setBrandFilter(""); setAdvFilter(""); setTagFilter(""); setMeasFilter(""); };
  const archivedSet = useMemo(()=> new Set(getArchivedIds()),[]);
  const favSet = useMemo(()=> new Set(getFavCampaignIds()),[]);
  const statsByCampaignId = useMemo(() => {
    const out = new Map<number, CampaignStats>();
    all.forEach((campaign) => {
      out.set(campaign.id, normStats(getCampaignStats(campaign)));
    });
    return out;
  }, [all]);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const norm = (v: string) => String(v || "").trim().toLowerCase();
    const splitCsv = (v: string) => v.split(/[;,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    const idWanted = norm(idFilter);
    const advWanted = norm(advFilter);
    const brandWanted = norm(brandFilter);
    const tagWanted = splitCsv(tagFilter);
    const measWanted = splitCsv(measFilter);

    const out: Campaign[] = [];

    for (const c of all) {
      if (archivedSet.has(c.id)) continue;

      if (term) {
        const searchable = [c.id, c.name, c.brand, c.advertiser].some((v) =>
          String(v ?? "").toLowerCase().includes(term)
        );
        if (!searchable) continue;
      }

      const campaignIdLower = String(c.id).toLowerCase();
      const advertiserLower = String(c.advertiser ?? "").toLowerCase();
      const brandLower = String(c.brand ?? "").toLowerCase();

      if (idWanted && !campaignIdLower.includes(idWanted)) continue;
      if (advWanted && !advertiserLower.includes(advWanted)) continue;
      if (brandWanted && !brandLower.includes(brandWanted)) continue;

      if (tagWanted.length) {
        const actualTags = (tagsMap[c.id] || getCampaignTags(c.id)).map((t) => t.toLowerCase());
        const ok = tagWanted.every((wanted) => actualTags.some((tag) => tag.includes(wanted)));
        if (!ok) continue;
      }

      if (measWanted.length) {
        const actualMeasures = getMeasures(c).map((t) => String(t).toLowerCase());
        const measureLabel = measLabelFor(c).toLowerCase();
        const haystack = `${actualMeasures.join(" ")} ${measureLabel}`;
        const ok = measWanted.every((wanted) => haystack.includes(wanted));
        if (!ok) continue;
      }

      if (status !== "all") {
        const isActive = c.status === "Активна";
        if ((status === "active" && !isActive) || (status === "inactive" && isActive)) continue;
      }

      if (own && c.type === "Делегированная") continue;
      if (delegated && c.type !== "Делегированная") continue;
      if (favOnly && !favSet.has(c.id)) continue;

      out.push(c);
    }

    return out;
  }, [all, archivedSet, q, status, own, delegated, favOnly, favSet, idFilter, advFilter, brandFilter, tagFilter, measFilter, tagsMap]);
  const sorted = useMemo(()=>{
    const arr = [...filtered];
    const byName = (a:Campaign,b:Campaign)=> a.name.localeCompare(b.name, "ru");
    const byCreated = (a:Campaign,b:Campaign)=> (campaignDateSortValue(a.createdAt) - campaignDateSortValue(b.createdAt));
    const byImps = (a: Campaign, b: Campaign) =>
      (statsByCampaignId.get(a.id)?.total.imps || 0) - (statsByCampaignId.get(b.id)?.total.imps || 0);
    const byClicks = (a: Campaign, b: Campaign) =>
      (statsByCampaignId.get(a.id)?.total.clicks || 0) - (statsByCampaignId.get(b.id)?.total.clicks || 0);
    const byCtr = (a: Campaign, b: Campaign) => {
      const aStats = statsByCampaignId.get(a.id);
      const bStats = statsByCampaignId.get(b.id);
      const aCtr = !aStats?.total.imps ? 0 : aStats.total.clicks / aStats.total.imps;
      const bCtr = !bStats?.total.imps ? 0 : bStats.total.clicks / bStats.total.imps;
      return aCtr - bCtr;
    };
    switch (sort) {
      case "name_asc":  return arr.sort(byName);
      case "name_desc": return arr.sort((a,b)=>-byName(a,b));
      case "created_asc": return arr.sort(byCreated);
      case "imps_asc": return arr.sort(byImps);
      case "imps_desc": return arr.sort((a, b) => -byImps(a, b));
      case "clicks_asc": return arr.sort(byClicks);
      case "clicks_desc": return arr.sort((a, b) => -byClicks(a, b));
      case "ctr_asc": return arr.sort(byCtr);
      case "ctr_desc": return arr.sort((a, b) => -byCtr(a, b));
      default: return arr.sort((a,b)=> -byCreated(a,b));
    }
  }, [filtered, sort, statsByCampaignId]);
  const idsByBrand = useMemo(()=> {
    const m = new Map<string, Set<number>>();
    sorted.forEach(c=>{ const b = dispBrand(c.brand); if(!m.has(b)) m.set(b, new Set()); m.get(b)!.add(c.id); });
    return m;
  }, [sorted]);
  const idsByAdv = useMemo(()=> {
    const m = new Map<string, Set<number>>();
    sorted.forEach(c=>{ const a = dispAdv(c.advertiser); if(!m.has(a)) m.set(a, new Set()); m.get(a)!.add(c.id); });
    return m;
  }, [sorted]);
  const idsByAdvBrand = useMemo(()=> {
    const m = new Map<string, Map<string, Set<number>>>();
    sorted.forEach(c=>{
      const a = dispAdv(c.advertiser);
      const b = dispBrand(c.brand);
      if(!m.has(a)) m.set(a, new Map());
      const mm = m.get(a)!;
      if(!mm.has(b)) mm.set(b, new Set());
      mm.get(b)!.add(c.id);
    });
    return m;
  }, [sorted]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const addIds    = (ids:Set<number>) => setSelected(prev=>{ const n=new Set(prev); ids.forEach(id=>n.add(id)); return n; });
  const removeIds = (ids:Set<number>) => setSelected(prev=>{ const n=new Set(prev); ids.forEach(id=>n.delete(id)); return n; });
  const toggleSel = (id:number)=> setSelected(prev=>{ const n=new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAdvAll = (advLabel:string) => {
    const ids = idsByAdv.get(advLabel) || new Set<number>();
    const allChecked = Array.from(ids).every(id => selected.has(id));
    if (allChecked) removeIds(ids);
    else addIds(ids);
  };
  const toggleBrandAll = (brandLabel:string) => {
    const ids = idsByBrand.get(brandLabel) || new Set<number>();
    const allChecked = Array.from(ids).every(id => selected.has(id));
    if (allChecked) removeIds(ids);
    else addIds(ids);
  };
  const toggleBrandUnderAdv = (advLabel:string, brandLabel:string) => {
    const ids = idsByAdvBrand.get(advLabel)?.get(brandLabel) || new Set<number>();
    const allChecked = Array.from(ids).every(id => selected.has(id));
    if (allChecked) removeIds(ids);
    else addIds(ids);
  };
  const clearAllSelection = ()=> setSelected(new Set());
  const tree = useMemo<FlatTree | NestedTree>(()=> {
    if (groupMode==="none") return { "Все кампании": { "__flat": sorted } };
    if (groupMode==="brand") {
      const m: FlatTree = {};
      sorted.forEach(c=>{
        const k = dispBrand(c.brand);
        (m[k] ||= { "__flat": [] }).__flat.push(c);
      });
      return m;
    }
    if (groupMode==="adv") {
      const m: FlatTree = {};
      sorted.forEach(c=>{
        const k = dispAdv(c.advertiser);
        (m[k] ||= { "__flat": [] }).__flat.push(c);
      });
      return m;
    }
    const m: NestedTree = {};
    sorted.forEach(c=>{
      const a = dispAdv(c.advertiser);
      const b = dispBrand(c.brand);
      (m[a] ||= {});
      (m[a][b] ||= { "__flat": [] }).__flat.push(c);
    });
    return m;
  }, [sorted, groupMode]);
  const [collapsedAdv, setCollapsedAdv] = useState<Record<string, boolean>>({});
  const [collapsedBucket, setCollapsedBucket] = useState<Record<string, boolean>>({});
  const [collapsedBrand, setCollapsedBrand] = useState<Record<string, boolean>>({});
  const [expandedBrandAll, setExpandedBrandAll] = useState<Record<string, boolean>>({});
  const [expandedFlatAll, setExpandedFlatAll] = useState<Record<string, boolean>>({});
  const ids = useMemo(()=> Array.from(selected), [selected]);
  const gotoDashboard = ()=> { if(!ids.length) return; logEvent("open_dashboard",{ids, via:"groups"}); router.push(`/dashboard?ids=${ids.join(",")}`); };
  const gotoBuilder  = ()=> { if(!ids.length) return; logEvent("open_builder",{ids, via:"groups"});  router.push(`/builder?ids=${ids.join(",")}`); };
  const exportAction = ()=> exportExcel(sorted.filter(c=>selected.has(c.id)));
  const archiveAction = ()=> { if(!ids.length) return; if(confirm(`Архивировать ${ids.length} камп.?`)){ archiveCampaigns(ids); setSelected(new Set()); router.refresh(); alert("Перемещено в «Архив»."); } };
  const saveGroupAction = ()=> {
    if(!ids.length) return;
    const name = prompt("Название группы","Новая группа");
    if(!name) return;
    const desc = prompt("Описание группы","") || "";
    try {
      const g = createGroup(name, ids, desc);
      alert(`Группа «${g.name}» сохранена (${g.campaignIds.length} камп.).`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Не удалось сохранить группу.");
    }
  };
  const bulkAddTags = () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const input = prompt("Добавить теги (через запятую) для выбранных РК", "");
    if (input===null || input.trim()==="") return;
    const add = input.split(",").map(s=>s.trim()).filter(Boolean);
    if (!add.length) return;
    ids.forEach((id)=>{
      const curr = tagsMap[id] || getCampaignTags(id);
      const merged = Array.from(new Set([...curr, ...add]));
      setCampaignTags(id, merged);
    });
    setTagsMap(prev=>{
      const p={...prev};
      ids.forEach((id)=>{
        const curr = p[id] || getCampaignTags(id);
        p[id] = Array.from(new Set([...curr, ...add]));
      });
      return p;
    });
    alert("Теги добавлены для выбранных РК.");
  };
  const removeTag = (id: number, t: string) => {
    const norm = String(t).trim().toLowerCase();
    const curr = (tagsMap[id] || getCampaignTags(id)).filter(x => x.toLowerCase() !== norm);
    setCampaignTags(id, curr);
    setTagsMap(prev => ({ ...prev, [id]: curr }));
  };
  const addTagsQuick = (id: number) => {
    const curr = (tagsMap[id] || getCampaignTags(id)) || [];
    const next = prompt("Добавить теги (через запятую/пробел/точку с запятой)", "");
    if (next === null) return;
    const parts = next.split(/[ ,;\s]+/).map(s => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const merged = Array.from(new Set([...curr, ...parts]));
    setCampaignTags(id, merged);
    setTagsMap(prev => ({ ...prev, [id]: merged }));
  };
  useEffect(()=>{
    saveCtx({ q, own, delegated, status, groupBy: groupMode });
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (groupMode!=="none") qs.set("group", groupMode);
    qs.set("sort", sort);
    qs.set("fav", favOnly ? "1":"0");
    qs.set("own",  own ? "1":"0");
    qs.set("deleg",delegated ? "1":"0");
    if(status!=="all") qs.set("status", status);
    router.replace(`/campaigns?${qs.toString()}`);
  }, [q, groupMode, sort, favOnly, own, delegated, status, router]);
  const toggleMetricSort = (metric: "imps" | "clicks" | "ctr") => {
    setSort((current) => {
      const asc = `${metric}_asc` as SortMode;
      const desc = `${metric}_desc` as SortMode;
      return current === desc ? asc : desc;
    });
  };
  const sortArrow = (metric: "imps" | "clicks" | "ctr") => {
    if (sort === `${metric}_asc`) {
      return <ArrowUp className="h-3.5 w-3.5 text-[color:var(--adr-blue)]" />;
    }
    if (sort === `${metric}_desc`) {
      return <ArrowDown className="h-3.5 w-3.5 text-[color:var(--adr-blue)]" />;
    }
    return <span className="text-[10px] text-[color:var(--adr-text-muted)]">⇅</span>;
  };
  const TableColGroup = () => (
    <colgroup>
      <col className="w-[42px]" />
      <col className="w-[42px]" />
      <col className="w-[96px]" />
      <col className="w-[64px]" />
      <col />
      <col className="w-[126px]" />
      <col className="w-[112px]" />
      <col className="w-[106px]" />
      <col className="w-[176px]" />
    </colgroup>
  );
  const TableHead = () => (
  <thead className="sticky top-0 z-10">
    <tr className="border-b border-[color:var(--adr-border)] bg-gradient-to-b from-[color:var(--adr-surface)] to-white/90">
      <th className="p-3"></th>
      <th className="p-3"></th>
      <th className="p-3 text-left text-[13px] font-semibold leading-5 text-[color:var(--adr-text)]">ID</th>
      <th className="p-3 text-left text-[13px] font-semibold leading-5 text-[color:var(--adr-text)]">
        <span className="sr-only">Статус</span>
      </th>
      <th className="p-3 text-left text-[13px] font-semibold leading-5 text-[color:var(--adr-text)]">Название / Даты</th>
      <th className="p-3 text-center text-[13px] font-semibold leading-5 text-[color:var(--adr-text)]">
        <button
          type="button"
          onClick={() => toggleMetricSort("imps")}
          className="inline-flex items-center justify-center gap-1 rounded-full px-2 py-1 hover:bg-[color:var(--adr-light-blue)]/10"
          title={sort === "imps_desc" ? "Сортировка по показам: по убыванию" : sort === "imps_asc" ? "Сортировка по показам: по возрастанию" : "Сортировать по показам"}
        >
          <span>Показы</span>
          {sortArrow("imps")}
        </button>
      </th>
      <th className="p-3 text-center text-[13px] font-semibold leading-5 text-[color:var(--adr-text)]">
        <button
          type="button"
          onClick={() => toggleMetricSort("clicks")}
          className="inline-flex items-center justify-center gap-1 rounded-full px-2 py-1 hover:bg-[color:var(--adr-light-blue)]/10"
          title={sort === "clicks_desc" ? "Сортировка по кликам: по убыванию" : sort === "clicks_asc" ? "Сортировка по кликам: по возрастанию" : "Сортировать по кликам"}
        >
          <span>Клики</span>
          {sortArrow("clicks")}
        </button>
      </th>
      <th className="p-3 text-center text-[13px] font-semibold leading-5 text-[color:var(--adr-text)]">
        <button
          type="button"
          onClick={() => toggleMetricSort("ctr")}
          className="inline-flex items-center justify-center gap-1 rounded-full px-2 py-1 hover:bg-[color:var(--adr-light-blue)]/10"
          title={sort === "ctr_desc" ? "Сортировка по CTR: по убыванию" : sort === "ctr_asc" ? "Сортировка по CTR: по возрастанию" : "Сортировать по CTR"}
        >
          <span>CTR%</span>
          {sortArrow("ctr")}
        </button>
      </th>
      <th className="p-3 text-center text-[13px] font-semibold leading-5 text-[color:var(--adr-text)]">Действия</th>
    </tr>
  </thead>
);
const Row = ({c}:{c:Campaign}) => {
  const st = statsByCampaignId.get(c.id) || normStats(getCampaignStats(c));
  const meas = measLabelFor(c);
  const isFav = isFavCampaign(c.id);
	  return (
	    <tr key={c.id} className="odd:bg-white even:bg-[color:var(--adr-surface)] hover:bg-[color:var(--adr-light-blue)]/10">
      <td className="border-t p-2">
        <input type="checkbox" checked={selected.has(c.id)} onChange={()=>toggleSel(c.id)} aria-label="Выбрать кампанию"/>
      </td>
      <td className="border-t p-2">
        <button
          aria-label={isFav ? "Убрать из избранного" : "В избранное"}
          onClick={()=>{ toggleFavCampaign(c.id); router.refresh(); }}
          className="inline-flex items-center justify-center rounded-full p-1 text-[color:var(--adr-text-muted)] hover:bg-[color:var(--adr-light-blue)]/10"
        >
          <Star className={`h-4 w-4 ${isFav ? "fill-[color:var(--adr-green)] text-[color:var(--adr-green)]" : "text-[color:var(--adr-text-muted)]"}`} />
        </button>
      </td>
	      <td className="border-t p-2 text-[13px] text-[color:var(--adr-blue)] underline-offset-2 hover:underline"><Link href={`/campaigns/${c.id}`}>{c.id}</Link></td>
	      <td className="border-t p-2"><StatusTypeCell type={c.type} status={c.status} /></td>
      <td className="border-t p-2 text-[color:var(--adr-blue)] underline-offset-2 hover:underline">
        <Link href={`/campaigns/${c.id}`}>{c.name}</Link>
	        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[color:var(--adr-text-muted)]">
	          <span>Создана: {fmtCampaignDate(c.createdAt)}</span>
          <span className="rounded-full bg-[color:var(--adr-surface)] px-2 py-0.5 text-[11px] text-[color:var(--adr-text-muted)] ring-1 ring-[color:var(--adr-border)]">Бренд: {c.brand || "—"}</span>
          <span className="rounded-full bg-[color:var(--adr-surface)] px-2 py-0.5 text-[11px] text-[color:var(--adr-text-muted)] ring-1 ring-[color:var(--adr-border)]">Рекламодатель: {c.advertiser || "—"}</span>
          <span className="rounded-full bg-[color:var(--adr-surface)] px-2 py-0.5 text-[11px] text-[color:var(--adr-text-muted)] ring-1 ring-[color:var(--adr-border)]">{c.own ? "Своя" : "Делегированная"}</span> 
            
          {meas && (<span className="rounded-full bg-[color:var(--adr-surface)] px-2 py-0.5 text-[11px] text-[color:var(--adr-text)] ring-1 ring-[color:var(--adr-border)]">{meas}</span>)}
	        </div>
	        <TagPills tags={(tagsMap[c.id] || getCampaignTags(c.id))} onAdd={() => addTagsQuick(c.id)} onRemove={(t) => removeTag(c.id, t)} />
	      </td>
	      <td className="border-t px-2 py-2 text-center align-middle">
          <span className="inline-flex h-8 min-w-[92px] items-center justify-center rounded-lg border border-[color:var(--adr-border)] bg-white px-2 text-[13px] font-semibold tabular-nums text-[color:var(--adr-text)]">
            {fmtInt(Math.abs((st.total?.imps)||0))}
          </span>
        </td>
	      <td className="border-t px-2 py-2 text-center align-middle">
          <span className="inline-flex h-8 min-w-[74px] items-center justify-center rounded-lg border border-[color:var(--adr-border)] bg-white px-2 text-[13px] font-semibold tabular-nums text-[color:var(--adr-text)]">
            {fmtInt(Math.abs((st.total?.clicks)||0))}
          </span>
        </td>
	      <td className="border-t px-2 py-2 text-center align-middle">
          <span className="inline-flex h-8 min-w-[74px] items-center justify-center rounded-lg border border-[color:var(--adr-green)]/35 bg-[color:var(--adr-green)]/10 px-2 text-[13px] font-semibold tabular-nums text-[color:var(--adr-green)]">
            {fmtPct(Math.abs((st.total?.clicks)||0), Math.abs((st.total?.imps)||0))}
          </span>
        </td>
		      <td className="border-t p-2 text-center align-middle" data-no-rownav>
		        <div className="inline-flex items-center gap-1 justify-center rounded-lg border border-[color:var(--adr-border)] bg-white/90 px-1.5 py-1">
            <Link
              href={`/dashboard?ids=${c.id}`}
              title="Дашборд"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--adr-blue)] text-white shadow-[0_1px_0_rgba(29,112,183,0.12)]"
            >
              <BarChart3 className="h-3.5 w-3.5" />
            </Link>
	        <Link
              href={`/builder?ids=${c.id}`}
              title="Конструктор"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[color:var(--adr-blue)] ring-1 ring-[color:var(--adr-blue)] hover:bg-[color:var(--adr-light-blue)]/10"
            >
              <Puzzle className="h-3.5 w-3.5" />
            </Link>
            <button
              onClick={()=>exportExcel([c])}
              title="Экспорт Excel"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[color:var(--adr-blue)] ring-1 ring-[color:var(--adr-blue)] hover:bg-[color:var(--adr-light-blue)]/10"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={()=>{ if(confirm("Архивировать кампанию?")){ archiveCampaigns([c.id]); router.refresh(); }}}
              title="Архивировать"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[color:var(--adr-dark-blue)] ring-1 ring-[color:var(--adr-dark-blue)] hover:bg-[color:var(--adr-light-blue)]/10"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
    </tr>
  );
};
const CampaignCard = ({c}:{c:Campaign}) => {
  const st = statsByCampaignId.get(c.id) || normStats(getCampaignStats(c));
  const meas = measLabelFor(c);
  const isFav = isFavCampaign(c.id);
  return (
    <article className="rounded-xl border border-[color:var(--adr-border)] bg-white p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected.has(c.id)}
          onChange={() => toggleSel(c.id)}
          aria-label="Выбрать кампанию"
          className="mt-1 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/campaigns/${c.id}`}
                className="block truncate text-sm font-semibold text-[color:var(--adr-blue)] underline-offset-2 hover:underline"
              >
                {c.name}
              </Link>
              <div className="mt-1 text-xs text-[color:var(--adr-text-muted)]">
                ID {c.id} · Создана: {fmtCampaignDate(c.createdAt)}
              </div>
            </div>
            <button
              aria-label={isFav ? "Убрать из избранного" : "В избранное"}
              onClick={() => { toggleFavCampaign(c.id); router.refresh(); }}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--adr-text-muted)] hover:bg-[color:var(--adr-light-blue)]/10"
            >
              <Star className={`h-4 w-4 ${isFav ? "fill-[color:var(--adr-green)] text-[color:var(--adr-green)]" : "text-[color:var(--adr-text-muted)]"}`} />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusTypeCell type={c.type} status={c.status} />
            <span className="rounded-full bg-[color:var(--adr-surface)] px-2 py-0.5 text-[11px] text-[color:var(--adr-text-muted)] ring-1 ring-[color:var(--adr-border)]">
              Бренд: {c.brand || "—"}
            </span>
            <span className="rounded-full bg-[color:var(--adr-surface)] px-2 py-0.5 text-[11px] text-[color:var(--adr-text-muted)] ring-1 ring-[color:var(--adr-border)]">
              Рекламодатель: {c.advertiser || "—"}
            </span>
            <span className="rounded-full bg-[color:var(--adr-surface)] px-2 py-0.5 text-[11px] text-[color:var(--adr-text-muted)] ring-1 ring-[color:var(--adr-border)]">
              {c.own ? "Своя" : "Делегированная"}
            </span>
            {meas && (
              <span className="rounded-full bg-[color:var(--adr-surface)] px-2 py-0.5 text-[11px] text-[color:var(--adr-text)] ring-1 ring-[color:var(--adr-border)]">
                {meas}
              </span>
            )}
          </div>

          <TagPills tags={(tagsMap[c.id] || getCampaignTags(c.id))} onAdd={() => addTagsQuick(c.id)} onRemove={(t) => removeTag(c.id, t)} />

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-[color:var(--adr-border)] bg-[color:var(--adr-surface)] px-2 py-2">
              <div className="text-[10px] uppercase tracking-wide text-[color:var(--adr-text-muted)]">Показы</div>
              <div className="mt-1 text-sm font-semibold tabular-nums text-[color:var(--adr-text)]">{fmtInt(Math.abs(st.total?.imps || 0))}</div>
            </div>
            <div className="rounded-lg border border-[color:var(--adr-border)] bg-[color:var(--adr-surface)] px-2 py-2">
              <div className="text-[10px] uppercase tracking-wide text-[color:var(--adr-text-muted)]">Клики</div>
              <div className="mt-1 text-sm font-semibold tabular-nums text-[color:var(--adr-text)]">{fmtInt(Math.abs(st.total?.clicks || 0))}</div>
            </div>
            <div className="rounded-lg border border-[color:var(--adr-green)]/35 bg-[color:var(--adr-green)]/10 px-2 py-2">
              <div className="text-[10px] uppercase tracking-wide text-[color:var(--adr-green)]">CTR</div>
              <div className="mt-1 text-sm font-semibold tabular-nums text-[color:var(--adr-green)]">
                {fmtPct(Math.abs(st.total?.clicks || 0), Math.abs(st.total?.imps || 0))}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/dashboard?ids=${c.id}`}
              className="inline-flex h-9 flex-1 items-center justify-center rounded-full bg-[color:var(--adr-blue)] px-3 text-xs font-medium text-white"
            >
              Дашборд
            </Link>
            <Link
              href={`/builder?ids=${c.id}`}
              className="inline-flex h-9 flex-1 items-center justify-center rounded-full bg-white px-3 text-xs font-medium text-[color:var(--adr-blue)] ring-1 ring-[color:var(--adr-blue)]"
            >
              Конструктор
            </Link>
            <button
              onClick={() => exportExcel([c])}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[color:var(--adr-blue)] ring-1 ring-[color:var(--adr-blue)]"
              title="Экспорт Excel"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={() => { if(confirm("Архивировать кампанию?")){ archiveCampaigns([c.id]); router.refresh(); }}}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[color:var(--adr-dark-blue)] ring-1 ring-[color:var(--adr-dark-blue)]"
              title="Архивировать"
            >
              <Archive className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
const CampaignRows = ({rows}:{rows:Campaign[]}) => (
  <div>
    <div className="grid gap-3 lg:hidden">
      {rows.map((c) => <CampaignCard key={c.id} c={c} />)}
      {rows.length === 0 && (
        <div className="rounded-xl border border-[color:var(--adr-border)] bg-white py-8 text-center text-sm text-[color:var(--adr-text-muted)]">
          Ничего не найдено
        </div>
      )}
    </div>
    <div className="hidden overflow-x-auto lg:block">
      <table className="min-w-[1040px] w-full table-fixed border-collapse text-sm">
        <TableColGroup/>
        <TableHead/>
        <tbody>
          {rows.map((c:Campaign)=> <Row key={c.id} c={c} />)}
          {rows.length===0 && (<tr><td colSpan={9} className="py-8 text-center text-[color:var(--adr-text-muted)]">Ничего не найдено</td></tr>)}
        </tbody>
      </table>
    </div>
  </div>
);
return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 text-[color:var(--adr-text)] sm:px-6">
      <Tabs/>
      {!mounted ? (
        <div className="rounded-2xl border border-[color:var(--adr-border)] bg-white p-8 text-[color:var(--adr-text-muted)]">Загрузка…</div>
      ) : (
        <>
          <CampaignFilters
            q={q}
            onQChange={setQ}
            status={status}
            onStatusChange={setStatus}
            groupMode={groupMode}
            onGroupChange={(gm)=>{ setGroupMode(gm); setSelected(new Set()); }}
            sort={sort}
            onSortChange={setSort}
            own={own}
            onOwnChange={setOwn}
            delegated={delegated}
            onDelegatedChange={setDelegated}
            favOnly={favOnly}
            onFavChange={setFavOnly}
            onReset={resetFilters}
            idFilter={idFilter}
            onIdFilterChange={setIdFilter}
            advFilter={advFilter}
            onAdvFilterChange={setAdvFilter}
            brandFilter={brandFilter}
            onBrandFilterChange={setBrandFilter}
            tagFilter={tagFilter}
            onTagFilterChange={setTagFilter}
            measFilter={measFilter}
            onMeasFilterChange={setMeasFilter}
            allMeasures={allMeasures}
            idOptions={idOptions}
            brandOptions={brandOptions}
            advOptions={advOptions}
            tagOptions={tagOptions}
          />
          {ids.length>0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-[color:var(--adr-light-blue)]/10 px-3 py-2 ring-1 ring-[color:var(--adr-light-blue)]/40">
              <div className="text-sm text-[color:var(--adr-text)]">Выбрано РК: <b>{ids.length}</b></div>
              <button onClick={gotoDashboard} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--adr-blue)] text-white" title="Дашборд"><BarChart3 className="h-4 w-4" /></button>
              <button onClick={gotoBuilder}  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[color:var(--adr-blue)] ring-1 ring-[color:var(--adr-blue)]" title="Конструктор"><Puzzle className="h-4 w-4" /></button>
              <button onClick={exportAction} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[color:var(--adr-blue)] ring-1 ring-[color:var(--adr-blue)]" title="Экспорт Excel"><Download className="h-4 w-4" /></button>
	              <button onClick={()=>bulkAddTags()} title="Добавить теги" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[color:var(--adr-blue)] ring-1 ring-[color:var(--adr-blue)]"><Tag className="h-4 w-4" /></button>
              <button onClick={archiveAction} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[color:var(--adr-dark-blue)] ring-1 ring-[color:var(--adr-dark-blue)]" title="Архивировать"><Archive className="h-4 w-4" /></button>
              <button onClick={saveGroupAction} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs text-[color:var(--adr-green)] ring-1 ring-[color:var(--adr-green)]" title="Сохранить в группу"><FolderPlus className="h-3.5 w-3.5" /> Сохранить</button>
              <button onClick={clearAllSelection} className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[color:var(--adr-text-muted)] ring-1 ring-[color:var(--adr-border)]" title="Сбросить"><X className="h-4 w-4" /></button>
            </div>
          )}
          <div className="space-y-6">
            { (["none","brand","adv"] as GroupMode[]).includes(groupMode) ? (
              Object.entries(tree as FlatTree).map(([label, bucket])=> {
                const key = `${groupMode}::${label}`;
                const isCollapsed = !!collapsedBucket[key];
                const showAll = !!expandedFlatAll[key];
                const rows: Campaign[] = showAll ? bucket.__flat : bucket.__flat.slice(0, 10);
                const idsSet = groupMode==="brand"
                  ? (idsByBrand.get(label) || new Set<number>())
                  : (idsByAdv.get(label) || new Set<number>());
                const all = Array.from(idsSet).every(id => selected.has(id));
                const some = !all && Array.from(idsSet).some(id => selected.has(id));
                const total = bucket.__flat.length;
                return (
                  <section key={label} className="rounded-2xl border bg-white p-3 shadow-sm sm:p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <TriStateCheckbox
                          checked={all}
                          indeterminate={some}
                          onChange={()=> groupMode==="brand" ? toggleBrandAll(label) : toggleAdvAll(label)}
                          ariaLabel={groupMode==="brand" ? `Выбрать бренд ${label}` : `Выбрать рекламодателя ${label}`}
                        />
                        <button
                          onClick={()=> setCollapsedBucket(prev=>({ ...prev, [key]: !prev[key] }))}
                          className="rounded-full bg-[color:var(--adr-light-blue)]/10 px-2 py-1 text-xs text-[color:var(--adr-blue)] ring-1 ring-[color:var(--adr-light-blue)]/50"
                        >
                          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
                        </button>
                        <div className="min-w-0 truncate text-left text-lg font-semibold sm:text-xl">
                          {label}
                          <span className="ml-2 rounded-full bg-[color:var(--adr-surface)] px-2 py-0.5 text-xs text-[color:var(--adr-text-muted)]">{total}</span>
                        </div>
                      </div>
                      {total > 10 && (
                        <button
                          onClick={() => {
                            setCollapsedBucket((prev) => ({ ...prev, [key]: !isCollapsed }));
                            if (!isCollapsed) {
                              setExpandedFlatAll((prev) => ({ ...prev, [key]: false }));
                            }
                          }}
                          className="rounded-full bg-white px-3 py-1 text-xs text-[color:var(--adr-blue)] ring-1 ring-[color:var(--adr-blue)]"
                        >
                          {isCollapsed ? "Развернуть список" : "Свернуть список"}
                        </button>
                      )}
                    </div>
                    {!isCollapsed && (
                      <div>
                        <CampaignRows rows={rows} />
                        {total > 10 && (
                          <div className="border-t bg-white px-3 py-2 flex justify-end">
                            <button
                              onClick={()=> setExpandedFlatAll(prev=>({ ...prev, [key]: !prev[key] }))}
                              className="rounded-full bg-white px-3 py-1 text-xs text-[color:var(--adr-blue)] ring-1 ring-[color:var(--adr-blue)]"
                            >
                              {showAll ? "Свернуть список" : `Показать ещё (${total - 10})`}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                );
              })
            ) : (
              Object.entries(tree as NestedTree).map(([advLabel, brands])=>(
                <section key={advLabel} className="rounded-2xl border bg-white p-3 shadow-sm sm:p-4">
                  <div className="mb-2 flex min-w-0 items-center gap-3">
                    {(()=> {
                      const ids = idsByAdv.get(advLabel) || new Set<number>();
                      const all = Array.from(ids).every(id => selected.has(id));
                      const some = !all && Array.from(ids).some(id => selected.has(id));
                      return (
                        <TriStateCheckbox
                          checked={all} indeterminate={some}
                          onChange={()=>toggleAdvAll(advLabel)}
                          ariaLabel={`Выбрать рекламодателя ${advLabel}`}
                        />
                      );
                    })()}
                    <button
                      onClick={()=> setCollapsedAdv(prev=>({ ...prev, [advLabel]: !prev[advLabel] }))}
                      className="rounded-full bg-[color:var(--adr-light-blue)]/10 px-2 py-1 text-xs text-[color:var(--adr-blue)] ring-1 ring-[color:var(--adr-light-blue)]/50"
                      title={collapsedAdv[advLabel] ? "Развернуть" : "Свернуть"}
                    >
                      <ChevronRight className={`h-3.5 w-3.5 transition-transform ${collapsedAdv[advLabel] ? "" : "rotate-90"}`} />
                    </button>
                    <div className="min-w-0 truncate text-left text-lg font-semibold sm:text-xl">
                      {advLabel}
                      <span className="ml-2 rounded-full bg-[color:var(--adr-surface)] px-2 py-0.5 text-xs text-[color:var(--adr-text-muted)]">
                        {(idsByAdv.get(advLabel) || new Set<number>()).size}
                      </span>
                    </div>
                  </div>
                  {!collapsedAdv[advLabel] && Object.entries(brands).map(([brandLabel, bucket])=> {
                    const brandKey = `${advLabel}::${brandLabel}`;
                    const isCollapsed = !!collapsedBrand[brandKey];
                    const showAll = !!expandedBrandAll[brandKey];
                    const rows: Campaign[] = showAll ? bucket.__flat : bucket.__flat.slice(0, 10);
                    const total = bucket.__flat.length;
                    return (
                      <div key={brandKey} className="mb-4 rounded-xl border bg-white">
                        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                          <div className="flex min-w-0 items-center gap-3">
                            {(()=> {
                              const ids = idsByAdvBrand.get(advLabel)?.get(brandLabel) || new Set<number>();
                              const all = Array.from(ids).every(id => selected.has(id));
                              const some = !all && Array.from(ids).some(id => selected.has(id));
                              return (
                                <TriStateCheckbox
                                  checked={all} indeterminate={some}
                                  onChange={()=>toggleBrandUnderAdv(advLabel, brandLabel)}
                                  ariaLabel={`Выбрать бренд ${brandLabel}`}
                                />
                              );
                            })()}
                            <button
                              onClick={()=> setCollapsedBrand(prev=>({ ...prev, [brandKey]: !prev[brandKey] }))}
                              className="rounded-full bg-[color:var(--adr-light-blue)]/10 px-2 py-1 text-xs text-[color:var(--adr-blue)] ring-1 ring-[color:var(--adr-light-blue)]/50"
                            >
                              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
                            </button>
                            <div className="min-w-0 truncate text-left font-semibold">{brandLabel}
                              <span className="ml-2 rounded-full bg-[color:var(--adr-surface)] px-2 py-0.5 text-xs text-[color:var(--adr-text-muted)]">{total}</span>
                            </div>
                          </div>
                          {total > 10 && (
                            <button
                              onClick={() => {
                                setCollapsedBrand((prev) => ({ ...prev, [brandKey]: !isCollapsed }));
                                if (!isCollapsed) {
                                  setExpandedBrandAll((prev) => ({ ...prev, [brandKey]: false }));
                                }
                              }}
                              className="rounded-full bg-white px-3 py-1 text-xs text-[color:var(--adr-blue)] ring-1 ring-[color:var(--adr-blue)]"
                            >
                              {isCollapsed ? "Развернуть список" : "Свернуть список"}
                            </button>
                          )}
                        </div>
                        {!isCollapsed && (
                          <div>
                            <CampaignRows rows={rows} />
                            {total > 10 && (
                              <div className="border-t bg-white px-3 py-2 flex justify-end">
                                <button
                                  onClick={()=> setExpandedBrandAll(prev=>({ ...prev, [brandKey]: !prev[brandKey] }))}
                                  className="rounded-full bg-white px-3 py-1 text-xs text-[color:var(--adr-blue)] ring-1 ring-[color:var(--adr-blue)]"
                                >
                                  {showAll ? "Свернуть список" : `Показать ещё (${total - 10})`}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </section>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
