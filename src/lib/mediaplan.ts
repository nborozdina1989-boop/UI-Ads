/** ===== СТАРЫЕ типы (оставляем для совместимости с автогенерацией) ===== */
export type CampaignMeta = {
  brand?: string;
  campaign_name: string;
  agency?: string;
  advertiser?: string;
  product?: string;
  date_start?: string; // YYYY-MM-DD
  date_end?: string;   // YYYY-MM-DD
  delegate_accounts?: string[];
};

export type PlacementRow = {
  supplier: string;
  platform_name: string;
  placement_type?: string;
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
  rowsRaw: Record<string, unknown>[];
  matrix?: unknown[][];
  range?: {
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
  };
};

export type MediaplanImport = {
  meta: CampaignMeta;
  rows: PlacementRow[];
  warnings: string[];
  errors: string[];
  source: { fileName: string; sheet: string; headerRow: number; headers: string[] };
};

export type СсылкаНаЯчейкуRU = {
  address: string;
  value?: string;
};

export type СсылкаНаСтолбецRU = {
  address: string;
  label?: string;
  colIndex: number;
  dataStartRow: number;
};

/** ===== НОВОЕ: русские ключи для разметки ===== */

/** Ячейки уровня кампании (РУССКИЕ названия полей) */
export type КлючЯчейки =
  | "Рекламодатель" | "Название РК"
  | "Агентство" | "Бренд" | "Продукт"
  | "Старт РК" | "Окончание РК"
  | "Делегирование кампании";

/** Столбцы уровня позиции (РУССКИЕ названия полей) */
export type КлючСтолбца =
  | "Название позиции" | "Поставщик" | "Тип размещения" | "Формат размещения" | "Хостинг видео" | "Среда размещения" | "Тип измерения"
  | "Название баннера" | "URL баннера"
  | "Время начала" | "Время окончания" | "Тип кода" | "Делегирование поставщиков" | "Трекерный сайт"
  | "Mediascope" | "URL аудитора" | "VAST версия" | "Редирект"
  | "exss" | "ЕРИР" | "Bundle ID" | "GAID/IDFA" | "Внешний ID"
  | "Дин. параметры клика" | "Дин. параметры показа"
  | "Гео" | "Целевая аудитория";

/** Обязательные объекты (по актуальным требованиям) */
export const ОБЯЗАТЕЛЬНЫЕ_ЯЧЕЙКИ: КлючЯчейки[] = ["Рекламодатель", "Название РК"];
export const ОБЯЗАТЕЛЬНЫЕ_СТОЛБЦЫ: КлючСтолбца[] = ["Название позиции"];

/** Дополнительные списки (для правой панели) */
export const ДОП_ЯЧЕЙКИ: КлючЯчейки[] = [
  "Агентство",
  "Бренд",
  "Продукт",
  "Старт РК",
  "Окончание РК",
  "Делегирование кампании",
];
export const ДОП_СТОЛБЦЫ: КлючСтолбца[] = [
  "Поставщик",
  "Тип размещения",
  "Формат размещения",
  "Хостинг видео",
  "Среда размещения",
  "Тип измерения",
  "Название баннера",
  "URL баннера",
  "Время начала","Время окончания","Тип кода","Делегирование поставщиков","Трекерный сайт",
  "Mediascope","URL аудитора","VAST версия","Редирект",
  "exss","ЕРИР","Bundle ID","GAID/IDFA","Внешний ID",
  "Дин. параметры клика","Дин. параметры показа","Гео","Целевая аудитория"
];

export const НАЗВАНИЯ_СТОЛБЦОВ: Record<КлючСтолбца, string> = {
  "Название позиции": "Название позиции",
  "Поставщик": "Название поставщика/ площадки",
  "Тип размещения": "Тип размещения",
  "Формат размещения": "Формат размещения",
  "Хостинг видео": "Хостинг видео",
  "Среда размещения": "Среда размещения",
  "Тип измерения": "Тип измерения",
  "Название баннера": "Название баннера",
  "URL баннера": "URL баннера",
  "Время начала": "Дата начала размещения",
  "Время окончания": "Дата окончания размещения",
  "Тип кода": "Тип кода / пикселя AdRiver",
  "Делегирование поставщиков": "Делегирование конкретным поставщикам",
  "Трекерный сайт": "Трекерный сайт",
  "Mediascope": "Mediascope",
  "URL аудитора": "URL дополнительного аудитора",
  "VAST версия": "VAST версия",
  "Редирект": "Редирект",
  "exss": "Макрос exss",
  "ЕРИР": "Макрос erir",
  "Bundle ID": "Макрос bundle_id",
  "GAID/IDFA": "Макрос adv_id",
  "Внешний ID": "Макрос aext_id",
  "Дин. параметры клика": "Динамические параметры клика",
  "Дин. параметры показа": "Динамические параметры показа",
  "Гео": "Гео",
  "Целевая аудитория": "Целевая аудитория",
};

/** Маппинг разметки на русском */
export type РазметкаRU = {
  ячейки: Partial<Record<КлючЯчейки, string>>;
  ячейкиRefs?: Partial<Record<КлючЯчейки, СсылкаНаЯчейкуRU>>;
  столбцы: Partial<Record<КлючСтолбца, string>>;
  столбцыRefs?: Partial<Record<КлючСтолбца, СсылкаНаСтолбецRU>>;
  templateId?: string;
};

export type MappingValidationResult = {
  cellsOK: number;
  colsOK: number;
  ready: boolean;
  errors: string[];
  warnings: string[];
};

export type MappingTemplateRU = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  headersFingerprint: string;
  mapping: РазметкаRU;
};

export type MediaplanStatus = "в очереди" | "кампания создана" | "ошибка";
export type MediaplanSource = "upload" | "create";

