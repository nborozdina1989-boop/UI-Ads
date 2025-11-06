const LS_KEY = "adriver_campaigns_v4";
const GROUPS_KEY = "adriver_campaign_groups_v1";
const CTX_KEY = "adriver_campaigns_ctx_v1";

export type Campaign = {
  id: string;
  name: string;
  advertiser: string;
  brand: string;
  type: string;
  status: "Активна" | "Не активна" | "archived";
  createdAt: string;
  favorite: boolean;
  delegated: boolean;
  own: boolean;
};

export type Group = {
  id: string;
  name: string;
  createdAt: string;
  campaignIds: string[];
  description?: string;
  favorite?: boolean;
};

type AdvertiserSpec = {
  name: string;
  brands: string[];
};

const ADVERTISERS: AdvertiserSpec[] = [
  { name: "Рекламодатель А", brands: ["Бренд 1", "Бренд 2", "Бренд 3"] },
  { name: "Рекламодатель B", brands: ["Бренд 4", "Бренд 5", "Бренд 6"] },
];

const NO_ADVERTISER_NAME = "Без рекламодателя";
const NO_BRAND_NAME = "Без бренда";
const NO_ADVERTISER_COUNT = 100;

function makeBaseCampaigns(): Campaign[] {
  const result: Campaign[] = [];
  let counter = 1;
  const baseId = 900000;

  for (const adv of ADVERTISERS) {
    for (const brand of adv.brands) {
      for (let i = 1; i <= 100; i++) {
        const idNum = baseId + counter;
        const id = String(idNum);
        result.push(makeCampaign(id, i, adv.name, brand, counter));
        counter++;
      }
    }
  }

  for (let i = 1; i <= NO_ADVERTISER_COUNT; i++) {
    const idNum = baseId + counter;
    const id = String(idNum);
    result.push(makeCampaign(id, i, NO_ADVERTISER_NAME, NO_BRAND_NAME, counter));
    counter++;
  }

  return result;
}

// 80% "Активна"
function statusFromSeed(seed: number): "Активна" | "Не активна" {
  return seed % 5 === 0 ? "Не активна" : "Активна";
}

function makeCampaign(
  id: string,
  indexInBrand: number,
  advertiser: string,
  brand: string,
  seed: number
): Campaign {
  const createdAt = makeCreatedDate(seed);
  const type = seed % 9 === 0 ? "Делегированная" : "Собственная";
  const status = statusFromSeed(seed);
  const favorite = seed % 7 === 0;
  const delegated = type === "Делегированная" ? true : seed % 11 === 0;

  return {
    id,
    name: `Рекламная кампания ${indexInBrand}`,
    advertiser,
    brand,
    type,
    status,
    createdAt,
    favorite,
    delegated,
    own: !delegated,
  };
}

