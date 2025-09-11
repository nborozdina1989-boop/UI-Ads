/** ===== СТАРЫЕ типы (оставляем для совместимости с автогенерацией) ===== */
export type CampaignMeta = {
  brand: string;
  campaign_name: string;
  agency?: string;
  advertiser?: string;
  product?: string;
  date_start?: string; // YYYY-MM-DD
  date_end?: string;   // YYYY-MM-DD
  delegate_accounts?: string[];
  services?: { id: string; name?: string }[];
};

export type PlacementRow = {
  supplier: string;
  platform_name: string;
  format: "banner" | "video";
  hosting?: string;
  environment: "web" | "in-app" | "smart" | "mixed";
  measurement_type: "audit" | "ivt" | "full_verification" | "click_only" | "audit_viewability";
  banner_name?: string;
  target_url?: string;
  time_start?: string;
  time_end?: string;
  code_type?: string;
  code_type_additional?: string;
  delegate_suppliers?: string[];
  tracker_site?: ("Web"|"iOS"|"Android")[];
  auditor_mediascope?: string;
  auditor_url?: string;
  vast_version?: string;
  auditor_redirect?: string;
  macro_exss?: string;
  macro_erir?: string;
  macro_bundle_id?: string;
  macro_adv_id?: string;
  macro_ext_id?: string;
  dyn_click?: string;
  dyn_impression?: string;
  geo?: string;
  audience?: string;
};

export type MediaplanUpload = {
  fileName: string;
  sheet: string;
  headerRow: number;
  headers: string[];
  rowsRaw: Record<string, any>[];
  // на следующем шаге добавим matrix:any[][] для клика по ячейке
};

export type MediaplanImport = {
  meta: CampaignMeta;
  rows: PlacementRow[];
  warnings: string[];
  errors: string[];
  source: { fileName: string; sheet: string; headerRow: number; headers: string[] };
};

/** ===== НОВОЕ: русские ключи для разметки ===== */

/** Ячейки уровня кампании (РУССКИЕ названия полей) */
export type КлючЯчейки =
  | "Бренд" | "Название РК"
  | "Агентство" | "Рекламодатель" | "Продукт"
  | "Старт РК" | "Окончание РК"
  | "Делегирование кампании" | "Услуги";

/** Столбцы уровня позиции (РУССКИЕ названия полей) */
export type КлючСтолбца =
  | "Название позиции" | "Поставщик" | "Формат размещения" | "Хостинг видео" | "Среда размещения" | "Тип измерения"
  | "Название баннера" | "URL баннера"
  | "Время начала" | "Время окончания" | "Тип кода" | "Делегирование поставщиков" | "Трекерный сайт"
  | "Mediascope" | "URL аудитора" | "VAST версия" | "Редирект"
  | "exss" | "ЕРИР" | "Bundle ID" | "GAID/IDFA" | "Внешний ID"
  | "Дин. параметры клика" | "Дин. параметры показа"
  | "Гео" | "Целевая аудитория";

/** Обязательные объекты (строго по твоему списку) */
export const ОБЯЗАТЕЛЬНЫЕ_ЯЧЕЙКИ: КлючЯчейки[] = ["Бренд","Название РК"];
export const ОБЯЗАТЕЛЬНЫЕ_СТОЛБЦЫ: КлючСтолбца[] = [
  "Название позиции","Поставщик","Формат размещения","Хостинг видео","Среда размещения","Тип измерения",
  "Название баннера","URL баннера"
];

/** Дополнительные списки (для правой панели) */
export const ДОП_ЯЧЕЙКИ: КлючЯчейки[] = ["Агентство","Рекламодатель","Продукт","Старт РК","Окончание РК","Делегирование кампании","Услуги"];
export const ДОП_СТОЛБЦЫ: КлючСтолбца[] = [
  "Время начала","Время окончания","Тип кода","Делегирование поставщиков","Трекерный сайт",
  "Mediascope","URL аудитора","VAST версия","Редирект",
  "exss","ЕРИР","Bundle ID","GAID/IDFA","Внешний ID",
  "Дин. параметры клика","Дин. параметры показа","Гео","Целевая аудитория"
];

