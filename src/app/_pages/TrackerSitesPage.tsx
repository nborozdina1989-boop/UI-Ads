"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, AlertCircle, CheckCircle2, Copy, Lightbulb, Pencil, Plus, Search, X } from "lucide-react";
import { getCampaignStats, listCampaigns, type Campaign } from "@/lib/campaigns";
import { listMediaplans, type MediaplanRecord, type PlacementRow } from "@/lib/mediaplan";
import TabsNav from "./_TabsNav";

type TrackerSiteStatus = "active" | "created" | "empty" | "unused";
type TrackerSiteOwnership = "own" | "delegated";
type OwnershipFilter = "all" | TrackerSiteOwnership;
type ActivityFilter = "all" | "with-imps" | "without-imps";
type SortMode = "name" | "id" | "imps" | "owner" | "url";
type TrackerCodeType = "js" | "img" | "finance";
type TrackerGoalType = "button" | "checkpoint" | "cart" | "purchase" | "connection" | "testDrive";
type CodeVerificationStatus = "not_requested" | "pending" | "checked";
type DataAccessSubjectType = "advertiser" | "agency" | "thirdParty";
type DataAccessScope = "stats" | "logs" | "both";

type TrackerGoal = {
  id: string;
  name: string;
  type: TrackerGoalType;
};

type DataAccessGrant = {
  id: string;
  name: string;
  email: string;
  subjectType: DataAccessSubjectType;
  scope: DataAccessScope;
  requestedByOwner?: boolean;
};

type TrackerFilterDefaults = {
  ownership: OwnershipFilter;
  activity: ActivityFilter;
  showUnused: boolean;
  sort: SortMode;
  pageSize: number;
};

type TrackerSiteRow = {
  id: string;
  name: string;
  shortName?: string;
  url?: string;
  urlKey?: string;
  aliases?: string[];
  adminName?: string;
  adminEmail?: string;
  unused?: boolean;
  codeType?: TrackerCodeType;
  goals?: TrackerGoal[];
  accessGrants?: DataAccessGrant[];
  codeVerificationStatus?: CodeVerificationStatus;
  codeVerificationRequestedAt?: string;
  ownership: TrackerSiteOwnership;
  owner: string;
  campaignIds: number[];
  campaignNames: string[];
  scenarios: number;
  imps: number;
  clicks: number;
  updatedAt: string;
  status: TrackerSiteStatus;
};

type CreatedTrackerSite = {
  id: string;
  name: string;
  shortName: string;
  url: string;
  urlKey: string;
  aliases: string[];
  adminName: string;
  adminEmail: string;
  codeType: TrackerCodeType;
  goals: TrackerGoal[];
  accessGrants: DataAccessGrant[];
  codeVerificationStatus?: CodeVerificationStatus;
  codeVerificationRequestedAt?: string;
  unused?: boolean;
  createdAt: string;
  updatedAt?: string;
};

type TrackerSiteForm = {
  name: string;
  shortName: string;
  url: string;
  aliases: string[];
  adminName: string;
  adminEmail: string;
  codeType: TrackerCodeType;
  goals: TrackerGoal[];
  accessGrants: DataAccessGrant[];
  unused: boolean;
};

const INT_FORMATTER = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const STORAGE_KEY = "adriver/tracker-sites/advertiser-sites";
const FILTERS_STORAGE_KEY = "adriver/tracker-sites/default-filters";
const DEFAULT_FILTERS: TrackerFilterDefaults = {
  ownership: "all",
  activity: "all",
  showUnused: false,
  sort: "imps",
  pageSize: 10,
};
const TRACKER_CODE_TYPES: { value: TrackerCodeType; title: string; description: string }[] = [
  {
    value: "js",
    title: "Стандартный JS-код",
    description: "Полноценный сбор данных, если на сайте можно разместить JavaScript.",
  },
  {
    value: "img",
    title: "IMG-код без JS",
    description: "Пиксель для страниц, где JavaScript недоступен или нежелателен.",
  },
  {
    value: "finance",
    title: "Код для финансовых сервисов",
    description: "Для ограниченных окружений, например фреймов, где нельзя поставить JS или FPS-библиотеку.",
  },
];
const TRACKER_GOAL_TYPES: { value: TrackerGoalType; label: string }[] = [
  { value: "button", label: "Кнопка" },
  { value: "checkpoint", label: "Контрольная точка" },
  { value: "cart", label: "Добавление в корзину" },
  { value: "purchase", label: "Покупка" },
  { value: "connection", label: "Подключение" },
  { value: "testDrive", label: "Запись на тест-драйв" },
];
const DATA_ACCESS_SUBJECT_TYPES: { value: DataAccessSubjectType; label: string }[] = [
  { value: "advertiser", label: "Ответственный рекламодателя" },
  { value: "agency", label: "Ответственный агентства" },
  { value: "thirdParty", label: "Третье лицо по запросу владельца" },
];
const DATA_ACCESS_SCOPES: { value: DataAccessScope; label: string }[] = [
  { value: "stats", label: "Статистика" },
  { value: "logs", label: "Логи" },
  { value: "both", label: "Статистика и логи" },
];
const SYSTEM_ACCESS_GRANTS: { name: string; subject: string; scope: DataAccessScope }[] = [
  { name: "Аккаунт-менеджеры AdRiver", subject: "Сопровождение клиента", scope: "both" },
  { name: "Технический дивизион AdRiver", subject: "Проверка кодов и диагностика", scope: "logs" },
];
const EMPTY_FORM: TrackerSiteForm = {
  name: "",
  shortName: "",
  url: "",
  aliases: [],
  adminName: "",
  adminEmail: "",
  codeType: "js",
  goals: [],
  accessGrants: [],
  unused: false,
};

function getTrackerCodeTypeLabel(value: TrackerCodeType | undefined) {
  return TRACKER_CODE_TYPES.find((item) => item.value === value)?.title || "Стандартный JS-код";
}

function getVerificationLabel(value: CodeVerificationStatus | undefined) {
  if (value === "pending") return "Ожидает проверки";
  if (value === "checked") return "Проверено";
  return "Не отправлено";
}

function buildCrossSiteCode(siteId: string, codeType: TrackerCodeType, siteUrl: string) {
  const siteParam = encodeURIComponent(siteId);
  const domain = getUrlKey(siteUrl) || "example.ru";
  if (codeType === "img") {
    return `<img src="https://ad.adriver.ru/cgi-bin/track.cgi?site=${siteParam}&event=pageview&url=%%PAGE_URL%%" width="1" height="1" alt="" style="position:absolute;left:-9999px;" />`;
  }
  if (codeType === "finance") {
    return `<img src="https://ad.adriver.ru/cgi-bin/fps-track.cgi?site=${siteParam}&event=pageview&domain=${encodeURIComponent(domain)}&url=%%PAGE_URL%%" width="1" height="1" alt="" referrerpolicy="no-referrer-when-downgrade" />`;
  }
  return `<script async src="https://ad.adriver.ru/tracker/site.js?site=${siteParam}"></script>
<script>
  window.adriverTracker = window.adriverTracker || [];
  window.adriverTracker.push({
    site: "${siteId}",
    event: "pageview",
    url: window.location.href
  });
</script>`;
}

