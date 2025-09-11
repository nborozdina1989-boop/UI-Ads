// Client-only Favorites & Archive for Campaigns
const hasWin = () => typeof window !== "undefined";
const readJSON = <T,>(k:string,f:T):T => { if(!hasWin()) return f as T; try{const v=localStorage.getItem(k); return v?JSON.parse(v) as T:f;}catch{return f;} };
const writeJSON = (k:string,v:any)=>{ if(hasWin()) localStorage.setItem(k, JSON.stringify(v)); };

const LS_FAV_CAMPAIGNS = "adr_fav_campaigns";
const LS_ARCH_IDS = "adr_archived_ids";
const LS_ARCH_DATES = "adr_archived_dates"; // id -> ISO

// ⭐ Favorites
export const getFavCampaignIds = (): number[] => readJSON<number[]>(LS_FAV_CAMPAIGNS, []);
export const isFavCampaign = (id:number) => getFavCampaignIds().includes(id);
export const toggleFavCampaign = (id:number) => {
  const cur = new Set(getFavCampaignIds());
  cur.has(id) ? cur.delete(id) : cur.add(id);
  writeJSON(LS_FAV_CAMPAIGNS, Array.from(cur));
};

// 🗄️ Archive
export const getArchivedIds = (): number[] => readJSON<number[]>(LS_ARCH_IDS, []);
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
