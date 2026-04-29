// Client-only Favorites & Archive for Campaigns
const hasWin = () => typeof window !== "undefined";
const readJSON = <T,>(k:string,f:T):T => { if(!hasWin()) return f as T; try{const v=localStorage.getItem(k); return v?JSON.parse(v) as T:f;}catch{return f;} };
const writeJSON = (k:string,v:unknown)=>{ if(hasWin()) localStorage.setItem(k, JSON.stringify(v)); };

const LS_FAV_CAMPAIGNS = "adr_fav_campaigns";
const LS_ARCH_IDS = "adr_archived_ids";
const LS_ARCH_DATES = "adr_archived_dates"; // id -> ISO
const toNumberIds = (list: unknown): number[] =>
  Array.isArray(list)
    ? Array.from(new Set(list.map((x) => Number(x)).filter((x) => Number.isFinite(x))))
    : [];

// Favorites
export const getFavCampaignIds = (): number[] => toNumberIds(readJSON<unknown>(LS_FAV_CAMPAIGNS, []));
export const isFavCampaign = (id:number) => getFavCampaignIds().includes(id);
export const toggleFavCampaign = (id:number) => {
  const cur = new Set(getFavCampaignIds());
  if (cur.has(id)) cur.delete(id);
  else cur.add(id);
  writeJSON(LS_FAV_CAMPAIGNS, Array.from(cur));
};

// Archive
export const getArchivedIds = (): number[] => toNumberIds(readJSON<unknown>(LS_ARCH_IDS, []));
export const getArchivedAtMap = (): Record<string,string> => readJSON<Record<string,string>>(LS_ARCH_DATES, {});
export const getArchivedAt = (id:number): string | undefined => getArchivedAtMap()[String(id)];

export const archiveCampaigns = (ids:number[]) => {
  const set = new Set(getArchivedIds());
  const dates = getArchivedAtMap();
  const now = new Date().toISOString();
  ids.forEach(id => { set.add(id); if (!dates[String(id)]) dates[String(id)] = now; });
  writeJSON(LS_ARCH_IDS, Array.from(set));
  writeJSON(LS_ARCH_DATES, dates);
};

export const restoreCampaigns = (ids:number[]) => {
  const set = new Set(getArchivedIds());
  const dates = getArchivedAtMap();
  ids.forEach(id => { set.delete(id); delete dates[String(id)]; });
  writeJSON(LS_ARCH_IDS, Array.from(set));
  writeJSON(LS_ARCH_DATES, dates);
};

export const normalizeArchFavStorage = (): { favorites: number; archived: number; dates: number } => {
  if (!hasWin()) return { favorites: 0, archived: 0, dates: 0 };

  const fav = toNumberIds(readJSON<unknown>(LS_FAV_CAMPAIGNS, []));
  const arch = toNumberIds(readJSON<unknown>(LS_ARCH_IDS, []));
  const datesRaw = readJSON<Record<string, string>>(LS_ARCH_DATES, {});
  const dates: Record<string, string> = {};
  Object.entries(datesRaw).forEach(([k, v]) => {
    const id = Number(k);
    if (!Number.isFinite(id)) return;
    dates[String(id)] = String(v);
  });

  writeJSON(LS_FAV_CAMPAIGNS, fav);
  writeJSON(LS_ARCH_IDS, arch);
  writeJSON(LS_ARCH_DATES, dates);

  return { favorites: fav.length, archived: arch.length, dates: Object.keys(dates).length };
};