function getGoalTypeLabel(value: TrackerGoalType) {
  return TRACKER_GOAL_TYPES.find((item) => item.value === value)?.label || "Целевое действие";
}

function getAccessSubjectLabel(value: DataAccessSubjectType) {
  return DATA_ACCESS_SUBJECT_TYPES.find((item) => item.value === value)?.label || "Ответственный";
}

function getAccessScopeLabel(value: DataAccessScope) {
  return DATA_ACCESS_SCOPES.find((item) => item.value === value)?.label || "Статистика";
}

function makeGoalId(seed: string) {
  return `goal_${Math.round(hashUnit(`${seed}:${Date.now()}`) * 100000).toString().padStart(5, "0")}`;
}

function makeAccessGrantId(seed: string) {
  return `access_${Math.round(hashUnit(`${seed}:${Date.now()}`) * 100000).toString().padStart(5, "0")}`;
}

function buildGoalCode(siteId: string, goal: TrackerGoal, codeType: TrackerCodeType) {
  const siteParam = encodeURIComponent(siteId);
  const goalParam = encodeURIComponent(goal.id);
  const goalName = goal.name || getGoalTypeLabel(goal.type);
  if (codeType === "img" || codeType === "finance") {
    const endpoint = codeType === "finance" ? "fps-goal.cgi" : "goal.cgi";
    return `<img src="https://ad.adriver.ru/cgi-bin/${endpoint}?site=${siteParam}&goal=${goalParam}&event=conversion&url=%%PAGE_URL%%" width="1" height="1" alt="${goalName}" style="position:absolute;left:-9999px;" />`;
  }
  return `<script>
  window.adriverTracker = window.adriverTracker || [];
  window.adriverTracker.push({
    site: "${siteId}",
    goal: "${goal.id}",
    event: "conversion",
    name: "${goalName.replace(/"/g, '\\"')}"
  });
</script>`;
}

function fmtInt(value: number) {
  return INT_FORMATTER.format(Math.max(0, Math.trunc(value)));
}

function fmtPct(clicks: number, imps: number) {
  if (!imps) return "0,00%";
  return `${((clicks / imps) * 100).toFixed(2).replace(".", ",")}%`;
}

function fmtDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU");
}