function makeCreatedDate(shift: number): string {
  const base = new Date("2025-01-15T10:00:00Z");
  base.setDate(base.getDate() - shift);
  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy}`;
}

function loadFromLS(): Campaign[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(LS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Campaign[];
    return [];
  } catch {
    return [];
  }
}

function saveToLS(list: Campaign[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_KEY, JSON.stringify(list));
}

// ===== КАМПАНИИ =====

export function listCampaigns(): Campaign[] {
  const fromLS = loadFromLS();
  if (fromLS.length > 0) return fromLS;
  const base = makeBaseCampaigns();
  saveToLS(base);
  return base;
}

export function saveCampaign(c: Campaign) {
  const list = listCampaigns();
  const idx = list.findIndex((x) => x.id === c.id);
  if (idx >= 0) list[idx] = c;
  else list.push(c);
  saveToLS(list);
}

export function toggleFavorite(id: string) {
  const list = listCampaigns();
  const idx = list.findIndex((x) => x.id === id);
  if (idx === -1) return;
  list[idx].favorite = !list[idx].favorite;
  saveToLS(list);
}

export function archiveCampaign(id: string) {
  const list = listCampaigns();
  const idx = list.findIndex((x) => x.id === id);
  if (idx === -1) return;
  list[idx].status = "archived";
  saveToLS(list);
}

export function deleteCampaign(id: string) {
  const list = listCampaigns().filter((x) => x.id !== id);
  saveToLS(list);
}

export function clearAllCampaignsForDebug() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LS_KEY);
}

// ===== ГРУППЫ =====

function loadGroups(): Group[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(GROUPS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Group[];
    return [];
  } catch {
    return [];
  }
}

function saveGroups(list: Group[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GROUPS_KEY, JSON.stringify(list));
}

export function listGroups(): Group[] {
  return loadGroups();
}

export function createGroup(name: string, campaignIds: string[] = [], description = ""): Group {
  const groups = loadGroups();
  const id = "grp_" + String(groups.length + 1).padStart(3, "0");
  const g: Group = {
    id,
    name,
    createdAt: new Date().toISOString(),
    campaignIds,
    description,
    favorite: false,
  };
  groups.push(g);
  saveGroups(groups);
  return g;
}

export function toggleFavGroup(id: string) {
  const groups = loadGroups();
  const idx = groups.findIndex((g) => g.id === id);
  if (idx === -1) return;
  const g = groups[idx];
  g.favorite = !g.favorite;
  groups[idx] = g;
  saveGroups(groups);
}

export function deleteGroup(id: string) {
  const groups = loadGroups().filter((g) => g.id !== id);
  saveGroups(groups);
}

// ===== КОНТЕКСТ =====

export function readCtx(): any {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(CTX_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
    return {};
  } catch {
    return {};
  }
}

export function saveCtx(ctx: any) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CTX_KEY, JSON.stringify(ctx || {}));
}

// ===== ЭКСПОРТ =====

export function exportExcel(campaigns: Campaign[]) {
  if (typeof window === "undefined") return;
  const header = "ID;Название;Рекламодатель;Бренд;Тип;Статус;Создана\n";
  const rows = campaigns
    .map((c) => {
      return `${c.id};${c.name};${c.advertiser};${c.brand};${c.type};${c.status};${c.createdAt}`;
    })
    .join("\n");
  const csv = header + rows;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "adriver_campaigns.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export type CampaignStats = {
  today: { imps: number; clicks: number; };
  yesterday: { imps: number; clicks: number; };
  total: { imps: number; clicks: number; };
};

export function getCampaignStats(id: number): CampaignStats {
  // детерминированный псевдорандом от id
  const rnd = (seed: number) => {
    let x = Math.imul(seed ^ 0x9e3779b1, 0x85ebca6b) >>> 0;
    x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0; x ^= x >>> 16;
    return x / 0xFFFFFFFF;
  };
  const baseImps = Math.floor(20000 + rnd(id) * 4_000_000);        // 20k .. 4.02M
  const baseClk  = Math.max(0, Math.floor(baseImps * (0.003 + rnd(id+1)*0.02))); // ~0.3%..2.3%

  const todayImps = Math.floor(baseImps * (0.02 + rnd(id+2)*0.08));      // ~2%..10%
  const yestImps  = Math.floor(baseImps * (0.02 + rnd(id+3)*0.08));
  const todayClk  = Math.max(0, Math.floor(todayImps * (0.003 + rnd(id+4)*0.02)));
  const yestClk   = Math.max(0, Math.floor(yestImps  * (0.003 + rnd(id+5)*0.02)));

  return {
    today: { imps: todayImps, clicks: todayClk },
    yesterday: { imps: yestImps, clicks: yestClk },
    total: { imps: baseImps, clicks: baseClk },
  };
}

const TAGS_KEY = "campaignTagsV1";
function loadTagsMap(): Record<string, string[]> { if (typeof window === "undefined") return {}; try { return JSON.parse(localStorage.getItem(TAGS_KEY) || "{}") || {}; } catch { return {}; } }
function saveTagsMap(m: Record<string, string[]>) { if (typeof window === "undefined") return; localStorage.setItem(TAGS_KEY, JSON.stringify(m)); }
const normTag = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ").slice(0,48);
export function getCampaignTags(id: number): string[] { const m = loadTagsMap(); return (m[String(id)] || []).slice(); }
export function setCampaignTags(id: number, tags: string[]) { const m = loadTagsMap(); m[String(id)] = Array.from(new Set(tags.map(normTag).filter(Boolean))); saveTagsMap(m); }
export function addCampaignTag(id:number, tag:string){ const curr=getCampaignTags(id); setCampaignTags(id,[...curr,tag]); }
export function removeCampaignTag(id:number, tag:string){ const t=normTag(tag); setCampaignTags(id,getCampaignTags(id).filter(x=>x!==t)); }
export function getAllTagsMap(): Record<number,string[]>{ const raw=loadTagsMap(); const out:Record<number,string[]>{}; Object.keys(raw).forEach(k=>out[Number(k)]=raw[k]); return out; }
