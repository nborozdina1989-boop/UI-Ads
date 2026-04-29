import type { MediaplanRecord } from "./mediaplan";

const LS_KEY = "adriver_campaigns_v4";
const GROUPS_KEY = "adriver_campaign_groups_v1";
const CTX_KEY = "adriver_campaigns_ctx_v1";

export type Campaign = {
  id: number;
  name: string;
  advertiser: string;
  brand: string;
  type: string;
  status: "Активна" | "Не активна" | "archived";
  createdAt: string;
  favorite: boolean;
  delegated: boolean;
  own: boolean;
  mediaplanId?: string;
  source?: "seed" | "mediaplan";
};

export type Group = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  campaignIds: number[];
  description?: string;
  sharedWith: string[];
  favorite: boolean;
};

export const MAX_GROUP_CAMPAIGNS = 50;

type AdvertiserSpec = {
  name: string;
  brands: string[];
};

const ADVERTISERS: AdvertiserSpec[] = [
  { name: "Рекламодатель А", brands: ["Бренд 1", "Бренд 2", "Бренд 3"] },
  { name: "Рекламодатель B", brands: ["Бренд 4", "Бренд 5", "Бренд 6"] },
  { name: "Рекламодатель C", brands: ["Бренд 7", "Бренд 8", "Бренд 9"] },
  { name: "Рекламодатель D", brands: ["Бренд 10", "Бренд 11", "Бренд 12"] },
];

const NO_ADVERTISER_NAME = "Без рекламодателя";
const NO_BRAND_NAME = "Без бренда";
const NO_ADVERTISER_COUNT = 100;
const BASE_ID = 900000;
const LEGACY_MOCK_MAX_ID = 900700;
const MOCK_CAMPAIGN_NAME_PREFIX = "Рекламная кампания ";
const MOCK_CAMPAIGN_NAME_RE = /^Рекламная кампания \d+$/;

function makeBaseCampaigns(): Campaign[] {
  const result: Campaign[] = [];
  let counter = 1;

  for (const adv of ADVERTISERS) {
    for (const brand of adv.brands) {
      for (let i = 1; i <= 100; i++) {
        const idNum = BASE_ID + counter;
        result.push(makeCampaign(idNum, counter, adv.name, brand, counter));
        counter++;
      }
    }
  }

  for (let i = 1; i <= NO_ADVERTISER_COUNT; i++) {
    const idNum = BASE_ID + counter;
    result.push(makeCampaign(idNum, counter, NO_ADVERTISER_NAME, NO_BRAND_NAME, counter));
    counter++;
  }

  return result;
}

// 80% "Активна"
function statusFromSeed(seed: number): "Активна" | "Не активна" {
  return seed % 5 === 0 ? "Не активна" : "Активна";
}

function makeCampaign(
  id: number,
  nameIndex: number,
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
    name: `${MOCK_CAMPAIGN_NAME_PREFIX}${nameIndex}`,
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
    if (Array.isArray(parsed)) return parsed.map(normalizeCampaign).filter((x): x is Campaign => x !== null);
    return [];
  } catch {
    return [];
  }
}

function normalizeCampaign(raw: unknown): Campaign | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<Campaign> & { id?: unknown; mediaplanId?: unknown; source?: unknown };
  const id = Number(c.id);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    name: String(c.name ?? ""),
    advertiser: String(c.advertiser ?? ""),
    brand: String(c.brand ?? ""),
    type: String(c.type ?? ""),
    status: c.status === "archived" ? "archived" : c.status === "Не активна" ? "Не активна" : "Активна",
    createdAt: String(c.createdAt ?? ""),
    favorite: Boolean(c.favorite),
    delegated: Boolean(c.delegated),
    own: Boolean(c.own),
    mediaplanId: c.mediaplanId == null ? undefined : String(c.mediaplanId),
    source: c.source === "mediaplan" ? "mediaplan" : c.source === "seed" ? "seed" : undefined,
  };
}