/** Маппинг разметки на русском */
export type РазметкаRU = {
  ячейки: Partial<Record<КлючЯчейки, string>>;         // значения (пока как строки; на следующем шаге добавим A1)
  столбцы: Partial<Record<КлючСтолбца, string>>;        // название колонки из headers
};

/** Синонимы заголовков → КлючСтолбца (помогает автосопоставлению) */
export const СИНОНИМЫ_СТОЛБЦОВ: Record<КлючСтолбца, string[]> = {
  "Название позиции": ["Название позиции","Название площадки","Площадка","Site","Placement"],
  "Поставщик": ["Поставщик","Vendor","Provider","Партнёр"],
  "Формат размещения": ["Формат размещения","Формат","Format","banner/video"],
  "Хостинг видео": ["Хостинг видео","Hosting","Video hosting","YouTube/VPAID"],
  "Среда размещения": ["Среда размещения","Среда","Environment","web/in-app/smart"],
  "Тип измерения": ["Тип измерения","Measurement","Verification Type","IVT","Аудит","Полная верификация"],
  "Название баннера": ["Название баннера","Комментарий","Banner name","Creative name"],
  "URL баннера": ["URL баннера","target_url","Ссылка","Click URL"],
  "Время начала": ["Время начала","Start","Дата начала","Флайт старт"],
  "Время окончания": ["Время окончания","End","Дата окончания","Флайт конец"],
  "Тип кода": ["Тип кода","code_id","Тип счётчика","Code"],
  "Делегирование поставщиков": ["Делегирование поставщиков","Delegate","Reseller","Partner IDs"],
  "Трекерный сайт": ["Трекерный сайт","Tracker site","Web/iOS/Android","OS"],
  "Mediascope": ["Mediascope","TNS","Внешний аудит","Auditor"],
  "URL аудитора": ["URL аудитора","Auditor URL"],
  "VAST версия": ["VAST версия","VAST","VAST version"],
  "Редирект": ["Редирект","Redirect"],
  "exss": ["exss","EXSS"],
  "ЕРИР": ["ЕРИР","ERIR"],
  "Bundle ID": ["Bundle ID","bundle"],
  "GAID/IDFA": ["GAID/IDFA","GAID","IDFA","adv_id"],
  "Внешний ID": ["Внешний ID","ext_id","External ID"],
  "Дин. параметры клика": ["Дин. параметры клика","Dynamic click params"],
  "Дин. параметры показа": ["Дин. параметры показа","Dynamic impression params"],
  "Гео": ["Гео","Geo","География"],
  "Целевая аудитория": ["Целевая аудитория","Audience"]
};

/** Простая нормализация значений */
export const normFormat = (s: any): "banner"|"video" => {
  const x = String(s||"").toLowerCase();
  return (x.includes("видео") || x.includes("video")) ? "video" : "banner";
};
export const normEnv = (s: any): "web"|"in-app"|"smart"|"mixed" => {
  const x = String(s||"").toLowerCase();
  if (x.includes("in") && x.includes("app")) return "in-app";
  if (x.includes("smart")) return "smart";
  if (x.includes("смеш") || x.includes("mix")) return "mixed";
  return "web";
};
export const normMeasure = (s: any): PlacementRow["measurement_type"] => {
  const x = String(s||"").toLowerCase();
  if (x.includes("full")) return "full_verification";
  if (x.includes("ivt")) return "ivt";
  if (x.includes("click")) return "click_only";
  if (x.includes("view")) return "audit_viewability";
  return "audit";
};
export function toISODate(v: any): string|undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number" && v > 30000 && v < 80000) {
    const t = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(t);
    const y = d.getUTCFullYear(); const m = String(d.getUTCMonth()+1).padStart(2,"0"); const day = String(d.getUTCDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  }
  const s = String(v).trim(); const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,"0"); const day = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  }
  return undefined;
}
export const splitList = (s: any): string[] => String(s||"").split(/[,;|]/g).map(x=>x.trim()).filter(Boolean);

