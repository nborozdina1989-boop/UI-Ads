// Client-side campaigns store (demo seed with A/B/C/Без рекламодателя → бренды → РК)
export type Campaign = {
  id: number;
  name: string;
  brand?: string;
  advertiser?: string;
  status: "Активна" | "Не активна";
  type: "Собственная" | "Делегированная";
  createdAt: string; // ISO YYYY-MM-DD
};

const LS_CAMPS = "adr_campaigns_v4";          // версия ключа — свежий сид
const LS_CTX   = "adr_campaigns_ctx_v1";

const hasWin = () => typeof window !== "undefined";
const read = <T,>(k:string, fallback:T):T => {
  if(!hasWin()) return fallback as T;
  try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; }
};
const write = (k:string, v:any) => { if(hasWin()) localStorage.setItem(k, JSON.stringify(v)); };

// --------- DEMO SEED -----------
function pad2(n:number){ return n<10 ? `0${n}` : String(n); }
function dateByIndex(i:number){
  const m = (i % 12) + 1;
  const d = (i % 28) + 1;
  return `2025-${pad2(m)}-${pad2(d)}`;
}
function generateDemo(): Campaign[] {
  const advertisers = [
    { label: "Рекламодатель A", brands: ["Бренд 1", "Бренд 2"] },
    { label: "Рекламодатель B", brands: ["Бренд 3", "Бренд 4"] },
    { label: "Рекламодатель C", brands: ["Бренд 5", "Бренд 6"] },
    { label: "Без рекламодателя", brands: ["Без бренда"] },
  ];
  let nextId = 900001;
  let idx = 0;
  const out: Campaign[] = [];
  for (const adv of advertisers){
    for (const brand of adv.brands){
      for (let k=1; k<=5; k++){
        out.push({
          id: nextId++,
          name: `Рекламная кампания ${k}`,
          brand: brand,
          advertiser: adv.label,
          status: (k % 2 === 0) ? "Не активна" : "Активна",
          type: "Собственная",
          createdAt: dateByIndex(idx++),
        });
      }
    }
  }
  // 4 делегированные кампании (по одной в каждом кластере)
  const delegate = new Set<number>([900002, 900012, 900022, 900032]);
  out.forEach(c => { if (delegate.has(c.id)) c.type = "Делегированная"; });
  return out;
}
// -------------------------------

function ensureSeed(): Campaign[] {
  let data = read<Campaign[]|null>(LS_CAMPS, null);
  if(!data || !Array.isArray(data) || data.length === 0){
    data = generateDemo();
    write(LS_CAMPS, data);
  }
  return data;
}

export const listCampaigns = (): Campaign[] => {
  const arr = ensureSeed();
  return [...arr].sort((a,b)=> a.id - b.id);
};

// Возможное сохранение массива кампаний (на будущее)
const saveCampaigns = (arr: Campaign[]) => write(LS_CAMPS, arr);

// Контекст экрана (поиск/фильтры)
export const readCtx = () => read<any>(LS_CTX, {});
export const saveCtx = (ctx:any) => write(LS_CTX, ctx);

// Экспорт в "Excel" — HTML-таблица, которую Excel открывает нативно
export const exportExcel = (rows: Campaign[]) => {
  if(!hasWin()) return;
  const headers = ["ID","Название","Бренд","Рекламодатель","Статус","Тип","Создана"];
  const html = `
    <html><head><meta charset="utf-8"></head><body>
    <table border="1">
      <thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.map(r=>`<tr>
          <td>${escapeHtml(String(r.id))}</td>
          <td>${escapeHtml(r.name)}</td>
          <td>${escapeHtml(r.brand||"")}</td>
          <td>${escapeHtml(r.advertiser||"")}</td>
          <td>${escapeHtml(r.status)}</td>
          <td>${escapeHtml(r.type)}</td>
          <td>${escapeHtml(r.createdAt)}</td>
        </tr>`).join("")}
      </tbody>
    </table>
    </body></html>
  `.trim();
  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = rows.length ? `campaigns_${rows.length}.xlsx` : "campaigns.xlsx";
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 500);
};

function escapeHtml(s:string){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string)); }

// ======== Группы (Groups) ========
export type Group = {
  id: string;        // внутренний id
  hrid: string;      // человекочитаемый HR-ID, например GRP-0001
  name: string;
  campaignIds: number[];
  createdAt: string; // YYYY-MM-DD
  fav?: boolean;
};

const LS_GROUPS = "adr_groups_v1";

function todayISO(){ const d=new Date(); const m=String(d.getMonth()+1).padStart(2,"0"); const dd=String(d.getDate()).padStart(2,"0"); return `${d.getFullYear()}-${m}-${dd}`; }
function ensureGroupsStore(): Group[] {
  let arr = read<Group[]|null>(LS_GROUPS, null);
  if(!arr || !Array.isArray(arr)){
    // лёгкий сид для демо: 2 группы
    const all = listCampaigns();
    const act = all.filter(c=>c.status==="Активна").slice(0,8).map(c=>c.id);
    const inact = all.filter(c=>c.status==="Не активна").slice(0,8).map(c=>c.id);
    arr = [
      { id:"grp-1", hrid:"GRP-0001", name:"Активные (пример)", campaignIds: act, createdAt: todayISO(), fav:true },
      { id:"grp-2", hrid:"GRP-0002", name:"Неактивные (пример)", campaignIds: inact, createdAt: todayISO(), fav:false },
    ];
    write(LS_GROUPS, arr);
  }
  return arr;
}
const saveGroups = (arr:Group[]) => write(LS_GROUPS, arr);

export const listGroups = ():Group[] => ensureGroupsStore();
export const toggleFavGroup = (id:string):Group[] => {
  const next = ensureGroupsStore().map(g => g.id===id ? {...g, fav:!g.fav} : g);
  saveGroups(next); return next;
};
export const deleteGroup = (id:string):Group[] => {
  const next = ensureGroupsStore().filter(g => g.id!==id);
  saveGroups(next); return next;
};
export const createGroup = (name:string, campaignIds:number[]):Group => {
  const all = ensureGroupsStore();
  const seq = (n:number)=>`GRP-${String(n).padStart(4,"0")}`;
  const idx = all.length? (Math.max(...all.map(g=>parseInt((g.hrid||"").split("-")[1]||"0"))) + 1) : 1;
  const g:Group = { id:`grp-${Math.random().toString(36).slice(2,8)}`, hrid:seq(idx), name, campaignIds:[...new Set(campaignIds)], createdAt:todayISO(), fav:false };
  const next = [g, ...all]; saveGroups(next); return g;
};
// ==================================

// proto-build compat stubs
export async function listDeleted(){ return []; }
export async function purgeOldDeleted(){ return 0; }
export async function restoreCampaigns(_ids:string[] = []){ return { restored: _ids.length }; }