export function normalizeCampaignStorage(): { campaigns: number; groups: number; tags: number } {
  if (typeof window === "undefined") return { campaigns: 0, groups: 0, tags: 0 };

  let campaigns = 0;
  let groups = 0;
  let tags = 0;

  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const normalized = parsed.map(normalizeCampaign).filter((x): x is Campaign => x !== null);
        campaigns = normalized.length;
        window.localStorage.setItem(LS_KEY, JSON.stringify(normalized));
      }
    }
  } catch {}

  try {
    const raw = window.localStorage.getItem(GROUPS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const normalized = parsed.map(normalizeGroup).filter((x): x is Group => x !== null);
        groups = normalized.length;
        window.localStorage.setItem(GROUPS_KEY, JSON.stringify(normalized));
      }
    }
  } catch {}

  try {
    const raw = window.localStorage.getItem(TAGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object") {
        const out: Record<string, string[]> = {};
        Object.entries(parsed as Record<string, unknown>).forEach(([key, val]) => {
          const numKey = Number(key);
          if (!Number.isFinite(numKey)) return;
          const arr = Array.isArray(val) ? val.map((x) => normTag(String(x))).filter(Boolean) : [];
          out[String(numKey)] = Array.from(new Set(arr));
        });
        tags = Object.keys(out).length;
        window.localStorage.setItem(TAGS_KEY, JSON.stringify(out));
      }
    }
  } catch {}

  return { campaigns, groups, tags };
}

function saveToLS(list: Campaign[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_KEY, JSON.stringify(list));
}

// ===== КАМПАНИИ =====

export function listCampaigns(): Campaign[] {
  const fromLS = loadFromLS();
  if (fromLS.length > 0) {
    let normalized = fromLS;

    // Миграция: добавляем новые seed-кампании при расширении пула рекламодателей/брендов,
    // не трогая уже существующие записи.
    const withNewSeedCampaigns = appendNewSeedCampaigns(normalized);
    if (withNewSeedCampaigns.length !== normalized.length) {
      normalized = withNewSeedCampaigns;
    }

    const allMatchMockPattern = normalized.every((c) => MOCK_CAMPAIGN_NAME_RE.test(String(c.name || "").trim()));
    if (allMatchMockPattern && !hasSequentialMockNames(normalized)) {
      normalized = withSequentialMockNames(normalized);
    }

    if (normalized !== fromLS) {
      saveToLS(normalized);
      return normalized;
    }
    return fromLS;
  }
  const base = makeBaseCampaigns();
  saveToLS(base);
  return base;
}

function appendNewSeedCampaigns(list: Campaign[]): Campaign[] {
  // Применяем только к старому seed-набору, чтобы не вмешиваться в произвольные пользовательские наборы.
  const hasLegacySeed = list.some((c) => c.id > BASE_ID && c.id <= LEGACY_MOCK_MAX_ID);
  if (!hasLegacySeed) return list;

  const existingIds = new Set(list.map((c) => c.id));
  const additions = makeBaseCampaigns().filter((campaign) => campaign.id > LEGACY_MOCK_MAX_ID && !existingIds.has(campaign.id));
  if (!additions.length) return list;
  return [...list, ...additions];
}

function hasSequentialMockNames(list: Campaign[]): boolean {
  const sortedById = [...list].sort((a, b) => a.id - b.id);
  return sortedById.every((campaign, idx) => campaign.name === `${MOCK_CAMPAIGN_NAME_PREFIX}${idx + 1}`);
}

function withSequentialMockNames(list: Campaign[]): Campaign[] {
  const sortedById = [...list].sort((a, b) => a.id - b.id);
  const nameById = new Map<number, string>();
  sortedById.forEach((campaign, idx) => {
    nameById.set(campaign.id, `${MOCK_CAMPAIGN_NAME_PREFIX}${idx + 1}`);
  });
  return list.map((campaign) => {
    const nextName = nameById.get(campaign.id) ?? campaign.name;
    return nextName === campaign.name ? campaign : { ...campaign, name: nextName };
  });
}

export function saveCampaign(c: Campaign) {
  const list = listCampaigns();
  const idx = list.findIndex((x) => x.id === c.id);
  if (idx >= 0) list[idx] = c;
  else list.push(c);
  saveToLS(list);
}