/** Автоматическое сопоставление столбцов по заголовкам (в русские ключи) */
export function autoMapColumnsRU(headers: string[]): Partial<Record<КлючСтолбца,string>> {
  const mapping: Partial<Record<КлючСтолбца,string>> = {};
  for (const h of headers) {
    const hh = String(h||"").trim().toLowerCase();
    for (const [key, syns] of Object.entries(СИНОНИМЫ_СТОЛБЦОВ) as [КлючСтолбца,string[]][]) {
      if (syns.some(s => hh === s.toLowerCase())) { mapping[key] = h; break; }
    }
  }
  return mapping;
}

/** Трансляция RU → внутренние поля */
const RU2CANON_CELL: Record<КлючЯчейки, keyof CampaignMeta> = {
  "Бренд": "brand",
  "Название РК": "campaign_name",
  "Агентство": "agency",
  "Рекламодатель": "advertiser",
  "Продукт": "product",
  "Старт РК": "date_start",
  "Окончание РК": "date_end",
  "Делегирование кампании": "delegate_accounts",
  "Услуги": "services"
};
const RU2CANON_COL: Record<КлючСтолбца, keyof PlacementRow> = {
  "Название позиции": "platform_name",
  "Поставщик": "supplier",
  "Формат размещения": "format",
  "Хостинг видео": "hosting",
  "Среда размещения": "environment",
  "Тип измерения": "measurement_type",
  "Название баннера": "banner_name",
  "URL баннера": "target_url",
  "Время начала": "time_start",
  "Время окончания": "time_end",
  "Тип кода": "code_type",
  "Делегирование поставщиков": "delegate_suppliers",
  "Трекерный сайт": "tracker_site",
  "Mediascope": "auditor_mediascope",
  "URL аудитора": "auditor_url",
  "VAST версия": "vast_version",
  "Редирект": "auditor_redirect",
  "exss": "macro_exss",
  "ЕРИР": "macro_erir",
  "Bundle ID": "macro_bundle_id",
  "GAID/IDFA": "macro_adv_id",
  "Внешний ID": "macro_ext_id",
  "Дин. параметры клика": "dyn_click",
  "Дин. параметры показа": "dyn_impression",
  "Гео": "geo",
  "Целевая аудитория": "audience"
};

/** Применяем разметку RU и получаем нормализованный импорт */
export type РазметкаЗначенийRU = { ячейки: Partial<Record<КлючЯчейки,string>>; столбцы: Partial<Record<КлючСтолбца,string>> };

export function applyMappingRU(
  mapping: РазметкаЗначенийRU,
  upload: MediaplanUpload
): MediaplanImport {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1) Кампания (из ячеек справа). Значения берем напрямую (прототип)
  const meta: CampaignMeta = {} as any;
  for (const [k, v] of Object.entries(mapping.ячейки) as [КлючЯчейки,string][]) {
    const canon = RU2CANON_CELL[k];
    if (!v) continue;
    if (canon === "delegate_accounts") (meta as any)[canon] = splitList(v);
    else if (canon === "services") (meta as any)[canon] = splitList(v).map(id => ({ id }));
    else if (canon === "date_start" || canon === "date_end") (meta as any)[canon] = toISODate(v);
    else (meta as any)[canon] = v;
  }
  if (!meta.brand) errors.push("Не указана обязательная ячейка «Бренд».");
  if (!meta.campaign_name) errors.push("Не указана обязательная ячейка «Название РК».");

  // 2) Проверка обязательных столбцов размечены?
  for (const req of ОБЯЗАТЕЛЬНЫЕ_СТОЛБЦЫ) {
    if (!mapping.столбцы[req]) errors.push(`Не указан столбец для «${req}».`);
  }

  // 3) Построим строки размещений
  const rows: PlacementRow[] = [];
  for (const raw of upload.rowsRaw) {
    const r: any = {};
    for (const [ruKey, colName] of Object.entries(mapping.столбцы) as [КлючСтолбца,string][]) {
      if (!colName) continue;
      const val = raw[colName];

      const canon = RU2CANON_COL[ruKey];
      switch (canon) {
        case "format": r.format = normFormat(val); break;
        case "environment": r.environment = normEnv(val); break;
        case "measurement_type": r.measurement_type = normMeasure(val); break;
        case "time_start": r.time_start = toISODate(val) || meta.date_start; break;
        case "time_end": r.time_end = toISODate(val) || meta.date_end; break;
        case "delegate_suppliers": r.delegate_suppliers = splitList(val); break;
        case "tracker_site": r.tracker_site = splitList(val) as any; break;
        default: r[canon] = (val==null ? undefined : String(val));
      }
    }
    rows.push(r as PlacementRow);
  }

  // 4) Доп. предупреждения
  rows.forEach((r, idx) => {
    if (r.format === "video" && !r.hosting) warnings.push(`Видео-строка без «Хостинг видео» (строка ${idx+1}).`);
  });

  return {
    meta, rows, warnings, errors,
    source: { fileName: upload.fileName, sheet: upload.sheet, headerRow: upload.headerRow, headers: upload.headers }
  };
}