function hashUnit(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

function isWebTrackerPlacement(row: PlacementRow) {
  if (row.tracker_site?.length) return row.tracker_site.includes("Web");
  return row.environment === "web" || row.environment === "mixed";
}

function normalizeName(value: string | undefined, fallback: string) {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeUrl(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function getUrlKey(value: string) {
  const normalized = normalizeUrl(value);
  if (!normalized) return "";
  try {
    const url = new URL(normalized);
    return `${url.hostname.replace(/^www\./i, "").toLowerCase()}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return "";
  }
}

function getUrlKeys(values: string[]) {
  return values.map(getUrlKey).filter(Boolean);
}

function makeShortName(value: string, existing: Set<string>) {
  const cleaned = value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/[^a-zA-Zа-яА-Я0-9]+/g, "")
    .slice(0, 9)
    .toUpperCase();
  const base = cleaned || "SITE";
  if (!existing.has(base.toLowerCase())) return base;
  for (let i = 2; i < 100; i += 1) {
    const suffix = String(i);
    const candidate = `${base.slice(0, Math.max(1, 9 - suffix.length))}${suffix}`;
    if (!existing.has(candidate.toLowerCase())) return candidate;
  }
  return base.slice(0, 7) + "99";
}

function normalizeShortName(value: string) {
  return value
    .replace(/[^a-zA-Zа-яА-Я0-9]+/g, "")
    .slice(0, 9)
    .toUpperCase();
}

function normalizeAliases(values: string[]) {
  const seen = new Set<string>();
  const aliases: string[] = [];
  values.forEach((value) => {
    const normalized = normalizeUrl(value);
    const key = getUrlKey(normalized);
    if (!key || seen.has(key)) return;
    seen.add(key);
    aliases.push(normalized);
  });
  return aliases.slice(0, 9);
}

function readCreatedSites(): CreatedTrackerSite[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is CreatedTrackerSite =>
        Boolean(item && typeof item.id === "string" && typeof item.name === "string" && typeof item.url === "string")
      )
      .map((item) => ({
        ...item,
        aliases: Array.isArray(item.aliases) ? item.aliases.filter((alias) => typeof alias === "string") : [],
        codeType: item.codeType === "img" || item.codeType === "finance" ? item.codeType : "js",
        goals: Array.isArray(item.goals)
          ? item.goals.filter((goal): goal is TrackerGoal =>
              Boolean(
                goal &&
                  typeof goal.id === "string" &&
                  typeof goal.name === "string" &&
                  TRACKER_GOAL_TYPES.some((type) => type.value === goal.type)
              )
            )
          : [],
        accessGrants: Array.isArray(item.accessGrants)
          ? item.accessGrants.filter((grant): grant is DataAccessGrant =>
              Boolean(
                grant &&
                  typeof grant.id === "string" &&
                  typeof grant.name === "string" &&
                  typeof grant.email === "string" &&
                  DATA_ACCESS_SUBJECT_TYPES.some((type) => type.value === grant.subjectType) &&
                  DATA_ACCESS_SCOPES.some((scope) => scope.value === grant.scope)
              )
            )
          : [],
        codeVerificationStatus:
          item.codeVerificationStatus === "pending" || item.codeVerificationStatus === "checked"
            ? item.codeVerificationStatus
            : "not_requested",
        codeVerificationRequestedAt:
          typeof item.codeVerificationRequestedAt === "string" ? item.codeVerificationRequestedAt : undefined,
        unused: Boolean(item.unused),
      }));
  } catch {
    return [];
  }
}

function saveCreatedSites(items: CreatedTrackerSite[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function readFilterDefaults(): TrackerFilterDefaults {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FILTERS_STORAGE_KEY) || "{}");
    return {
      ownership: parsed.ownership === "own" || parsed.ownership === "delegated" ? parsed.ownership : "all",
      activity: parsed.activity === "with-imps" || parsed.activity === "without-imps" ? parsed.activity : "all",
      showUnused: Boolean(parsed.showUnused),
      sort: ["name", "id", "imps", "owner", "url"].includes(parsed.sort) ? parsed.sort : "imps",
      pageSize: [10, 25, 50, 100].includes(parsed.pageSize) ? parsed.pageSize : 10,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function saveFilterDefaults(filters: TrackerFilterDefaults) {
  window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
}

function findCampaignForMediaplan(mediaplan: MediaplanRecord, campaigns: Campaign[]) {
  return (
    campaigns.find((campaign) => campaign.mediaplanId === mediaplan.id) ||
    campaigns.find((campaign) => campaign.name === mediaplan.campaignName || campaign.name === mediaplan.title) ||
    null
  );
}

function addTrackerRow(
  rows: Map<string, TrackerSiteRow>,
  params: {
    campaign: Campaign;
    name: string;
    sourceId: string;
    scenarios: number;
    updatedAt: string;
    shareSeed: string;
  }
) {
  const key = params.sourceId;
  const existing = rows.get(key);
  const stats = getCampaignStats(params.campaign);
  const share = 0.08 + hashUnit(`${params.shareSeed}:share`) * 0.18;
  const imps = Math.round(stats.total.imps * share);
  const clicks = Math.round(stats.total.clicks * share);
  const urlKey = getUrlKey(params.name);
  const next: TrackerSiteRow =
    existing || {
      id: `ts_web_${Math.round(hashUnit(key) * 100000).toString().padStart(5, "0")}`,
      name: params.name,
      urlKey: urlKey || undefined,
      codeType: "js",
      ownership: params.campaign.delegated && !params.campaign.own ? "delegated" : "own",
      owner: params.campaign.advertiser || "Мой аккаунт",
      campaignIds: [],
      campaignNames: [],
      scenarios: 0,
      imps: 0,
      clicks: 0,
      updatedAt: params.updatedAt,
      status: "empty",
    };

  if (!next.campaignIds.includes(params.campaign.id)) {
    next.campaignIds.push(params.campaign.id);
    next.campaignNames.push(params.campaign.name);
  }
  if (params.campaign.own) {
    next.ownership = "own";
  }
  if (!next.owner || next.owner === "Мой аккаунт") {
    next.owner = params.campaign.advertiser || next.owner || "Мой аккаунт";
  }
  next.scenarios += params.scenarios;
  next.imps += imps;
  next.clicks += clicks;
  next.updatedAt = new Date(params.updatedAt).getTime() > new Date(next.updatedAt).getTime() ? params.updatedAt : next.updatedAt;
  next.status = next.imps > 0 ? "active" : "empty";
  rows.set(key, next);
}

function createdSiteToRow(site: CreatedTrackerSite): TrackerSiteRow {
  return {
    id: site.id,
    name: site.name,
    shortName: site.shortName,
    url: site.url,
    urlKey: site.urlKey,
    aliases: site.aliases,
    adminName: site.adminName,
    adminEmail: site.adminEmail,
    codeType: site.codeType,
    goals: site.goals,
    accessGrants: site.accessGrants,
    codeVerificationStatus: site.codeVerificationStatus || "not_requested",
    codeVerificationRequestedAt: site.codeVerificationRequestedAt,
    unused: Boolean(site.unused),
    ownership: "own",
    owner: "Мой аккаунт",
    campaignIds: [],
    campaignNames: [],
    scenarios: 0,
    imps: 0,
    clicks: 0,
    updatedAt: site.updatedAt || site.createdAt,
    status: site.unused ? "unused" : "created",
  };
}

function buildTrackerRows(campaigns: Campaign[], mediaplans: MediaplanRecord[], createdSites: CreatedTrackerSite[]): TrackerSiteRow[] {
  const rows = new Map<string, TrackerSiteRow>();

  mediaplans.forEach((mediaplan) => {
    const campaign = findCampaignForMediaplan(mediaplan, campaigns);
    if (!campaign) return;

    const placementRows = mediaplan.import?.rows || [];
    if (!placementRows.length) return;

    placementRows.forEach((placement, index) => {
      if (!isWebTrackerPlacement(placement)) return;
      addTrackerRow(rows, {
        campaign,
        name: normalizeName(placement.platform_name, mediaplan.campaignName || campaign.name),
        sourceId: `${mediaplan.id}:${placement.platform_name || index}`,
        scenarios: 1,
        updatedAt: mediaplan.updatedAt || mediaplan.uploadedAt,
        shareSeed: `${mediaplan.id}:${index}:Web`,
      });
    });
  });

  createdSites.forEach((site) => {
    rows.set(`created:${site.id}`, createdSiteToRow(site));
  });

  return Array.from(rows.values()).sort((a, b) => {
    if (a.status === "unused" && b.status !== "unused") return 1;
    if (b.status === "unused" && a.status !== "unused") return -1;
    if (a.status === "created" && b.status !== "created") return -1;
    if (b.status === "created" && a.status !== "created") return 1;
    return b.imps - a.imps;
  });
}

export default function TrackerSitesPage() {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [createdSites, setCreatedSites] = useState<CreatedTrackerSite[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<TrackerSiteForm>(EMPTY_FORM);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [savedSiteId, setSavedSiteId] = useState<string | null>(null);
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>(DEFAULT_FILTERS.ownership);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>(DEFAULT_FILTERS.activity);
  const [showUnused, setShowUnused] = useState(DEFAULT_FILTERS.showUnused);
  const [sortMode, setSortMode] = useState<SortMode>(DEFAULT_FILTERS.sort);
  const [pageSize, setPageSize] = useState(DEFAULT_FILTERS.pageSize);
  const [pageIndex, setPageIndex] = useState(0);
  const [filtersSaved, setFiltersSaved] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [copiedCrossCode, setCopiedCrossCode] = useState(false);
  const [copiedGoalCode, setCopiedGoalCode] = useState<string | null>(null);

  useEffect(() => {
    const defaults = readFilterDefaults();
    setOwnershipFilter(defaults.ownership);
    setActivityFilter(defaults.activity);
    setShowUnused(defaults.showUnused);
    setSortMode(defaults.sort);
    setPageSize(defaults.pageSize);
    setCreatedSites(readCreatedSites());
    setMounted(true);
  }, []);

  const rows = useMemo(() => {
    if (!mounted) return [];
    return buildTrackerRows(listCampaigns(), listMediaplans(), createdSites);
  }, [createdSites, mounted]);

  const existingUrlKeys = useMemo(() => {
    const keys = new Set<string>();
    rows.forEach((row) => {
      if (row.id === editingSiteId) return;
      if (row.urlKey) keys.add(row.urlKey);
      getUrlKeys(row.aliases || []).forEach((key) => keys.add(key));
    });
    return keys;
  }, [editingSiteId, rows]);
  const existingShortNames = useMemo(
    () =>
      new Set(
        rows
          .filter((row) => row.id !== editingSiteId)
          .map((row) => row.shortName || row.name)
          .filter(Boolean)
          .map((value) => value.toLowerCase())
      ),
    [editingSiteId, rows]
  );

  const formUrlKey = getUrlKey(form.url);
  const isDuplicateUrl = Boolean(formUrlKey && existingUrlKeys.has(formUrlKey));
  const aliasKeys = getUrlKeys(form.aliases);
  const hasDuplicateAlias = aliasKeys.some(
    (key, index) => key === formUrlKey || existingUrlKeys.has(key) || aliasKeys.indexOf(key) !== index
  );
  const hasInvalidAlias = form.aliases.some((alias) => alias.trim() && !getUrlKey(alias));
  const hasInvalidAccessGrant = form.accessGrants.some(
    (grant) => !grant.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(grant.email.trim())
  );
  const isShortNameDuplicate = Boolean(
    form.shortName.trim() &&
    existingShortNames.has(form.shortName.trim().toLowerCase())
  );
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail.trim());
  const isUrlValid = Boolean(formUrlKey);
  const shortNameSuggestion = useMemo(
    () => makeShortName(form.name || form.url, existingShortNames),
    [existingShortNames, form.name, form.url]
  );
  const shouldShowShortNameSuggestion = Boolean((form.name.trim() || form.url.trim()) && shortNameSuggestion);
  const editingRow = useMemo(
    () => (editingSiteId ? rows.find((row) => row.id === editingSiteId) || null : null),
    [editingSiteId, rows]
  );
  const editingSiteRecord = useMemo(
    () => (editingSiteId ? createdSites.find((site) => site.id === editingSiteId) || null : null),
    [createdSites, editingSiteId]
  );
  const activeSlicesCount = editingRow?.scenarios || 0;
  const crossSiteCode = editingSiteId ? buildCrossSiteCode(editingSiteId, form.codeType, form.url) : "";
  const canSave =
    form.name.trim() &&
    form.shortName.trim() &&
    form.url.trim() &&
    form.adminName.trim() &&
    form.adminEmail.trim() &&
    isEmailValid &&
    isUrlValid &&
    !isDuplicateUrl &&
    !hasDuplicateAlias &&
    !hasInvalidAlias &&
    !hasInvalidAccessGrant &&
    !isShortNameDuplicate;

  useEffect(() => {
    setPageIndex(0);
  }, [activityFilter, ownershipFilter, pageSize, query, showUnused, sortMode]);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (row.unused && !showUnused) return false;
      if (ownershipFilter !== "all" && row.ownership !== ownershipFilter) return false;
      if (activityFilter === "with-imps" && row.imps <= 0) return false;
      if (activityFilter === "without-imps" && row.imps > 0) return false;
      if (!term) return true;
      return [
        row.id,
        row.name,
        row.shortName,
        row.url,
        row.owner,
        row.adminName,
        row.adminEmail,
        getTrackerCodeTypeLabel(row.codeType),
        getVerificationLabel(row.codeVerificationStatus),
        ...(row.goals || []).map((goal) => `${goal.name} ${getGoalTypeLabel(goal.type)}`),
        ...(row.accessGrants || []).flatMap((grant) => [
          grant.name,
          grant.email,
          getAccessSubjectLabel(grant.subjectType),
          getAccessScopeLabel(grant.scope),
        ]),
        ...(row.aliases || []),
        ...row.campaignNames,
      ]
        .some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [activityFilter, ownershipFilter, query, rows, showUnused]);

  const sortedRows = useMemo(() => {
    const getText = (row: TrackerSiteRow) => {
      if (sortMode === "id") return row.id;
      if (sortMode === "owner") return row.owner;
      if (sortMode === "url") return row.url || row.urlKey || "";
      return row.name;
    };
    return [...filteredRows].sort((a, b) => {
      if (sortMode === "imps") return b.imps - a.imps || a.name.localeCompare(b.name, "ru");
      return getText(a).localeCompare(getText(b), "ru", { numeric: true }) || b.imps - a.imps;
    });
  }, [filteredRows, sortMode]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const visibleRows = useMemo(
    () => sortedRows.slice(safePageIndex * pageSize, safePageIndex * pageSize + pageSize),
    [pageSize, safePageIndex, sortedRows]
  );

  const currentFilters = useMemo<TrackerFilterDefaults>(
    () => ({ ownership: ownershipFilter, activity: activityFilter, showUnused, sort: sortMode, pageSize }),
    [activityFilter, ownershipFilter, pageSize, showUnused, sortMode]
  );

  const saveCurrentFiltersAsDefault = () => {
    saveFilterDefaults(currentFilters);
    setFiltersSaved(true);
    window.setTimeout(() => setFiltersSaved(false), 1600);
  };

  const updateForm = (patch: Partial<TrackerSiteForm>) => {
    setSavedSiteId(null);
    setCopiedCrossCode(false);
    setCopiedGoalCode(null);
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (patch.shortName !== undefined) {
        next.shortName = normalizeShortName(patch.shortName);
      }
      if ((patch.name !== undefined || patch.url !== undefined) && !prev.shortName.trim()) {
        const source = patch.name || patch.url || next.name || next.url;
        next.shortName = makeShortName(source, existingShortNames);
      }
      return next;
    });
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingSiteId(null);
    setSavedSiteId(null);
    setDeleteConfirmOpen(false);
    setCopiedCrossCode(false);
    setCopiedGoalCode(null);
  };

  const openSiteForm = (site: CreatedTrackerSite) => {
    setForm({
      name: site.name,
      shortName: site.shortName,
      url: site.url,
      aliases: site.aliases.length ? site.aliases : [],
      adminName: site.adminName,
      adminEmail: site.adminEmail,
      codeType: site.codeType,
      goals: site.goals,
      accessGrants: site.accessGrants,
      unused: Boolean(site.unused),
    });
    setEditingSiteId(site.id);
    setSavedSiteId(null);
    setDeleteConfirmOpen(false);
    setCopiedCrossCode(false);
    setCopiedGoalCode(null);
    setIsFormOpen(true);
  };

  const updateAlias = (index: number, value: string) => {
    setSavedSiteId(null);
    setForm((prev) => {
      const aliases = [...prev.aliases];
      aliases[index] = value;
      return { ...prev, aliases };
    });
  };

  const addAlias = () => {
    setSavedSiteId(null);
    setForm((prev) => ({ ...prev, aliases: prev.aliases.length >= 9 ? prev.aliases : [...prev.aliases, ""] }));
  };

  const removeAlias = (index: number) => {
    setSavedSiteId(null);
    setForm((prev) => ({ ...prev, aliases: prev.aliases.filter((_, aliasIndex) => aliasIndex !== index) }));
  };

  const addGoal = () => {
    setSavedSiteId(null);
    setCopiedGoalCode(null);
    setForm((prev) => ({
      ...prev,
      goals: [
        ...prev.goals,
        {
          id: makeGoalId(`${editingSiteId || formUrlKey || prev.name}:goal`),
          name: "",
          type: "button",
        },
      ],
    }));
  };

  const updateGoal = (index: number, patch: Partial<TrackerGoal>) => {
    setSavedSiteId(null);
    setCopiedGoalCode(null);
    setForm((prev) => ({
      ...prev,
      goals: prev.goals.map((goal, goalIndex) => (goalIndex === index ? { ...goal, ...patch } : goal)),
    }));
  };

  const removeGoal = (index: number) => {
    setSavedSiteId(null);
    setCopiedGoalCode(null);
    setForm((prev) => ({ ...prev, goals: prev.goals.filter((_, goalIndex) => goalIndex !== index) }));
  };

  const addAccessGrant = () => {
    setSavedSiteId(null);
    setForm((prev) => ({
      ...prev,
      accessGrants: [
        ...prev.accessGrants,
        {
          id: makeAccessGrantId(`${editingSiteId || formUrlKey || prev.name}:access`),
          name: "",
          email: "",
          subjectType: "agency",
          scope: "stats",
          requestedByOwner: false,
        },
      ],
    }));
  };

  const updateAccessGrant = (index: number, patch: Partial<DataAccessGrant>) => {
    setSavedSiteId(null);
    setForm((prev) => ({
      ...prev,
      accessGrants: prev.accessGrants.map((grant, grantIndex) => (grantIndex === index ? { ...grant, ...patch } : grant)),
    }));
  };

  const removeAccessGrant = (index: number) => {
    setSavedSiteId(null);
    setForm((prev) => ({ ...prev, accessGrants: prev.accessGrants.filter((_, grantIndex) => grantIndex !== index) }));
  };

  const saveSite = () => {
    if (!canSave) return;
    const now = new Date().toISOString();
    const existingSite = editingSiteId ? createdSites.find((site) => site.id === editingSiteId) : null;
    const site: CreatedTrackerSite = {
      id: existingSite?.id || `ts_adv_${Math.round(hashUnit(`${formUrlKey}:${now}`) * 100000).toString().padStart(5, "0")}`,
      name: form.name.trim(),
      shortName: form.shortName.trim(),
      url: normalizeUrl(form.url),
      urlKey: formUrlKey,
      aliases: normalizeAliases(form.aliases),
      adminName: form.adminName.trim(),
      adminEmail: form.adminEmail.trim(),
      codeType: form.codeType,
      goals: form.goals.map((goal) => ({
        ...goal,
        name: goal.name.trim() || getGoalTypeLabel(goal.type),
      })),
      accessGrants: form.accessGrants.map((grant) => ({
        ...grant,
        name: grant.name.trim(),
        email: grant.email.trim(),
        requestedByOwner: grant.subjectType === "thirdParty" ? Boolean(grant.requestedByOwner) : false,
      })),
      codeVerificationStatus: existingSite?.codeVerificationStatus || "not_requested",
      codeVerificationRequestedAt: existingSite?.codeVerificationRequestedAt,
      unused: form.unused,
      createdAt: existingSite?.createdAt || now,
      updatedAt: now,
    };
    const next = existingSite ? createdSites.map((item) => (item.id === site.id ? site : item)) : [site, ...createdSites];
    saveCreatedSites(next);
    setCreatedSites(next);
    setSavedSiteId(site.id);
    setForm(EMPTY_FORM);
    setEditingSiteId(null);
    setDeleteConfirmOpen(false);
    setCopiedCrossCode(false);
    setCopiedGoalCode(null);
    setIsFormOpen(false);
  };

  const deleteSite = () => {
    if (!editingSiteId) return;
    const next = createdSites.filter((site) => site.id !== editingSiteId);
    saveCreatedSites(next);
    setCreatedSites(next);
    setForm(EMPTY_FORM);
    setEditingSiteId(null);
    setDeleteConfirmOpen(false);
    setSavedSiteId(null);
    setCopiedCrossCode(false);
    setCopiedGoalCode(null);
    setIsFormOpen(false);
  };

  const copyCrossSiteCode = () => {
    if (!crossSiteCode || typeof navigator === "undefined") return;
    void navigator.clipboard.writeText(crossSiteCode).then(() => {
      setCopiedCrossCode(true);
      window.setTimeout(() => setCopiedCrossCode(false), 1600);
    });
  };

  const copyGoalCode = (goal: TrackerGoal) => {
    if (!editingSiteId || typeof navigator === "undefined") return;
    const code = buildGoalCode(editingSiteId, goal, form.codeType);
    void navigator.clipboard.writeText(code).then(() => {
      setCopiedGoalCode(goal.id);
      window.setTimeout(() => setCopiedGoalCode(null), 1600);
    });
  };

  const requestCodeVerification = () => {
    if (!editingSiteId) return;
    const now = new Date().toISOString();
    const next = createdSites.map((site) =>
      site.id === editingSiteId
        ? { ...site, codeVerificationStatus: "pending" as CodeVerificationStatus, codeVerificationRequestedAt: now, updatedAt: now }
        : site
    );
    saveCreatedSites(next);
    setCreatedSites(next);
  };

  return (
    <main className="p-6">
      <TabsNav active="tracker-sites" />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-950">Трекерные сайты</h1>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsFormOpen(true);
          }}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-sky-600 px-4 text-sm font-medium text-white transition hover:bg-sky-700"
        >
          <Plus className="h-4 w-4" />
          Добавить сайт
        </button>
      </div>

      {isFormOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 px-3 py-6 sm:px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tracker-site-form-title"
        >
          <section className="flex max-h-[calc(100vh-48px)] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 id="tracker-site-form-title" className="text-base font-semibold text-slate-950">
                {editingSiteId ? "Анкета трекерного сайта" : "Создание трекерного сайта"}
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {editingSiteId ? "Изменения вступят в силу только после сохранения." : "Сайт рекламодателя для сбора данных и аналитики кампаний."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setIsFormOpen(false);
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Закрыть форму"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="grid gap-4 lg:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
              Название сайта
              <input
                value={form.name}
                onChange={(event) => updateForm({ name: event.target.value })}
                className="h-10 rounded-md border border-slate-300 px-3 text-base font-normal text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                placeholder="Например, Сайт рекламодателя"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
              Краткое название
              <input
                value={form.shortName}
                onChange={(event) => updateForm({ shortName: event.target.value })}
                className={`h-10 rounded-md border px-3 text-base font-normal text-slate-950 outline-none transition focus:ring-2 ${
                  isShortNameDuplicate ? "border-red-300 focus:border-red-500 focus:ring-red-100" : "border-slate-300 focus:border-sky-500 focus:ring-sky-100"
                }`}
                placeholder="До 9 символов"
              />
              {shouldShowShortNameSuggestion ? (
                <div className="flex flex-wrap items-center gap-2 text-xs font-normal text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Lightbulb className="h-3.5 w-3.5 text-sky-600" />
                    Подсказка:
                  </span>
                  <button
                    type="button"
                    onClick={() => updateForm({ shortName: shortNameSuggestion })}
                    className="rounded border border-sky-200 bg-sky-50 px-2 py-0.5 font-mono text-sky-800 hover:bg-sky-100"
                  >
                    {shortNameSuggestion}
                  </button>
                  <span>можно применить или отредактировать вручную</span>
                </div>
              ) : null}
              {isShortNameDuplicate ? <span className="text-xs font-normal text-red-600">Краткое название уже используется.</span> : null}
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
              URL сайта
              <input
                value={form.url}
                onChange={(event) => updateForm({ url: event.target.value })}
                className={`h-10 rounded-md border px-3 text-base font-normal text-slate-950 outline-none transition focus:ring-2 ${
                  form.url.trim() && (!isUrlValid || isDuplicateUrl)
                    ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                    : "border-slate-300 focus:border-sky-500 focus:ring-sky-100"
                }`}
                placeholder="https://example.ru"
              />
              {form.url.trim() && !isUrlValid ? <span className="text-xs font-normal text-red-600">Укажите корректный URL.</span> : null}
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
              Имя администратора
              <input
                value={form.adminName}
                onChange={(event) => updateForm({ adminName: event.target.value })}
                className="h-10 rounded-md border border-slate-300 px-3 text-base font-normal text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                placeholder="Имя и фамилия"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 lg:col-span-2">
              Email администратора
              <input
                value={form.adminEmail}
                onChange={(event) => updateForm({ adminEmail: event.target.value })}
                className={`h-10 rounded-md border px-3 text-base font-normal text-slate-950 outline-none transition focus:ring-2 ${
                  form.adminEmail.trim() && !isEmailValid
                    ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                    : "border-slate-300 focus:border-sky-500 focus:ring-sky-100"
                }`}
                placeholder="admin@example.ru"
              />
              {form.adminEmail.trim() && !isEmailValid ? <span className="text-xs font-normal text-red-600">Укажите корректный email.</span> : null}
            </label>

            <div className="lg:col-span-2">
              <div className="mb-2">
                <div className="text-sm font-medium text-slate-700">Тип трекерного кода</div>
                <div className="text-xs text-slate-500">Выберите вариант установки с учетом технических ограничений сайта.</div>
              </div>
              <div className="grid gap-2 lg:grid-cols-3">
                {TRACKER_CODE_TYPES.map((item) => {
                  const selected = form.codeType === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => updateForm({ codeType: item.value })}
                      className={`rounded-md border px-3 py-3 text-left transition ${
                        selected
                          ? "border-sky-500 bg-sky-50 ring-2 ring-sky-100"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                        <span className={`h-2.5 w-2.5 rounded-full ${selected ? "bg-sky-600" : "bg-slate-300"}`} />
                        {item.title}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-800">Доступ к статистике и логам</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Контролируйте, кто видит данные трекерного сайта. Системные доступы AdRiver показаны отдельно и не редактируются.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addAccessGrant}
                    className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Добавить доступ
                  </button>
                </div>

                <div className="mb-3 grid gap-2 lg:grid-cols-2">
                  {SYSTEM_ACCESS_GRANTS.map((grant) => (
                    <div key={grant.name} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-sm font-medium text-slate-800">{grant.name}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{grant.subject}</div>
                      <div className="mt-1 text-xs text-slate-600">Доступ: {getAccessScopeLabel(grant.scope)}</div>
                    </div>
                  ))}
                </div>

                {form.accessGrants.length ? (
                  <div className="space-y-2">
                    {form.accessGrants.map((grant, index) => {
                      const emailInvalid = Boolean(grant.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(grant.email.trim()));
                      return (
                        <div key={grant.id} className="rounded-md border border-slate-200 p-3">
                          <div className="grid gap-2 lg:grid-cols-[1fr_1fr_210px_190px_auto]">
                            <input
                              value={grant.name}
                              onChange={(event) => updateAccessGrant(index, { name: event.target.value })}
                              className="h-10 rounded-md border border-slate-300 px-3 text-base text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                              placeholder="Имя или аккаунт"
                            />
                            <input
                              value={grant.email}
                              onChange={(event) => updateAccessGrant(index, { email: event.target.value })}
                              className={`h-10 rounded-md border px-3 text-base text-slate-950 outline-none transition focus:ring-2 ${
                                emailInvalid
                                  ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                                  : "border-slate-300 focus:border-sky-500 focus:ring-sky-100"
                              }`}
                              placeholder="email@example.ru"
                            />
                            <select
                              value={grant.subjectType}
                              onChange={(event) => updateAccessGrant(index, { subjectType: event.target.value as DataAccessSubjectType })}
                              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700"
                            >
                              {DATA_ACCESS_SUBJECT_TYPES.map((item) => (
                                <option key={item.value} value={item.value}>{item.label}</option>
                              ))}
                            </select>
                            <select
                              value={grant.scope}
                              onChange={(event) => updateAccessGrant(index, { scope: event.target.value as DataAccessScope })}
                              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700"
                            >
                              {DATA_ACCESS_SCOPES.map((item) => (
                                <option key={item.value} value={item.value}>{item.label}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => removeAccessGrant(index)}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                              aria-label="Удалить доступ"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          {grant.subjectType === "thirdParty" ? (
                            <label className="mt-2 flex items-start gap-2 text-xs text-slate-600">
                              <input
                                type="checkbox"
                                checked={Boolean(grant.requestedByOwner)}
                                onChange={(event) => updateAccessGrant(index, { requestedByOwner: event.target.checked })}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300"
                              />
                              <span>Доступ предоставляется по запросу владельца кабинета</span>
                            </label>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500">
                    <span>Дополнительные доступы не выданы.</span>
                    <button
                      type="button"
                      onClick={addAccessGrant}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Добавить первый доступ
                    </button>
                  </div>
                )}
                {hasInvalidAccessGrant ? (
                  <div className="mt-2 text-xs text-red-600">Для каждого доступа укажите имя и корректный email.</div>
                ) : null}
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-700">Сквозной код</div>
                  <div className="text-xs text-slate-500">
                    Установите один раз на все страницы сайта. Код работает как просмотровый; сайтзоны можно будет добавлять по URL-шаблону без перевыдачи кода.
                  </div>
                </div>
                {editingSiteId ? (
                  <button
                    type="button"
                    onClick={copyCrossSiteCode}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Copy className="h-4 w-4" />
                    {copiedCrossCode ? "Скопировано" : "Скопировать"}
                  </button>
                ) : null}
              </div>
              {editingSiteId ? (
                <pre className="max-h-56 overflow-auto rounded-md border border-slate-200 bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                  <code>{crossSiteCode}</code>
                </pre>
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500">
                  Сквозной код будет доступен после сохранения сайта.
                </div>
              )}
            </div>

            <div className="lg:col-span-2">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-700">Коды целевых действий</div>
                  <div className="text-xs text-slate-500">
                    Добавьте отдельный код для кнопки, контрольной точки или конверсии. Каждый код устанавливается в точке события.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addGoal}
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Добавить цель
                </button>
              </div>

              {form.goals.length ? (
                <div className="space-y-3">
                  {form.goals.map((goal, index) => {
                    const goalCode = editingSiteId ? buildGoalCode(editingSiteId, goal, form.codeType) : "";
                    return (
                      <div key={goal.id} className="rounded-md border border-slate-200">
                        <div className="grid gap-2 border-b border-slate-200 p-3 lg:grid-cols-[1fr_220px_auto]">
                          <input
                            value={goal.name}
                            onChange={(event) => updateGoal(index, { name: event.target.value })}
                            className="h-10 rounded-md border border-slate-300 px-3 text-base text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                            placeholder="Название цели, например Покупка"
                          />
                          <select
                            value={goal.type}
                            onChange={(event) => updateGoal(index, { type: event.target.value as TrackerGoalType })}
                            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700"
                          >
                            {TRACKER_GOAL_TYPES.map((item) => (
                              <option key={item.value} value={item.value}>{item.label}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeGoal(index)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                            aria-label="Удалить цель"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        {editingSiteId ? (
                          <div className="p-3">
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <div className="text-xs text-slate-500">
                                Установите этот код на событие: {goal.name || getGoalTypeLabel(goal.type)}.
                              </div>
                              <button
                                type="button"
                                onClick={() => copyGoalCode(goal)}
                                className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                {copiedGoalCode === goal.id ? "Скопировано" : "Скопировать"}
                              </button>
                            </div>
                            <pre className="max-h-44 overflow-auto rounded-md border border-slate-200 bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                              <code>{goalCode}</code>
                            </pre>
                          </div>
                        ) : (
                          <div className="px-3 py-2 text-sm text-slate-500">
                            Код цели будет доступен после сохранения сайта.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500">
                  <span>Целевые действия не добавлены.</span>
                  <button
                    type="button"
                    onClick={addGoal}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Добавить первую цель
                  </button>
                </div>
              )}
            </div>

            <div className="lg:col-span-2">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-800">Проверка установки кодов</div>
                    <div className="mt-1 text-xs text-slate-500">
                      После установки сквозного кода и кодов целей отправьте сайт менеджеру AdRiver на проверку.
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    editingSiteRecord?.codeVerificationStatus === "pending"
                      ? "bg-amber-100 text-amber-800"
                      : editingSiteRecord?.codeVerificationStatus === "checked"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-700"
                  }`}>
                    {getVerificationLabel(editingSiteRecord?.codeVerificationStatus)}
                  </span>
                </div>

                {editingSiteRecord?.codeVerificationRequestedAt ? (
                  <div className="mt-2 text-xs text-slate-500">
                    Отправлено менеджеру: {fmtDate(editingSiteRecord.codeVerificationRequestedAt)}
                  </div>
                ) : null}

                {editingSiteId ? (
                  <button
                    type="button"
                    onClick={requestCodeVerification}
                    className="mt-3 h-9 rounded-md bg-sky-600 px-3 text-sm font-medium text-white hover:bg-sky-700"
                  >
                    Сообщить менеджеру, что коды установлены
                  </button>
                ) : (
                  <div className="mt-3 rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-500">
                    Проверка будет доступна после сохранения сайта.
                  </div>
                )}

                <div className="mt-4 border-t border-slate-200 pt-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Самостоятельная проверка</div>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
                    <li>Откройте страницу сайта, где установлен сквозной код.</li>
                    <li>В инструментах разработчика откройте Network и отфильтруйте запросы по adriver.</li>
                    <li>Обновите страницу и убедитесь, что просмотровый запрос ушел без ошибки.</li>
                    <li>Выполните целевое действие и проверьте отдельный запрос с ID цели.</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-700">Алиасы сайта</div>
                  <div className="text-xs text-slate-500">
                    Альтернативные домены или URL одного сайта. Можно указать без протокола.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{form.aliases.length}/9</span>
                  <button
                    type="button"
                    onClick={addAlias}
                    disabled={form.aliases.length >= 9}
                    className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Добавить алиас
                  </button>
                </div>
              </div>
              {form.aliases.length ? (
                <div className="space-y-2">
                  {form.aliases.map((alias, index) => {
                    const aliasKey = getUrlKey(alias);
                    const aliasInvalid = Boolean(alias.trim() && !aliasKey);
                    const aliasDuplicate = Boolean(aliasKey && (aliasKey === formUrlKey || existingUrlKeys.has(aliasKey)));
                    return (
                      <div key={index} className="flex gap-2">
                        <input
                          value={alias}
                          onChange={(event) => updateAlias(index, event.target.value)}
                          className={`h-10 min-w-0 flex-1 rounded-md border px-3 text-base font-normal text-slate-950 outline-none transition focus:ring-2 ${
                            aliasInvalid || aliasDuplicate
                              ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                              : "border-slate-300 focus:border-sky-500 focus:ring-sky-100"
                          }`}
                          placeholder={`alias-${index + 1}.example.ru или https://alias-${index + 1}.example.ru/path`}
                        />
                        <button
                          type="button"
                          onClick={() => removeAlias(index)}
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                          aria-label="Удалить алиас"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500">
                  <span>Алиасы не указаны.</span>
                  <button
                    type="button"
                    onClick={addAlias}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Добавить первый алиас
                  </button>
                </div>
              )}
              {hasInvalidAlias ? <div className="mt-1 text-xs text-red-600">Проверьте формат URL в алиасах.</div> : null}
              {hasDuplicateAlias ? <div className="mt-1 text-xs text-red-600">Алиас совпадает с основным URL или уже используется.</div> : null}
            </div>

            <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 lg:col-span-2">
              <input
                type="checkbox"
                checked={form.unused}
                onChange={(event) => updateForm({ unused: event.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>
                <span className="block font-medium text-slate-800">Сайт не используется</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Сайт будет скрыт из списка по умолчанию, но анкета и историческая статистика сохранятся.
                </span>
              </span>
            </label>
            </div>
          </div>

          {isDuplicateUrl ? (
            <div className="mx-4 mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Этот сайт уже есть в AdRiver. Если владелец сайта уже использует AdRiver, повторно добавлять сайт агентству не нужно.</span>
            </div>
          ) : null}

          {editingSiteId && deleteConfirmOpen ? (
            <div className="mx-4 mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-950">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-medium">Удалить трекерный сайт?</div>
                  <div className="mt-1">
                    Активных слайсов: <span className="font-semibold">{fmtInt(activeSlicesCount)}</span>. После удаления статистика по этому сайту больше не будет доступна в списке.
                  </div>
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="h-9 rounded-md border border-red-200 bg-white px-3 text-sm font-medium text-red-800 hover:bg-red-50"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={deleteSite}
                  className="h-9 rounded-md bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-700"
                >
                  Удалить сайт
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex shrink-0 flex-wrap justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3">
            <div>
              {editingSiteId ? (
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="h-10 rounded-md border border-red-300 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Удалить сайт
                </button>
              ) : null}
            </div>
            <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setIsFormOpen(false);
              }}
              className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={saveSite}
              className="h-10 rounded-md bg-sky-600 px-4 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {editingSiteId ? "Сохранить изменения" : "Сохранить сайт"}
            </button>
            </div>
          </div>
          </section>
        </div>
      ) : null}

      {savedSiteId ? (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Анкета сайта сохранена.
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по сайту, кампании или ID"
              className="h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={ownershipFilter}
              onChange={(event) => setOwnershipFilter(event.target.value as OwnershipFilter)}
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700"
              aria-label="Тип сайтов"
            >
              <option value="all">Все сайты</option>
              <option value="own">Собственные</option>
              <option value="delegated">Делегированные</option>
            </select>
            <select
              value={activityFilter}
              onChange={(event) => setActivityFilter(event.target.value as ActivityFilter)}
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700"
              aria-label="Показы за сегодня"
            >
              <option value="all">Все по показам</option>
              <option value="with-imps">С показами сегодня</option>
              <option value="without-imps">Без показов сегодня</option>
            </select>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700"
              aria-label="Сортировка"
            >
              <option value="imps">Сортировать: показы</option>
              <option value="name">Сортировать: имя</option>
              <option value="id">Сортировать: ID</option>
              <option value="owner">Сортировать: владелец</option>
              <option value="url">Сортировать: URL</option>
            </select>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700"
              aria-label="Строк на странице"
            >
              <option value={10}>10 строк</option>
              <option value={25}>25 строк</option>
              <option value={50}>50 строк</option>
              <option value={100}>100 строк</option>
            </select>
            <label className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showUnused}
                onChange={(event) => setShowUnused(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Показывать неиспользуемые
            </label>
            <button
              type="button"
              onClick={saveCurrentFiltersAsDefault}
              className="h-9 rounded-md border border-sky-300 bg-white px-3 text-sm font-medium text-sky-700 hover:bg-sky-50"
            >
              Сохранить фильтр
            </button>
            <div className="text-sm text-slate-500">
              Найдено: {fmtInt(sortedRows.length)}
              {filtersSaved ? <span className="ml-2 text-emerald-700">сохранено</span> : null}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Трекерный сайт</th>
                <th className="px-4 py-3 font-semibold">Владелец</th>
                <th className="px-4 py-3 font-semibold">Кампании</th>
                <th className="px-4 py-3 font-semibold text-right">Сценарии</th>
                <th className="px-4 py-3 font-semibold text-right">Показы</th>
                <th className="px-4 py-3 font-semibold text-right">Клики</th>
                <th className="px-4 py-3 font-semibold text-right">CTR</th>
                <th className="px-4 py-3 font-semibold">Обновление</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!mounted ? (
                <tr>
                  <td className="px-4 py-8 text-slate-500" colSpan={9}>Загружаем трекерные сайты...</td>
                </tr>
              ) : visibleRows.length ? (
                visibleRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-950">{row.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        <span className="font-mono">{row.id}</span>
                        {row.shortName ? <span>{row.shortName}</span> : null}
                        {row.url ? <span>{row.url}</span> : null}
                        <span>{getTrackerCodeTypeLabel(row.codeType)}</span>
                        {row.unused ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">не используется</span> : null}
                      </div>
                      {row.aliases?.length ? (
                        <div className="mt-1 text-xs text-slate-500">Алиасы: {row.aliases.slice(0, 2).join(", ")}{row.aliases.length > 2 ? ` +${row.aliases.length - 2}` : ""}</div>
                      ) : null}
                      {row.goals?.length ? (
                        <div className="mt-1 text-xs text-slate-500">Цели: {row.goals.map((goal) => goal.name || getGoalTypeLabel(goal.type)).slice(0, 2).join(", ")}{row.goals.length > 2 ? ` +${row.goals.length - 2}` : ""}</div>
                      ) : null}
                      {row.accessGrants?.length ? (
                        <div className="mt-1 text-xs text-slate-500">Доступы: {row.accessGrants.length} доп.</div>
                      ) : null}
                      {row.codeVerificationStatus && row.codeVerificationStatus !== "not_requested" ? (
                        <div className="mt-1 text-xs text-slate-500">Проверка кодов: {getVerificationLabel(row.codeVerificationStatus)}</div>
                      ) : null}
                      {row.adminName || row.adminEmail ? (
                        <div className="mt-1 text-xs text-slate-500">
                          {row.adminName}
                          {row.adminName && row.adminEmail ? " · " : ""}
                          {row.adminEmail}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-800">{row.owner}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {row.ownership === "own" ? "Собственный" : "Делегированный"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {row.campaignIds.length ? <div className="flex flex-col gap-1">
                        {row.campaignIds.slice(0, 2).map((campaignId, index) => (
                          <Link
                            key={campaignId}
                            href={`/campaigns/${campaignId}`}
                            className="text-sky-700 hover:text-sky-900 hover:underline"
                          >
                            {row.campaignNames[index] || `Кампания ${campaignId}`}
                          </Link>
                        ))}
                        {row.campaignIds.length > 2 ? (
                          <span className="text-xs text-slate-500">+{row.campaignIds.length - 2} еще</span>
                        ) : null}
                      </div> : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{fmtInt(row.scenarios)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-900">{fmtInt(row.imps)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{fmtInt(row.clicks)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{fmtPct(row.clicks, row.imps)}</td>
                    <td className="px-4 py-3 text-slate-600">{fmtDate(row.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 text-sm ${row.status === "active" ? "text-emerald-700" : "text-slate-600"}`}>
                          {row.status === "active" ? <CheckCircle2 className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                          {row.status === "active" ? "Активен" : row.status === "created" ? "Создан" : row.status === "unused" ? "Не используется" : "Нет данных"}
                        </span>
                        {row.status === "created" || row.status === "unused" ? (
                          <button
                            type="button"
                            onClick={() => {
                              const site = createdSites.find((item) => item.id === row.id);
                              if (site) openSiteForm(site);
                            }}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Анкета
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-8 text-slate-500" colSpan={9}>Трекерные сайты не найдены.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {sortedRows.length > pageSize ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
            <div>
              Страница {fmtInt(safePageIndex + 1)} из {fmtInt(pageCount)}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPageIndex((value) => Math.max(0, value - 1))}
                disabled={safePageIndex === 0}
                className="h-9 rounded-md border border-slate-300 bg-white px-3 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Назад
              </button>
              <button
                type="button"
                onClick={() => setPageIndex((value) => Math.min(pageCount - 1, value + 1))}
                disabled={safePageIndex >= pageCount - 1}
                className="h-9 rounded-md border border-slate-300 bg-white px-3 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Вперед
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