export function upsertCampaignFromMediaplan(record: MediaplanRecord): Campaign {
  const list = listCampaigns();
  const existing = list.find((campaign) => campaign.mediaplanId === record.id);
  const name = normalizeCampaignName(record.campaignName || record.import?.meta.campaign_name || record.title);
  const advertiser = normalizeCampaignName(record.advertiser || record.import?.meta.advertiser || NO_ADVERTISER_NAME);
  const brand = normalizeCampaignName(record.brand || record.import?.meta.brand || NO_BRAND_NAME);
  const next: Campaign = {
    ...(existing || createMediaplanCampaignBase(list)),
    name,
    advertiser,
    brand,
    type: "Собственная",
    status: record.status === "кампания создана" ? "Активна" : "Не активна",
    createdAt: existing?.createdAt || formatCampaignCreatedAt(record.uploadedAt || record.updatedAt),
    delegated: false,
    own: true,
    mediaplanId: record.id,
    source: "mediaplan",
  };

  const idx = list.findIndex((campaign) => campaign.id === next.id);
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  saveToLS(list);
  return next;
}

function createMediaplanCampaignBase(list: Campaign[]): Campaign {
  const maxId = list.reduce((max, campaign) => Math.max(max, campaign.id), BASE_ID);
  return {
    id: maxId + 1,
    name: "",
    advertiser: NO_ADVERTISER_NAME,
    brand: NO_BRAND_NAME,
    type: "Собственная",
    status: "Активна",
    createdAt: formatCampaignCreatedAt(new Date().toISOString()),
    favorite: false,
    delegated: false,
    own: true,
    source: "mediaplan",
  };
}

function normalizeCampaignName(value: string): string {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function formatCampaignCreatedAt(raw?: string): string {
  const source = raw ? new Date(raw) : new Date();
  const date = Number.isNaN(source.getTime()) ? new Date() : source;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function toggleFavorite(id: number) {
  const list = listCampaigns();
  const idx = list.findIndex((x) => x.id === id);
  if (idx === -1) return;
  list[idx].favorite = !list[idx].favorite;
  saveToLS(list);
}

export function archiveCampaign(id: number) {
  const list = listCampaigns();
  const idx = list.findIndex((x) => x.id === id);
  if (idx === -1) return;
  list[idx].status = "archived";
  saveToLS(list);
}

export function deleteCampaign(id: number) {
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
    if (Array.isArray(parsed)) return parsed.map(normalizeGroup).filter((x): x is Group => x !== null);
    return [];
  } catch {
    return [];
  }
}

function normalizeGroup(raw: unknown): Group | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as {
    id?: unknown;
    name?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
    campaignIds?: unknown;
    description?: unknown;
    sharedWith?: unknown;
    favorite?: unknown;
    fav?: unknown;
  };
  if (!g.id) return null;
  const nowIso = new Date().toISOString();
  const createdAtRaw = String(g.createdAt ?? "").trim();
  const updatedAtRaw = String(g.updatedAt ?? "").trim();
  const createdAt = createdAtRaw || updatedAtRaw || nowIso;
  const updatedAt = updatedAtRaw || createdAt || nowIso;
  const campaignIds = normalizeCampaignIds(
    Array.isArray(g.campaignIds) ? g.campaignIds.map((x) => Number(x)) : []
  );
  const sharedWith = normalizeSharedWith(g.sharedWith);

  return {
    id: String(g.id),
    name: normalizeGroupName(String(g.name ?? "")),
    createdAt,
    updatedAt,
    campaignIds,
    description: g.description == null ? undefined : String(g.description),
    sharedWith,
    favorite: Boolean(g.favorite ?? g.fav),
  };
}

function saveGroups(list: Group[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GROUPS_KEY, JSON.stringify(list));
}

export function listGroups(): Group[] {
  const current = loadGroups();
  if (current.length > 0) {
    const withDefaultGroups = appendMissingSeedGroups(current);
    if (withDefaultGroups !== current) {
      saveGroups(withDefaultGroups);
      return withDefaultGroups;
    }
    return current;
  }

  const seeded = buildDefaultGroupsFromCampaigns();
  if (seeded.length) {
    saveGroups(seeded);
    return seeded;
  }
  return current;
}