export type MediaplanRecord = {
  id: string;
  title: string;
  description?: string;
  uploadedAt: string;
  updatedAt: string;
  status: MediaplanStatus;
  source: MediaplanSource;
  advertiser?: string;
  campaignName?: string;
  brand?: string;
  fileName?: string;
  rowsCount?: number;
  scenarioNames?: string[];
  generatedPositionIndexes?: number[];
  campaignDelegateAccounts?: string[];
  scenarioDelegations?: Record<string, string[]>;
  draftId?: string;
  importFileName?: string;
  upload?: MediaplanUpload | null;
  mapping?: РазметкаRU | null;
  import?: MediaplanImport | null;
};

export type ColumnSuggestionRU = {
  column: string;
  score: number;
  confidence: "high" | "medium" | "low";
};

export type CellSuggestionRU = {
  address: string;
  value?: string;
};

function normalizeMediaplanStatus(status: string | undefined): MediaplanStatus {
  if (status === "кампания создана" || status === "ошибка") return status;
  return "в очереди";
}

function normalizePositionIndexes(indexes: number[] | undefined): number[] {
  return Array.from(
    new Set(
      (indexes || [])
        .filter((index) => Number.isInteger(index) && index >= 0)
        .map((index) => Number(index))
    )
  ).sort((a, b) => a - b);
}

/** Синонимы ячеек уровня кампании */
export const СИНОНИМЫ_ЯЧЕЕК: Record<КлючЯчейки, string[]> = {
  "Рекламодатель": ["Рекламодатель", "Клиент", "Advertiser"],
  "Название РК": ["Название РК", "Название рекламной кампании", "Campaign name"],
  "Агентство": ["Агентство", "Рекламное агентство", "Agency"],
  "Бренд": ["Бренд", "Brand"],
  "Продукт": ["Продукт", "Product"],
  "Старт РК": ["Старт РК", "Дата начала", "Начало кампании", "Start"],
  "Окончание РК": ["Окончание РК", "Дата окончания", "Конец кампании", "End"],
  "Делегирование кампании": ["Делегирование кампании", "Delegate accounts"],
};

/** Синонимы заголовков → КлючСтолбца (помогает автосопоставлению) */
export const СИНОНИМЫ_СТОЛБЦОВ: Record<КлючСтолбца, string[]> = {
  "Название позиции": ["Название позиции","Название площадки","Площадка","Site","Placement"],
  "Поставщик": ["Поставщик","Название поставщика","Название поставщика/ площадки","Vendor","Provider","Партнёр","Площадка"],
  "Тип размещения": ["Тип размещения","Placement type","Тип инвентаря"],
  "Формат размещения": ["Формат размещения","Формат","Format","banner/video"],
  "Хостинг видео": ["Хостинг видео","Hosting","Video hosting","YouTube/VPAID"],
  "Среда размещения": ["Среда размещения","Среда","Environment","web/in-app/smart"],
  "Тип измерения": ["Тип измерения","Measurement","Verification Type","IVT","Аудит","Полная верификация"],
  "Название баннера": ["Название баннера","Комментарий","Banner name","Creative name"],
  "URL баннера": ["URL баннера","target_url","Ссылка","Click URL"],
  "Время начала": ["Время начала","Дата начала размещения","Start","Дата начала","Флайт старт"],
  "Время окончания": ["Время окончания","Дата окончания размещения","End","Дата окончания","Флайт конец"],
  "Тип кода": ["Тип кода","Тип кода / пикселя AdRiver","code_id","Тип счётчика","Code"],
  "Делегирование поставщиков": ["Делегирование поставщиков","Делегирование конкретным поставщикам","Delegate","Reseller","Partner IDs"],
  "Трекерный сайт": ["Трекерный сайт","Tracker site","Web/iOS/Android","OS"],
  "Mediascope": ["Mediascope","TNS","Внешний аудит","Auditor"],
  "URL аудитора": ["URL аудитора","URL дополнительного аудитора","Auditor URL"],
  "VAST версия": ["VAST версия","VAST","VAST version"],
  "Редирект": ["Редирект","Redirect"],
  "exss": ["exss","Макрос exss","EXSS"],
  "ЕРИР": ["ЕРИР","Макрос erir","ERIR"],
  "Bundle ID": ["Bundle ID","Макрос bundle_id","bundle"],
  "GAID/IDFA": ["GAID/IDFA","Макрос adv_id","GAID","IDFA","adv_id"],
  "Внешний ID": ["Внешний ID","Макрос aext_id","aext_id","ext_id","External ID"],
  "Дин. параметры клика": ["Дин. параметры клика","Динамические параметры клика","Dynamic click params"],
  "Дин. параметры показа": ["Дин. параметры показа","Динамические параметры показа","Dynamic impression params"],
  "Гео": ["Гео","Geo","География"],
  "Целевая аудитория": ["Целевая аудитория","Audience"]
};