/** ===== Хранилище в localStorage ===== */
const K_UPLOAD = "adriver/mp/upload";
const K_MAPPING_RU = "adriver/mp/mapping_ru";
const K_IMPORT = "adriver/mp/import";

export const saveUpload = (u: MediaplanUpload) => localStorage.setItem(K_UPLOAD, JSON.stringify(u));
export const loadUpload = (): MediaplanUpload | null => {
  try { const s = localStorage.getItem(K_UPLOAD); return s ? JSON.parse(s) : null; } catch { return null; }
};

export const saveMappingRU = (m: РазметкаRU) => localStorage.setItem(K_MAPPING_RU, JSON.stringify(m));
export const loadMappingRU = (): РазметкаRU | null => {
  try { const s = localStorage.getItem(K_MAPPING_RU); return s ? JSON.parse(s) : null; } catch { return null; }
};

export const saveImport = (imp: MediaplanImport) => localStorage.setItem(K_IMPORT, JSON.stringify(imp));
export const loadImport = (): MediaplanImport | null => {
  try { const s = localStorage.getItem(K_IMPORT); return s ? JSON.parse(s) : null; } catch { return null; }
};

// ===== Черновики медиапланов (localStorage) =====
export type Draft = {
  id: string;
  name: string;
  createdAt: string;
  mapping?: РазметкаRU | null;
  meta?: { brand?: string; campaign_name?: string };
  rowsCount?: number;
};

const K_DRAFT_INDEX = "adriver/mp/drafts/index";
function readDraftIndex(): string[] {
  try { const s = localStorage.getItem(K_DRAFT_INDEX); return s ? JSON.parse(s) : []; } catch { return []; }
}
function writeDraftIndex(ids: string[]) {
  localStorage.setItem(K_DRAFT_INDEX, JSON.stringify(ids));
}
export function listDrafts(): Draft[] {
  const ids = readDraftIndex();
  return ids.map(id => {
    try { const s = localStorage.getItem(`adriver/mp/drafts/${id}`); return s ? JSON.parse(s) as Draft : null; }
    catch { return null; }
  }).filter(Boolean) as Draft[];
}
export function getDraft(id: string): Draft | null {
  try { const s = localStorage.getItem(`adriver/mp/drafts/${id}`); return s ? JSON.parse(s) as Draft : null; } catch { return null; }
}
export function saveDraft(d: Draft) {
  const ids = new Set(readDraftIndex()); ids.add(d.id); writeDraftIndex([...ids]);
  localStorage.setItem(`adriver/mp/drafts/${d.id}`, JSON.stringify(d));
}
export function deleteDraft(id: string) {
  const ids = new Set(readDraftIndex()); ids.delete(id); writeDraftIndex([...ids]);
  localStorage.removeItem(`adriver/mp/drafts/${id}`);
}
// Удобная утилита: сохранение «быстрого» черновика из текущей разметки (если она есть)
export function saveQuickDraft(defaultName = "Черновик медиаплана") {
  const m = loadMappingRU() || { ячейки: { "Бренд": "Бренд 1", "Название РК": "Новая кампания" }, столбцы: {} };
  const id = `d${Date.now()}`;
  const d: Draft = {
    id,
    name: (m.ячейки?.["Название РК"] as string) || defaultName,
    createdAt: new Date().toISOString(),
    mapping: m,
    meta: { brand: m.ячейки?.["Бренд"] as string, campaign_name: m.ячейки?.["Название РК"] as string },
    rowsCount: 3
  };
  saveDraft(d);
  return d;
}