export function createGroup(name: string, campaignIds: number[] = [], description = ""): Group {
  const groups = loadGroups();
  const normalizedName = ensureUniqueGroupName(groups, name);
  const normalizedCampaignIds = normalizeCampaignIds(campaignIds);
  assertGroupSize(normalizedCampaignIds.length);
  const nowIso = new Date().toISOString();
  const g: Group = {
    id: nextGroupId(groups),
    name: normalizedName,
    createdAt: nowIso,
    updatedAt: nowIso,
    campaignIds: normalizedCampaignIds,
    description: normalizeDescription(description),
    sharedWith: [],
    favorite: false,
  };
  groups.push(g);
  saveGroups(groups);
  return g;
}

export function toggleFavGroup(id: string) {
  const groups = loadGroups();
  const idx = groups.findIndex((g) => g.id === id);
  if (idx === -1) return groups;
  const g = groups[idx];
  g.favorite = !g.favorite;
  groups[idx] = g;
  saveGroups(groups);
  return groups;
}

export function renameGroup(id: string, name: string) {
  const groups = loadGroups();
  const idx = groups.findIndex((g) => g.id === id);
  if (idx === -1) return groups;
  const normalizedName = ensureUniqueGroupName(groups, name, id);
  if (groups[idx].name === normalizedName) return groups;
  groups[idx] = {
    ...groups[idx],
    name: normalizedName,
    updatedAt: new Date().toISOString(),
  };
  saveGroups(groups);
  return groups;
}

export function duplicateGroup(id: string) {
  const groups = loadGroups();
  const source = groups.find((g) => g.id === id);
  if (!source) return groups;
  assertGroupSize(source.campaignIds.length);
  const nowIso = new Date().toISOString();
  const duplicate: Group = {
    ...source,
    id: nextGroupId(groups),
    name: buildDuplicateGroupName(groups, source.name),
    createdAt: nowIso,
    updatedAt: nowIso,
    campaignIds: [...source.campaignIds],
    sharedWith: [...source.sharedWith],
    favorite: false,
  };
  groups.push(duplicate);
  saveGroups(groups);
  return groups;
}

export function addCampaignsToGroup(id: string, campaignIds: number[]) {
  const groups = loadGroups();
  const idx = groups.findIndex((g) => g.id === id);
  if (idx === -1) return groups;
  const incoming = normalizeCampaignIds(campaignIds);
  if (!incoming.length) return groups;
  const currentSet = new Set(groups[idx].campaignIds);
  const toAdd = incoming.filter((campaignId) => !currentSet.has(campaignId));
  if (!toAdd.length) return groups;
  const nextCampaignIds = [...groups[idx].campaignIds, ...toAdd];
  assertGroupSize(nextCampaignIds.length);
  groups[idx] = {
    ...groups[idx],
    campaignIds: nextCampaignIds,
    updatedAt: new Date().toISOString(),
  };
  saveGroups(groups);
  return groups;
}

export function removeCampaignFromGroup(id: string, campaignId: number) {
  const groups = loadGroups();
  const idx = groups.findIndex((g) => g.id === id);
  if (idx === -1) return groups;
  if (!groups[idx].campaignIds.includes(campaignId)) return groups;
  groups[idx] = {
    ...groups[idx],
    campaignIds: groups[idx].campaignIds.filter((value) => value !== campaignId),
    updatedAt: new Date().toISOString(),
  };
  saveGroups(groups);
  return groups;
}

export function setGroupSharedWith(id: string, sharedWith: string[]) {
  const groups = loadGroups();
  const idx = groups.findIndex((g) => g.id === id);
  if (idx === -1) return groups;
  groups[idx] = {
    ...groups[idx],
    sharedWith: normalizeSharedWith(sharedWith),
    updatedAt: new Date().toISOString(),
  };
  saveGroups(groups);
  return groups;
}

export function deleteGroup(id: string) {
  const groups = loadGroups().filter((g) => g.id !== id);
  saveGroups(groups);
  return groups;
}