const normalizeHeader = (value: unknown): string =>
  String(value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[_/\\-]+/g, " ")
    .replace(/[^a-zа-я0-9\s]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenizeHeader = (value: unknown): string[] => normalizeHeader(value).split(" ").filter(Boolean);

const scoreHeaderMatch = (header: unknown, synonym: unknown): number => {
  const normalizedHeader = normalizeHeader(header);
  const normalizedSynonym = normalizeHeader(synonym);
  if (!normalizedHeader || !normalizedSynonym) return 0;
  if (normalizedHeader === normalizedSynonym) return 100;
  if (normalizedHeader.includes(normalizedSynonym) || normalizedSynonym.includes(normalizedHeader)) return 80;

  const headerTokens = new Set(tokenizeHeader(header));
  const synonymTokens = tokenizeHeader(synonym);
  if (synonymTokens.length > 0 && synonymTokens.every((token) => headerTokens.has(token))) {
    return 60 + synonymTokens.length;
  }
  return 0;
};

/** Простая нормализация значений */
export const normFormat = (s: unknown): "banner"|"video" => {
  const x = String(s||"").toLowerCase();
  return (x.includes("видео") || x.includes("video")) ? "video" : "banner";
};
export const normEnv = (s: unknown): "web"|"in-app"|"smart"|"mixed" => {
  const x = String(s||"").toLowerCase();
  if (x.includes("in") && x.includes("app")) return "in-app";
  if (x.includes("smart")) return "smart";
  if (x.includes("смеш") || x.includes("mix")) return "mixed";
  return "web";
};
export const normMeasure = (s: unknown): PlacementRow["measurement_type"] => {
  const x = String(s||"").toLowerCase();
  if (x.includes("full")) return "full_verification";
  if (x.includes("ivt")) return "ivt";
  if (x.includes("click")) return "click_only";
  if (x.includes("view")) return "audit_viewability";
  return "audit";
};
export function toISODate(v: unknown): string|undefined {
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
export const splitList = (s: unknown): string[] => String(s||"").split(/[,;|]/g).map(x=>x.trim()).filter(Boolean);

export function headersFingerprint(headers: string[]): string {
  const base = headers.map((header) => normalizeHeader(header)).filter(Boolean).sort().join("|");
  let hash = 0;
  for (let i = 0; i < base.length; i += 1) {
    hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  }
  return `hdr_${hash.toString(16)}`;
}

/** Автоматическое сопоставление столбцов по заголовкам (в русские ключи) */
export function autoMapColumnsRU(headers: string[]): Partial<Record<КлючСтолбца,string>> {
  const mapping: Partial<Record<КлючСтолбца,string>> = {};
  const usedHeaders = new Set<string>();

  for (const [key, syns] of Object.entries(СИНОНИМЫ_СТОЛБЦОВ) as [КлючСтолбца, string[]][]) {
    let best: ColumnSuggestionRU | null = null;
    for (const header of headers) {
      const score = syns.reduce((maxScore, synonym) => Math.max(maxScore, scoreHeaderMatch(header, synonym)), 0);
      if (score === 0) continue;
      const confidence: ColumnSuggestionRU["confidence"] = score >= 100 ? "high" : score >= 80 ? "medium" : "low";
      if (!best || score > best.score) {
        best = { column: header, score, confidence };
      }
    }
    if (best && !usedHeaders.has(best.column)) {
      mapping[key] = best.column;
      usedHeaders.add(best.column);
    }
  }
  return mapping;
}

export function suggestColumnsRU(headers: string[]): Partial<Record<КлючСтолбца, ColumnSuggestionRU>> {
  const out: Partial<Record<КлючСтолбца, ColumnSuggestionRU>> = {};
  for (const [key, syns] of Object.entries(СИНОНИМЫ_СТОЛБЦОВ) as [КлючСтолбца, string[]][]) {
    let best: ColumnSuggestionRU | null = null;
    for (const header of headers) {
      const score = syns.reduce((maxScore, synonym) => Math.max(maxScore, scoreHeaderMatch(header, synonym)), 0);
      if (score === 0) continue;
      const confidence: ColumnSuggestionRU["confidence"] = score >= 100 ? "high" : score >= 80 ? "medium" : "low";
      if (!best || score > best.score) {
        best = { column: header, score, confidence };
      }
    }
    if (best) out[key] = best;
  }
  return out;
}

export function scoreHeaderRow(row: unknown[]): number {
  const values = row.map((cell) => String(cell || "").trim()).filter(Boolean);
  if (!values.length) return 0;
  const autoMapped = autoMapColumnsRU(values);
  const exactHeaderHits = values.reduce((hits, value) => {
    const normalized = normalizeHeader(value);
    return hits + (Object.values(СИНОНИМЫ_СТОЛБЦОВ).some((syns) => syns.some((syn) => normalizeHeader(syn) === normalized)) ? 1 : 0);
  }, 0);
  return Object.keys(autoMapped).length * 20 + exactHeaderHits * 10 + values.length;
}

function toExcelColumnLabel(index: number): string {
  let current = index + 1;
  let label = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    current = Math.floor((current - 1) / 26);
  }
  return label;
}

export function autoMapCampaignCellsRU(upload: MediaplanUpload): Partial<Record<КлючЯчейки, СсылкаНаЯчейкуRU>> {
  const refs: Partial<Record<КлючЯчейки, СсылкаНаЯчейкуRU>> = {};
  if (!upload.matrix?.length) return refs;

  const maxRows = Math.min(upload.matrix.length, 40);
  const maxCols = upload.matrix.reduce((max, row) => Math.max(max, row.length), 0);

  for (let rowIndex = 0; rowIndex < maxRows; rowIndex += 1) {
    for (let colIndex = 0; colIndex < maxCols; colIndex += 1) {
      const rawLabel = String(upload.matrix[rowIndex]?.[colIndex] || "").trim();
      if (!rawLabel) continue;

      for (const [key, synonyms] of Object.entries(СИНОНИМЫ_ЯЧЕЕК) as [КлючЯчейки, string[]][]) {
        if (refs[key]) continue;
        const bestScore = synonyms.reduce((maxScore, synonym) => Math.max(maxScore, scoreHeaderMatch(rawLabel, synonym)), 0);
        if (bestScore < 80) continue;

        for (let valueColIndex = colIndex + 1; valueColIndex < maxCols; valueColIndex += 1) {
          const rawValue = upload.matrix[rowIndex]?.[valueColIndex];
          const stringValue = rawValue == null ? "" : String(rawValue).trim();
          if (!stringValue) continue;
          refs[key] = {
            address: `${toExcelColumnLabel(valueColIndex)}${rowIndex + 1}`,
            value: stringValue,
          };
          break;
        }
      }
    }
  }

  return refs;
}

/** Трансляция RU → внутренние поля */
const RU2CANON_CELL: Record<КлючЯчейки, keyof CampaignMeta> = {
  "Рекламодатель": "advertiser",
  "Название РК": "campaign_name",
  "Агентство": "agency",
  "Бренд": "brand",
  "Продукт": "product",
  "Старт РК": "date_start",
  "Окончание РК": "date_end",
  "Делегирование кампании": "delegate_accounts",
};
const RU2CANON_COL: Record<КлючСтолбца, keyof PlacementRow> = {
  "Название позиции": "platform_name",
  "Поставщик": "supplier",
  "Тип размещения": "placement_type",
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

function excelColumnLettersToIndex(letters: string): number {
  return letters.split("").reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
}

function resolveCellRef(upload: MediaplanUpload, ref?: СсылкаНаЯчейкуRU): string | undefined {
  if (!ref) return undefined;
  if (ref.value) return String(ref.value);
  if (!upload.matrix?.length) return undefined;
  const match = ref.address.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return undefined;
  const col = excelColumnLettersToIndex(match[1].toUpperCase());
  const row = Number(match[2]) - 1;
  const value = upload.matrix[row]?.[col];
  if (value == null) return undefined;
  const stringValue = String(value).trim();
  return stringValue || undefined;
}

function resolveMappedCellValue(upload: MediaplanUpload, mapping: РазметкаRU, key: КлючЯчейки): string | undefined {
  const direct = mapping.ячейки[key];
  if (direct && String(direct).trim()) return String(direct).trim();
  return resolveCellRef(upload, mapping.ячейкиRefs?.[key]);
}

function resolveMappedColumnLabel(mapping: РазметкаRU, key: КлючСтолбца): string | undefined {
  return mapping.столбцыRefs?.[key]?.label || mapping.столбцы[key];
}

function assignPlacementValue(
  target: Partial<PlacementRow>,
  canon: keyof PlacementRow,
  val: unknown,
  meta: Partial<CampaignMeta>
) {
  switch (canon) {
    case "format":
      target.format = normFormat(val);
      break;
    case "environment":
      target.environment = normEnv(val);
      break;
    case "measurement_type":
      target.measurement_type = normMeasure(val);
      break;
    case "time_start":
      target.time_start = toISODate(val) || meta.date_start;
      break;
    case "time_end":
      target.time_end = toISODate(val) || meta.date_end;
      break;
    case "delegate_suppliers":
      target.delegate_suppliers = splitList(val);
      break;
    case "tracker_site":
      target.tracker_site = splitList(val).filter(
        (x): x is "Web" | "iOS" | "Android" => x === "Web" || x === "iOS" || x === "Android"
      );
      break;
    default:
      (target as Record<string, unknown>)[canon] = val == null ? undefined : String(val);
  }
}

export function validateMappingRU(mapping: РазметкаRU, upload?: MediaplanUpload): MappingValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cellsOK = ОБЯЗАТЕЛЬНЫЕ_ЯЧЕЙКИ.filter((key) => {
    if (!upload) return Boolean(mapping.ячейки[key]?.trim() || mapping.ячейкиRefs?.[key]?.address);
    return Boolean(resolveMappedCellValue(upload, mapping, key));
  }).length;
  const colsOK = ОБЯЗАТЕЛЬНЫЕ_СТОЛБЦЫ.filter((key) => Boolean(mapping.столбцыRefs?.[key]?.address || mapping.столбцы[key])).length;

  for (const req of ОБЯЗАТЕЛЬНЫЕ_ЯЧЕЙКИ) {
    const value = upload ? resolveMappedCellValue(upload, mapping, req) : mapping.ячейки[req];
    if (!value) errors.push(`Не указан обязательный объект «${req}».`);
  }
  for (const req of ОБЯЗАТЕЛЬНЫЕ_СТОЛБЦЫ) {
    if (!mapping.столбцыRefs?.[req]?.address && !mapping.столбцы[req]) errors.push(`Не указан столбец для «${req}».`);
  }

  if (upload && resolveMappedColumnLabel(mapping, "Формат размещения") && resolveMappedColumnLabel(mapping, "Хостинг видео")) {
    const formatHeader = resolveMappedColumnLabel(mapping, "Формат размещения");
    const hostingHeader = resolveMappedColumnLabel(mapping, "Хостинг видео");
    upload.rowsRaw.forEach((row, index) => {
      if (!formatHeader || !hostingHeader) return;
      const format = normFormat(row[formatHeader]);
      const hosting = String(row[hostingHeader] ?? "").trim();
      if (format === "video" && !hosting) {
        warnings.push(`Видео-строка без «Хостинг видео» (строка ${index + 1}).`);
      }
    });
  }

  return {
    cellsOK,
    colsOK,
    ready: errors.length === 0,
    errors,
    warnings,
  };
}

export function applyMappingRU(
  mapping: РазметкаRU,
  upload: MediaplanUpload
): MediaplanImport {
  const validation = validateMappingRU(mapping, upload);

  // 1) Кампания (из ячеек справа). Значения берем напрямую (прототип)
  const meta: Partial<CampaignMeta> = {};
  const cellEntries = new Set<КлючЯчейки>([
    ...(Object.keys(mapping.ячейки) as КлючЯчейки[]),
    ...(Object.keys(mapping.ячейкиRefs || {}) as КлючЯчейки[]),
  ]);
  for (const k of cellEntries) {
    const v = resolveMappedCellValue(upload, mapping, k);
    const canon = RU2CANON_CELL[k];
    if (!v) continue;
    if (canon === "delegate_accounts") meta.delegate_accounts = splitList(v);
    else if (canon === "date_start") meta.date_start = toISODate(v);
    else if (canon === "date_end") meta.date_end = toISODate(v);
    else if (canon === "brand") meta.brand = v;
    else if (canon === "campaign_name") meta.campaign_name = v;
    else if (canon === "agency") meta.agency = v;
    else if (canon === "advertiser") meta.advertiser = v;
    else if (canon === "product") meta.product = v;
  }
  // 2) Построим строки размещений
  const columnEntries = new Set<КлючСтолбца>([
    ...(Object.keys(mapping.столбцы) as КлючСтолбца[]),
    ...(Object.keys(mapping.столбцыRefs || {}) as КлючСтолбца[]),
  ]);

  const rows: PlacementRow[] = [];
  const hasColumnRefs = columnEntries.size > 0 && [...columnEntries].some((key) => Boolean(mapping.столбцыRefs?.[key]));

  if (hasColumnRefs && upload.matrix?.length) {
    const refEntries = [...columnEntries]
      .map((key) => [key, mapping.столбцыRefs?.[key]] as const)
      .filter(([, ref]) => Boolean(ref)) as [КлючСтолбца, СсылкаНаСтолбецRU][];
    const matrixLength = upload.matrix.length;
    const maxRows = refEntries.reduce((max, [, ref]) => Math.max(max, matrixLength - ref.dataStartRow), 0);

    for (let rowOffset = 0; rowOffset < maxRows; rowOffset += 1) {
      const r: Partial<PlacementRow> = {};
      let hasData = false;

      for (const key of columnEntries) {
        const canon = RU2CANON_COL[key];
        let val: unknown;
        const ref = mapping.столбцыRefs?.[key];
        if (ref) {
          val = upload.matrix[ref.dataStartRow + rowOffset]?.[ref.colIndex];
        } else {
          const colName = mapping.столбцы[key];
          if (!colName) continue;
          val = upload.rowsRaw[rowOffset]?.[colName];
        }

        const stringValue = val == null ? "" : String(val).trim();
        if (stringValue) hasData = true;
        assignPlacementValue(r, canon, val, meta);
      }

      if (hasData) rows.push(r as PlacementRow);
    }
  } else {
    for (const raw of upload.rowsRaw) {
      const r: Partial<PlacementRow> = {};
      let hasData = false;
      for (const [ruKey, colName] of Object.entries(mapping.столбцы) as [КлючСтолбца,string][]) {
        if (!colName) continue;
        const val = raw[colName];
        if (val != null && String(val).trim() !== "") hasData = true;

        const canon = RU2CANON_COL[ruKey];
        assignPlacementValue(r, canon, val, meta);
      }
      if (hasData) rows.push(r as PlacementRow);
    }
  }

  return {
    meta: {
      advertiser: meta.advertiser,
      campaign_name: meta.campaign_name || "",
      brand: meta.brand,
      agency: meta.agency,
      product: meta.product,
      date_start: meta.date_start,
      date_end: meta.date_end,
      delegate_accounts: meta.delegate_accounts,
    },
    rows,
    warnings: validation.warnings,
    errors: validation.errors,
    source: { fileName: upload.fileName, sheet: upload.sheet, headerRow: upload.headerRow, headers: upload.headers }
  };
}

/** ===== Хранилище в localStorage ===== */
const K_UPLOAD = "adriver/mp/upload";
const K_MAPPING_RU = "adriver/mp/mapping_ru";
const K_IMPORT = "adriver/mp/import";
const K_MAPPING_TEMPLATE_INDEX = "adriver/mp/mapping_templates/index";
const K_MEDIAPLAN_INDEX = "adriver/mp/list/index";
const K_MEDIAPLAN_SCENARIO_HIGHLIGHT_PREFIX = "adriver/mp/highlight/";

export const saveUpload = (u: MediaplanUpload) => localStorage.setItem(K_UPLOAD, JSON.stringify(u));
export const loadUpload = (): MediaplanUpload | null => {
  try { const s = localStorage.getItem(K_UPLOAD); return s ? JSON.parse(s) : null; } catch { return null; }
};
export const clearUpload = () => localStorage.removeItem(K_UPLOAD);

export const saveMappingRU = (m: РазметкаRU) => localStorage.setItem(K_MAPPING_RU, JSON.stringify(m));
export const loadMappingRU = (): РазметкаRU | null => {
  try { const s = localStorage.getItem(K_MAPPING_RU); return s ? JSON.parse(s) : null; } catch { return null; }
};
export const clearMappingRU = () => localStorage.removeItem(K_MAPPING_RU);

export const saveImport = (imp: MediaplanImport) => localStorage.setItem(K_IMPORT, JSON.stringify(imp));
export const loadImport = (): MediaplanImport | null => {
  try { const s = localStorage.getItem(K_IMPORT); return s ? JSON.parse(s) : null; } catch { return null; }
};
export const clearImport = () => localStorage.removeItem(K_IMPORT);

export function saveMediaplanScenarioHighlight(id: string, scenarioNames: string[]) {
  try {
    const normalized = normalizeScenarioNames(scenarioNames);
    localStorage.setItem(
      `${K_MEDIAPLAN_SCENARIO_HIGHLIGHT_PREFIX}${id}`,
      JSON.stringify({
        scenarioNames: normalized,
        createdAt: new Date().toISOString(),
      })
    );
  } catch {}
}

export function consumeMediaplanScenarioHighlight(id: string): string[] {
  try {
    const key = `${K_MEDIAPLAN_SCENARIO_HIGHLIGHT_PREFIX}${id}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    localStorage.removeItem(key);
    const parsed = JSON.parse(raw);
    return normalizeScenarioNames(parsed?.scenarioNames || []);
  } catch {
    return [];
  }
}

function readMediaplanIndex(): string[] {
  try { const s = localStorage.getItem(K_MEDIAPLAN_INDEX); return s ? JSON.parse(s) : []; } catch { return []; }
}

function writeMediaplanIndex(ids: string[]) {
  localStorage.setItem(K_MEDIAPLAN_INDEX, JSON.stringify(ids));
}

function nextMediaplanId(): string {
  const max = readMediaplanIndex().reduce((currentMax, id) => {
    const match = id.match(/^mp_(\d+)$/);
    if (!match) return currentMax;
    return Math.max(currentMax, Number(match[1]));
  }, 0);
  return `mp_${String(max + 1).padStart(4, "0")}`;
}

export function listMediaplans(): MediaplanRecord[] {
  const ids = readMediaplanIndex();
  return ids
    .map((id) => {
      try {
        const raw = localStorage.getItem(`adriver/mp/list/${id}`);
        if (!raw) return null;
        const record = JSON.parse(raw) as MediaplanRecord;
        return {
          ...record,
          status: normalizeMediaplanStatus(record.status),
          generatedPositionIndexes: normalizePositionIndexes(record.generatedPositionIndexes),
        } as MediaplanRecord;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as MediaplanRecord[];
}

export function getMediaplan(id: string): MediaplanRecord | null {
  try {
    const raw = localStorage.getItem(`adriver/mp/list/${id}`);
    if (!raw) return null;
    const record = JSON.parse(raw) as MediaplanRecord;
    return {
      ...record,
      status: normalizeMediaplanStatus(record.status),
      generatedPositionIndexes: normalizePositionIndexes(record.generatedPositionIndexes),
    };
  } catch {
    return null;
  }
}

export function saveMediaplan(record: Omit<MediaplanRecord, "uploadedAt" | "updatedAt"> & { uploadedAt?: string; updatedAt?: string }): MediaplanRecord {
  const existing = getMediaplan(record.id);
  const now = new Date().toISOString();
  const nextRecord: MediaplanRecord = {
    ...existing,
    ...record,
    status: normalizeMediaplanStatus(record.status),
    generatedPositionIndexes: normalizePositionIndexes(record.generatedPositionIndexes ?? existing?.generatedPositionIndexes),
    uploadedAt: existing?.uploadedAt || record.uploadedAt || now,
    updatedAt: record.updatedAt || now,
  };
  const ids = new Set(readMediaplanIndex());
  ids.add(nextRecord.id);
  writeMediaplanIndex([...ids]);
  localStorage.setItem(`adriver/mp/list/${nextRecord.id}`, JSON.stringify(nextRecord));
  return nextRecord;
}

export function deleteMediaplan(id: string) {
  const ids = new Set(readMediaplanIndex());
  ids.delete(id);
  writeMediaplanIndex([...ids]);
  localStorage.removeItem(`adriver/mp/list/${id}`);
}

export function findMediaplanByDraftId(draftId: string): MediaplanRecord | null {
  if (!draftId) return null;
  return listMediaplans().find((item) => item.draftId === draftId) || null;
}

function deriveMediaplanTitle(params: {
  upload?: MediaplanUpload | null;
  imp?: MediaplanImport | null;
  title?: string;
}): string {
  return (
    params.title?.trim() ||
    params.imp?.meta?.campaign_name ||
    params.upload?.fileName.replace(/\.[^.]+$/, "") ||
    "Медиаплан"
  );
}

function deriveMediaplanDescription(params: {
  upload?: MediaplanUpload | null;
  imp?: MediaplanImport | null;
  description?: string;
}): string {
  if (params.description?.trim()) return params.description.trim();
  if (params.imp?.meta?.advertiser) return `Рекламодатель: ${params.imp.meta.advertiser}`;
  if (params.upload?.fileName) return `Файл: ${params.upload.fileName}`;
  return "Описание не задано";
}

function normalizeScenarioNames(items: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  items.forEach((item) => {
    const value = item.trim();
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    next.push(value);
  });
  return next;
}

function deriveScenarioNamesFromImport(imp?: MediaplanImport | null): string[] {
  if (!imp) return [];
  return normalizeScenarioNames(
    imp.rows
      .map((row) => row.platform_name || row.banner_name || "")
      .filter(Boolean)
      .map(String)
  );
}

export function upsertUploadMediaplan(params: {
  id?: string;
  upload: MediaplanUpload;
  imp?: MediaplanImport | null;
  mapping?: РазметкаRU | null;
  draftId?: string;
  status?: MediaplanStatus;
  title?: string;
  description?: string;
}): MediaplanRecord {
  const recordId = params.id || nextMediaplanId();
  const status =
    params.status ||
    (params.imp
      ? params.imp.errors.length > 0
        ? "ошибка"
        : "в очереди"
      : "в очереди");
  return saveMediaplan({
    id: recordId,
    title: deriveMediaplanTitle(params),
    description: deriveMediaplanDescription(params),
    status,
    source: "upload",
    advertiser: params.imp?.meta.advertiser,
    campaignName: params.imp?.meta.campaign_name,
    brand: params.imp?.meta.brand,
    fileName: params.upload.fileName,
    importFileName: params.imp?.source.fileName || params.upload.fileName,
    rowsCount: params.imp?.rows.length ?? params.upload.rowsRaw.length,
    scenarioNames: deriveScenarioNamesFromImport(params.imp),
    generatedPositionIndexes: [],
    campaignDelegateAccounts: params.imp?.meta.delegate_accounts || [],
    scenarioDelegations: {},
    draftId: params.draftId,
    upload: params.upload,
    mapping: params.mapping || null,
    import: params.imp || null,
  });
}

export function upsertCreatedMediaplan(params: {
  id?: string;
  title: string;
  advertiser: string;
  brand?: string;
  agency?: string;
  rowsCount?: number;
  scenarioNames?: string[];
  delegateAccounts?: string[];
  status?: MediaplanStatus;
}): MediaplanRecord {
  const recordId = params.id || nextMediaplanId();
  const scenarioNames = normalizeScenarioNames(params.scenarioNames || []);
  return saveMediaplan({
    id: recordId,
    title: params.title.trim() || "Медиаплан",
    description: params.agency?.trim() ? `Агентство: ${params.agency.trim()}` : `Рекламодатель: ${params.advertiser.trim()}`,
    status: params.status || "в очереди",
    source: "create",
    advertiser: params.advertiser.trim(),
    campaignName: params.title.trim(),
    brand: params.brand?.trim() || undefined,
    rowsCount: scenarioNames.length || params.rowsCount || 0,
    scenarioNames,
    generatedPositionIndexes: [],
    campaignDelegateAccounts: params.delegateAccounts || [],
    scenarioDelegations: {},
  });
}

export function appendScenariosToMediaplan(params: {
  id: string;
  scenarioNames: string[];
  upload?: MediaplanUpload | null;
  mapping?: РазметкаRU | null;
  imp?: MediaplanImport | null;
}): MediaplanRecord {
  const existing = getMediaplan(params.id);
  if (!existing) {
    throw new Error(`Mediaplan ${params.id} not found`);
  }

  const appendedScenarioNames = normalizeScenarioNames(params.scenarioNames);
  const nextScenarioNames = normalizeScenarioNames([...(existing.scenarioNames || []), ...appendedScenarioNames]);
  const nextImport =
    params.imp && existing.import
      ? {
          ...params.imp,
          meta: {
            ...params.imp.meta,
            advertiser: existing.advertiser || params.imp.meta.advertiser,
            campaign_name: existing.campaignName || params.imp.meta.campaign_name,
            brand: existing.brand || params.imp.meta.brand,
          },
          rows: [...existing.import.rows, ...params.imp.rows],
        }
      : params.imp || existing.import || null;

  const nextDescription =
    existing.description ||
    (existing.advertiser ? `Рекламодатель: ${existing.advertiser}` : "Описание не задано");

  return saveMediaplan({
    ...existing,
    id: existing.id,
    description: nextDescription,
    status: "кампания создана",
    rowsCount: nextScenarioNames.length,
    scenarioNames: nextScenarioNames,
    generatedPositionIndexes: normalizePositionIndexes(existing.generatedPositionIndexes),
    campaignDelegateAccounts: existing.campaignDelegateAccounts || existing.import?.meta.delegate_accounts || [],
    scenarioDelegations: existing.scenarioDelegations || {},
    upload: params.upload ?? existing.upload ?? null,
    mapping: params.mapping ?? existing.mapping ?? null,
    import: nextImport,
  });
}

export function markMediaplanPositionsGenerated(id: string, indexes: number[]): MediaplanRecord {
  const existing = getMediaplan(id);
  if (!existing) {
    throw new Error(`Mediaplan ${id} not found`);
  }
  const nextIndexes = normalizePositionIndexes([...(existing.generatedPositionIndexes || []), ...indexes]);
  return saveMediaplan({
    ...existing,
    generatedPositionIndexes: nextIndexes,
  });
}

export function ensureMockMediaplans() {
  const existing = listMediaplans();
  const existingIds = new Set(existing.map((item) => item.id));

  const baseRecords: MediaplanRecord[] = [
    {
      id: "mp_0001",
      title: "Retail Alpha · весенняя промо-волна",
      description: "Рекламодатель: Retail Alpha · Excel-медиаплан загружен и ожидает обработки.",
      uploadedAt: "2026-03-22T09:10:00.000Z",
      updatedAt: "2026-03-22T09:10:00.000Z",
      status: "в очереди",
      source: "upload",
      advertiser: "Retail Alpha",
      campaignName: "Весенняя промо-волна",
      fileName: "retail-alpha-spring.xlsx",
      rowsCount: 18,
      scenarioNames: [
        "Главная страница desktop",
        "Каталог товаров mobile",
        "In-stream видео 15s",
        "Native feed card",
      ],
    },
    {
      id: "mp_0002",
      title: "Fintech Sprint · охватная кампания",
      description: "Рекламодатель: Fintech Sprint · В медиаплане обнаружены ошибки разметки.",
      uploadedAt: "2026-03-21T13:45:00.000Z",
      updatedAt: "2026-03-21T13:45:00.000Z",
      status: "ошибка",
      source: "upload",
      advertiser: "Fintech Sprint",
      campaignName: "Охватная кампания",
      fileName: "fintech-sprint-errors.xlsx",
      rowsCount: 11,
      scenarioNames: [
        "ROS mobile 320x480",
        "Native finance teaser",
        "Видео преролл 10s",
      ],
    },
    {
      id: "mp_0003",
      title: "Auto Pulse · видеофлайт март",
      description: "Рекламодатель: Auto Pulse · По медиаплану уже создана рекламная кампания.",
      uploadedAt: "2026-03-20T08:20:00.000Z",
      updatedAt: "2026-03-20T08:20:00.000Z",
      status: "кампания создана",
      source: "upload",
      advertiser: "Auto Pulse",
      campaignName: "Видеофлайт март",
      brand: "Auto Pulse",
      fileName: "auto-pulse-march.xlsx",
      rowsCount: 24,
      scenarioNames: [
        "YouTube pre-roll 20s",
        "OLV desktop homepage",
        "CTV video package",
        "In-app rewarded video",
        "Auto portal native card",
      ],
    },
  ];

  baseRecords.forEach((record) => {
    const existingRecord = existingIds.has(record.id) ? getMediaplan(record.id) : null;
    if (!existingRecord) {
      saveMediaplan(record);
      return;
    }
    if (existingRecord.scenarioNames?.length) return;
    saveMediaplan({
      ...existingRecord,
      scenarioNames: record.scenarioNames,
      rowsCount: existingRecord.rowsCount || record.rowsCount,
    });
  });

  return listMediaplans();
}

function readTemplateIndex(): string[] {
  try { const s = localStorage.getItem(K_MAPPING_TEMPLATE_INDEX); return s ? JSON.parse(s) : []; } catch { return []; }
}

function writeTemplateIndex(ids: string[]) {
  localStorage.setItem(K_MAPPING_TEMPLATE_INDEX, JSON.stringify(ids));
}

export function listMappingTemplates(): MappingTemplateRU[] {
  const ids = readTemplateIndex();
  return ids
    .map((id) => {
      try {
        const raw = localStorage.getItem(`adriver/mp/mapping_templates/${id}`);
        return raw ? (JSON.parse(raw) as MappingTemplateRU) : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as MappingTemplateRU[];
}

export function getMappingTemplate(id: string): MappingTemplateRU | null {
  try {
    const raw = localStorage.getItem(`adriver/mp/mapping_templates/${id}`);
    return raw ? (JSON.parse(raw) as MappingTemplateRU) : null;
  } catch {
    return null;
  }
}

export function saveMappingTemplate(template: Omit<MappingTemplateRU, "id" | "createdAt" | "updatedAt"> & { id?: string }): MappingTemplateRU {
  const now = new Date().toISOString();
  const record: MappingTemplateRU = {
    id: template.id || `tmpl_${Date.now()}`,
    name: template.name,
    headersFingerprint: template.headersFingerprint,
    mapping: template.mapping,
    createdAt: template.id ? getMappingTemplate(template.id)?.createdAt || now : now,
    updatedAt: now,
  };
  const ids = new Set(readTemplateIndex());
  ids.add(record.id);
  writeTemplateIndex([...ids]);
  localStorage.setItem(`adriver/mp/mapping_templates/${record.id}`, JSON.stringify(record));
  return record;
}

export function deleteMappingTemplate(id: string) {
  const ids = new Set(readTemplateIndex());
  ids.delete(id);
  writeTemplateIndex([...ids]);
  localStorage.removeItem(`adriver/mp/mapping_templates/${id}`);
}

export function findMappingTemplatesByHeaders(headers: string[]): MappingTemplateRU[] {
  const fingerprint = headersFingerprint(headers);
  return listMappingTemplates().filter((template) => template.headersFingerprint === fingerprint);
}

export function applyMappingTemplate(template: MappingTemplateRU, headers: string[]): РазметкаRU {
  const suggestions = autoMapColumnsRU(headers);
  const remappedColumns: Partial<Record<КлючСтолбца, string>> = {};
  (Object.entries(template.mapping.столбцы) as [КлючСтолбца, string][]).forEach(([key, originalHeader]) => {
    if (headers.includes(originalHeader)) {
      remappedColumns[key] = originalHeader;
      return;
    }
    if (suggestions[key]) remappedColumns[key] = suggestions[key];
  });
  return {
    ...template.mapping,
    ячейкиRefs: Object.fromEntries(
      Object.entries(template.mapping.ячейкиRefs || {}).map(([key, ref]) => [key, { address: ref.address }])
    ) as РазметкаRU["ячейкиRefs"],
    столбцыRefs: Object.fromEntries(
      Object.entries(template.mapping.столбцыRefs || {}).map(([key, ref]) => [key, { address: ref.address, label: ref.label, colIndex: ref.colIndex, dataStartRow: ref.dataStartRow }])
    ) as РазметкаRU["столбцыRefs"],
    столбцы: remappedColumns,
    templateId: template.id,
  };
}

// ===== Черновики медиапланов (localStorage) =====
export type Draft = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
  source?: "upload" | "create";
  upload?: MediaplanUpload | null;
  mapping?: РазметкаRU | null;
  import?: MediaplanImport | null;
  meta?: { brand?: string; advertiser?: string; campaign_name?: string };
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
  const existing = getDraft(d.id);
  const now = new Date().toISOString();
  const record: Draft = {
    ...existing,
    ...d,
    createdAt: existing?.createdAt || d.createdAt || now,
    updatedAt: d.updatedAt || now,
  };
  const ids = new Set(readDraftIndex()); ids.add(record.id); writeDraftIndex([...ids]);
  localStorage.setItem(`adriver/mp/drafts/${record.id}`, JSON.stringify(record));
}
export function deleteDraft(id: string) {
  const ids = new Set(readDraftIndex()); ids.delete(id); writeDraftIndex([...ids]);
  localStorage.removeItem(`adriver/mp/drafts/${id}`);
}
// Удобная утилита: сохранение «быстрого» черновика из текущей разметки (если она есть)
export function saveQuickDraft(defaultName = "Черновик медиаплана") {
  const upload = loadUpload();
  const imp = loadImport();
  const m =
    loadMappingRU() || {
      ячейки: { "Рекламодатель": "Рекламодатель 1", "Название РК": "Новая кампания", "Бренд": "Бренд 1" },
      столбцы: {},
    };
  const id = `d${Date.now()}`;
  const d: Draft = {
    id,
    name: (m.ячейки?.["Название РК"] as string) || defaultName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: "upload",
    upload,
    mapping: m,
    import: imp,
    meta: {
      brand: m.ячейки?.["Бренд"] as string,
      advertiser: m.ячейки?.["Рекламодатель"] as string,
      campaign_name: m.ячейки?.["Название РК"] as string,
    },
    rowsCount: imp?.rows.length ?? upload?.rowsRaw.length ?? 0
  };
  saveDraft(d);
  return d;
}

export function saveUploadDraft(params: {
  id?: string;
  name?: string;
  upload: MediaplanUpload;
  mapping: РазметкаRU;
  imp: MediaplanImport;
}): Draft {
  const existing = params.id ? getDraft(params.id) : null;
  const now = new Date().toISOString();
  const record: Draft = {
    id: existing?.id || params.id || `d${Date.now()}`,
    name:
      params.name?.trim() ||
      params.imp.meta.campaign_name ||
      params.upload.fileName.replace(/\.[^.]+$/, "") ||
      "Черновик медиаплана",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    source: "upload",
    upload: params.upload,
    mapping: params.mapping,
    import: params.imp,
    meta: {
      brand: params.imp.meta.brand,
      advertiser: params.imp.meta.advertiser,
      campaign_name: params.imp.meta.campaign_name,
    },
    rowsCount: params.imp.rows.length,
  };
  saveDraft(record);
  return getDraft(record.id) || record;
}

// proto-build compat
export type Mapping = Partial<Record<КлючСтолбца, string>>;
export const REQUIRED_KEYS: string[] = [...ОБЯЗАТЕЛЬНЫЕ_СТОЛБЦЫ];
export const TARGET_KEYS: string[] = [...ОБЯЗАТЕЛЬНЫЕ_СТОЛБЦЫ, ...ДОП_СТОЛБЦЫ];
export { loadMappingRU as loadMapping };
export { saveMappingRU as saveMapping };
export function applyMapping(mapping: Mapping, upload: MediaplanUpload, meta?: Partial<CampaignMeta>): MediaplanImport {
  const ruMapping: РазметкаRU = {
    ячейки: {
      "Рекламодатель": meta?.advertiser || "",
      "Название РК": meta?.campaign_name || "",
      "Бренд": meta?.brand || "",
      "Агентство": meta?.agency || "",
      "Продукт": meta?.product || "",
      "Старт РК": meta?.date_start || "",
      "Окончание РК": meta?.date_end || "",
      "Делегирование кампании": (meta?.delegate_accounts || []).join(", "),
    },
    столбцы: mapping,
  };
  return applyMappingRU(ruMapping, upload);
}
