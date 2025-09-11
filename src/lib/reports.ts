export type ReportDraft = {
  id: string;
  name: string;
  createdAt: string;
  dims: string[];
  metrics: string[];
  filters: { campaigns?: number[]; period?: { from:string; to:string } } ;
};

export type ReportOrder = ReportDraft & {
  language: "ru"|"en";
  emails: string[];
  status: "Готов"|"В очереди";
};

export type Schedule = {
  id: string;
  name: string;
  freq: "Ежедневно"|"Раз в неделю"|"Раз в месяц";
  emails: string[];
  enabled: boolean;
  createdAt: string;
};

const K_ORDERS = "adriver/reports/orders";
const K_SCHEDULE = "adriver/reports/schedule";

function read<T>(k:string, def:T):T { try { const s=localStorage.getItem(k); return s? JSON.parse(s):def;} catch{ return def; } }
function write<T>(k:string, v:T){ localStorage.setItem(k, JSON.stringify(v)); }

export function listOrders(): ReportOrder[] { return read(K_ORDERS, [] as ReportOrder[]); }
export function saveOrder(o: ReportOrder){ const a=listOrders(); const i=a.findIndex(x=>x.id===o.id); if(i>=0) a[i]=o; else a.unshift(o); write(K_ORDERS,a); }
export function deleteOrder(id:string){ write(K_ORDERS, listOrders().filter(x=>x.id!==id)); }

export function listSchedules(): Schedule[]{ return read(K_SCHEDULE, [] as Schedule[]); }
export function saveSchedule(s:Schedule){ const a=listSchedules(); const i=a.findIndex(x=>x.id===s.id); if(i>=0) a[i]=s; else a.unshift(s); write(K_SCHEDULE,a); }
export function deleteSchedule(id:string){ write(K_SCHEDULE, listSchedules().filter(x=>x.id!==id)); }

export const DEFAULT_METRICS = ["Показы","Клики","CTR","Затраты","CPM","CPC","Бюджет"];

// лёгкая синтетическая генерация данных под предпросмотр
export function mockPreview(rows:number, dims:string[], metrics:string[]){
  const R:any[] = [];
  for(let i=0;i<Math.max(rows,5);i++){
    const line:any = {};
    dims.forEach((d,idx)=> line[d] = `${d} ${idx+1}-${(i%3)+1}`);
    metrics.forEach(m=>{
      if(m==="CTR") line[m] = ( ( (i+1)*7 % 120 ) / 10 ).toFixed(2) + "%";
      else line[m] = ((i+1)* (m==="Клики"?23: m==="Затраты"?137: 101)) % 100000;
    });
    R.push(line);
  }
  return R;
}