function buildDefaultGroupsFromCampaigns(): Group[] {
  const campaigns = listCampaigns()
    .filter((c) => c.status !== "archived")
    .sort((a, b) => a.id - b.id);
  if (campaigns.length < 6) return [];

  const chunkSize = 8;
  const targetGroups = 5;

  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "Активна");
  const inactiveCampaigns = campaigns.filter((campaign) => campaign.status !== "Активна");
  const chunks: number[][] = [];

  // Базовый сценарий: только пятая группа содержит неактивную РК.
  if (inactiveCampaigns.length > 0 && activeCampaigns.length >= targetGroups * chunkSize - 1) {
    let activeOffset = 0;
    for (let i = 0; i < targetGroups - 1; i++) {
      const slice = activeCampaigns
        .slice(activeOffset, activeOffset + chunkSize)
        .map((campaign) => campaign.id);
      if (!slice.length) break;
      chunks.push(slice);
      activeOffset += chunkSize;
    }

    const lastChunkActive = activeCampaigns
      .slice(activeOffset, activeOffset + chunkSize - 1)
      .map((campaign) => campaign.id);
    if (lastChunkActive.length === chunkSize - 1) {
      const fifthChunk = [...lastChunkActive, inactiveCampaigns[0].id].sort((a, b) => a - b);
      chunks.push(fifthChunk);
    }
  } else {
    for (let i = 0; i < targetGroups; i++) {
      const slice = campaigns
        .slice(i * chunkSize, (i + 1) * chunkSize)
        .map((campaign) => campaign.id);
      if (!slice.length) break;
      chunks.push(slice);
    }
  }

  if (!chunks.length) return [];

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  return chunks.map((campaignIds, idx) => {
    const seq = idx + 1;
    const ts = new Date(now - (chunks.length - seq) * dayMs).toISOString();
    return {
      id: `grp_${String(seq).padStart(3, "0")}`,
      name: `Группа ${seq}`,
      createdAt: ts,
      updatedAt: ts,
      campaignIds,
      description: "Стартовая группа из существующих кампаний",
      sharedWith: [],
      favorite: false,
    };
  });
}

function appendMissingSeedGroups(groups: Group[]): Group[] {
  const hasPrimarySeedGroup = groups.some((group) => {
    const seq = getSeedGroupSeq(group);
    return seq === 1 || seq === 2;
  });
  if (!hasPrimarySeedGroup) return groups;

  const seeded = buildDefaultGroupsFromCampaigns();
  if (!seeded.length) return groups;

  const seededBySeq = new Map(
    seeded
      .map((group) => [getSeedGroupSeq(group), group] as const)
      .filter((entry): entry is [number, Group] => Number.isFinite(entry[0]))
  );
  let hasChanges = false;

  const synced = groups.map((group) => {
    const seq = getSeedGroupSeq(group);
    if (!seq) return group;
    const seededGroup = seededBySeq.get(seq);
    if (!seededGroup) return group;
    if (equalNumberArrays(group.campaignIds, seededGroup.campaignIds)) return group;
    hasChanges = true;
    return {
      ...group,
      campaignIds: [...seededGroup.campaignIds],
      updatedAt: new Date().toISOString(),
    };
  });

  const existingSeqs = new Set(
    synced
      .map((group) => getSeedGroupSeq(group))
      .filter((seq): seq is number => Boolean(seq))
  );
  const missing = seeded.filter((group) => {
    const seq = getSeedGroupSeq(group);
    return !seq || !existingSeqs.has(seq);
  });
  if (missing.length) hasChanges = true;

  if (!hasChanges) return groups;
  return [...synced, ...missing];
}

function getSeedGroupSeq(group: Group): number | null {
  const nameMatch = normalizeGroupName(group.name).toLowerCase().match(/^группа\s+(\d{1,3})$/);
  if (nameMatch) {
    const seq = Number(nameMatch[1]);
    if (Number.isFinite(seq) && seq >= 1 && seq <= 5) return seq;
  }

  const idMatch = String(group.id).match(/^grp_(\d{3})$/);
  if (!idMatch) return null;
  const seq = Number(idMatch[1]);
  if (!Number.isFinite(seq) || seq < 1 || seq > 5) return null;
  return seq;
}

function equalNumberArrays(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function normalizeGroupName(name: string): string {
  return String(name).trim().replace(/\s+/g, " ");
}

function normalizeDescription(description: string): string | undefined {
  const normalized = String(description).trim();
  return normalized ? normalized : undefined;
}

function normalizeCampaignIds(campaignIds: number[]): number[] {
  const seen = new Set<number>();
  const result: number[] = [];
  campaignIds.forEach((value) => {
    const campaignId = Number(value);
    if (!Number.isFinite(campaignId) || campaignId <= 0) return;
    if (seen.has(campaignId)) return;
    seen.add(campaignId);
    result.push(campaignId);
  });
  return result;
}

function normalizeSharedWith(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  value.forEach((item) => {
    const account = String(item ?? "").trim();
    if (!account) return;
    const key = account.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(account);
  });
  return result;
}

function assertGroupSize(size: number) {
  if (size > MAX_GROUP_CAMPAIGNS) {
    throw new Error(`Лимит группы — ${MAX_GROUP_CAMPAIGNS} РК.`);
  }
}

function ensureUniqueGroupName(groups: Group[], name: string, exceptId?: string): string {
  const normalized = normalizeGroupName(name);
  if (!normalized) throw new Error("Укажите название группы.");
  const nameLower = normalized.toLowerCase();
  const duplicate = groups.some((group) => group.id !== exceptId && group.name.toLowerCase() === nameLower);
  if (duplicate) throw new Error(`Группа «${normalized}» уже существует.`);
  return normalized;
}

function nextGroupId(groups: Group[]): string {
  const maxSeq = groups.reduce((max, group) => {
    const match = group.id.match(/(\d+)$/);
    if (!match) return max;
    const value = Number(match[1]);
    if (!Number.isFinite(value)) return max;
    return Math.max(max, value);
  }, 0);
  return `grp_${String(maxSeq + 1).padStart(3, "0")}`;
}

function buildDuplicateGroupName(groups: Group[], sourceName: string): string {
  const base = normalizeGroupName(`${sourceName} (копия)`);
  const taken = new Set(groups.map((group) => group.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  let idx = 2;
  while (taken.has(`${base} ${idx}`.toLowerCase())) idx++;
  return `${base} ${idx}`;
}

// ===== КОНТЕКСТ =====

export function readCtx<T extends Record<string, unknown> = Record<string, unknown>>(): T {
  if (typeof window === "undefined") return {} as T;
  const raw = window.localStorage.getItem(CTX_KEY);
  if (!raw) return {} as T;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as T;
    return {} as T;
  } catch {
    return {} as T;
  }
}

export function saveCtx(ctx: Record<string, unknown>) {
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

type CampaignStatsInput = number | Pick<Campaign, "id" | "status" | "type">;

const STATS_CACHE = new Map<string, CampaignStats>();

function seededUnit(seed: number): number {
  let x = Math.imul(seed ^ 0x9e3779b1, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return x / 0xffffffff;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toStatsContext(input: CampaignStatsInput): { id: number; status?: Campaign["status"]; type?: string } {
  if (typeof input === "number") return { id: input };
  return { id: Number(input.id), status: input.status, type: input.type };
}

export function getCampaignStats(input: CampaignStatsInput): CampaignStats {
  const { id, status, type } = toStatsContext(input);
  const cacheKey = `${id}|${status ?? ""}|${type ?? ""}`;
  const cached = STATS_CACHE.get(cacheKey);
  if (cached) return cached;

  // Более реалистичный long-tail: много небольших РК, часть средних, немного крупных.
  const tier = seededUnit(id + 17);
  const scale = seededUnit(id + 23);
  let totalImps: number;
  if (tier < 0.58) totalImps = 90_000 + scale * 1_900_000;
  else if (tier < 0.9) totalImps = 2_000_000 + scale * 8_500_000;
  else totalImps = 11_000_000 + scale * 22_000_000;

  const statusK =
    status === "Не активна" ? 0.12 :
    status === "archived" ? 0.05 :
    1;
  const typeK = type === "Делегированная" ? 0.82 : 1;
  totalImps *= statusK * typeK;
  totalImps = Math.round(totalImps);

  const ctrBase =
    type === "Делегированная" ? 0.0012 :
    status === "Не активна" ? 0.0009 :
    0.0016;
  const ctrRate = clampNumber(
    ctrBase + seededUnit(id + 31) * 0.0105 + (tier > 0.9 ? 0.0008 : 0),
    0.0006,
    0.022
  );
  let totalClicks = Math.round(totalImps * ctrRate);

  const baseDailyShare =
    status === "Активна"
      ? 0.0028 + seededUnit(id + 43) * 0.014
      : 0.00025 + seededUnit(id + 43) * 0.0022;
  const volatility = 0.82 + seededUnit(id + 47) * 0.42;

  let todayImps = Math.round(totalImps * baseDailyShare * volatility);
  let yesterdayImps = Math.round(
    totalImps * baseDailyShare * (2 - volatility) * (0.92 + seededUnit(id + 53) * 0.2)
  );

  // Для части неактивных кампаний оставляем "нулевые" дни, но без неконсистентных кликов.
  if (status !== "Активна") {
    if (seededUnit(id + 71) < 0.45) todayImps = 0;
    if (seededUnit(id + 73) < 0.35) yesterdayImps = 0;
  }

  todayImps = Math.max(0, todayImps);
  yesterdayImps = Math.max(0, yesterdayImps);

  const todayCtrRate = clampNumber(ctrRate * (0.82 + seededUnit(id + 59) * 0.36), 0.0008, 0.03);
  const yesterdayCtrRate = clampNumber(ctrRate * (0.8 + seededUnit(id + 61) * 0.38), 0.0008, 0.03);

  const todayClicks = todayImps > 0 ? Math.max(0, Math.min(todayImps, Math.round(todayImps * todayCtrRate))) : 0;
  const yesterdayClicks =
    yesterdayImps > 0 ? Math.max(0, Math.min(yesterdayImps, Math.round(yesterdayImps * yesterdayCtrRate))) : 0;

  totalImps = Math.max(totalImps, todayImps + yesterdayImps);
  totalClicks = Math.max(totalClicks, todayClicks + yesterdayClicks);
  totalClicks = Math.max(0, Math.min(totalClicks, totalImps));

  const stats: CampaignStats = {
    today: { imps: todayImps, clicks: todayClicks },
    yesterday: { imps: yesterdayImps, clicks: yesterdayClicks },
    total: { imps: totalImps, clicks: totalClicks },
  };

  STATS_CACHE.set(cacheKey, stats);
  return stats;
}

const TAGS_KEY = "campaignTagsV1";
function loadTagsMap(): Record<string, string[]> { if (typeof window === "undefined") return {}; try { return JSON.parse(localStorage.getItem(TAGS_KEY) || "{}") || {}; } catch { return {}; } }
function saveTagsMap(m: Record<string, string[]>) { if (typeof window === "undefined") return; localStorage.setItem(TAGS_KEY, JSON.stringify(m)); }
const normTag = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ").slice(0,48);
export function getCampaignTags(id: number): string[] { const m = loadTagsMap(); return (m[String(id)] || []).slice(); }
export function setCampaignTags(id: number, tags: string[]) { const m = loadTagsMap(); m[String(id)] = Array.from(new Set(tags.map(normTag).filter(Boolean))); saveTagsMap(m); }
export function addCampaignTag(id:number, tag:string){ const curr=getCampaignTags(id); setCampaignTags(id,[...curr,tag]); }
export function removeCampaignTag(id:number, tag:string){ const t=normTag(tag); setCampaignTags(id,getCampaignTags(id).filter(x=>x!==t)); }
export function getAllTagsMap(): Record<number,string[]>{ const raw=loadTagsMap(); const out: Record<number,string[]> = {}; Object.keys(raw).forEach(k=>out[Number(k)]=raw[k]); return out; }
