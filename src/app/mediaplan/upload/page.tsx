'use client';

import Link from "next/link";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  CircleAlert,
  CircleHelp,
  ClipboardList,
  FileSpreadsheet,
  Lightbulb,
  PencilRuler,
  RotateCcw,
  Upload,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useRouter, useSearchParams } from "next/navigation";
import {
  appendScenariosToMediaplan,
  autoMapCampaignCellsRU,
  MediaplanUpload,
  ОБЯЗАТЕЛЬНЫЕ_ЯЧЕЙКИ,
  ОБЯЗАТЕЛЬНЫЕ_СТОЛБЦЫ,
  ДОП_ЯЧЕЙКИ,
  ДОП_СТОЛБЦЫ,
  НАЗВАНИЯ_СТОЛБЦОВ,
  applyMappingRU,
  applyMappingTemplate,
  autoMapColumnsRU,
  clearImport,
  clearMappingRU,
  clearUpload,
  saveMediaplanScenarioHighlight,
  findMappingTemplatesByHeaders,
  findMediaplanByDraftId,
  getMediaplan,
  getDraft,
  headersFingerprint,
  loadMappingRU,
  loadUpload,
  scoreHeaderRow,
  saveImport,
  saveUploadDraft,
  saveMappingRU,
  saveMappingTemplate,
  saveUpload,
  upsertUploadMediaplan,
  suggestColumnsRU,
  validateMappingRU,
  type ColumnSuggestionRU,
  type MediaplanImport,
  type MediaplanRecord,
  type PlacementRow,
  type КлючЯчейки,
  type КлючСтолбца,
  type РазметкаRU,
} from "@/lib/mediaplan";
import { upsertCampaignFromMediaplan } from "@/lib/campaigns";

function detectHeaderRow(rows: unknown[][]): number {
  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(rows.length, 50); i += 1) {
    const score = scoreHeaderRow(rows[i] || []);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function isBlankSpreadsheetCell(value: unknown): boolean {
  return value == null || String(value).trim() === "";
}

function isBlankSpreadsheetRow(row: unknown[] | undefined): boolean {
  return !row || row.every(isBlankSpreadsheetCell);
}

function isBlankRawRow(row: Record<string, unknown>, headers: string[]): boolean {
  return headers.every((header) => isBlankSpreadsheetCell(row[header]));
}

function parseCsv(text: string): { matrix: string[][]; headers: string[]; rowsRaw: Record<string, unknown>[] } {
  const matrix = text
    .split(/\r?\n/)
    .map((line) => line.split(",").map((cell) => cell.trim()))
    .filter((row) => !isBlankSpreadsheetRow(row));
  const headers = sanitizeHeaders(matrix[0] || []);
  const rowsRaw = matrix
    .slice(1)
    .filter((row) => !isBlankSpreadsheetRow(row))
    .map((row) => {
      const out: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        out[header] = row[index];
      });
      return out;
    });
  return { matrix, headers, rowsRaw };
}

function suggestionTone(confidence?: ColumnSuggestionRU["confidence"]): string {
  if (confidence === "high") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (confidence === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
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

function getCellAddress(rowIndex: number, colIndex: number): string {
  return `${toExcelColumnLabel(colIndex)}${rowIndex + 1}`;
}

function getCellText(value: unknown): string {
  const stringValue = value == null ? "" : String(value).trim();
  return stringValue || "—";
}

function sanitizeHeaders(headers: unknown[]): string[] {
  return Array.from(headers || [], (header) => (header == null ? "" : String(header).trim()));
}

function sanitizeUpload(nextUpload: MediaplanUpload | null): MediaplanUpload | null {
  if (!nextUpload) return null;
  const headers = sanitizeHeaders(nextUpload.headers || []);
  const rowsRaw = (nextUpload.rowsRaw || [])
    .map((row) => {
      const out: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        out[header] = row[header] ?? Object.values(row)[index];
      });
      return out;
    })
    .filter((row) => !isBlankRawRow(row, headers));
  return {
    ...nextUpload,
    headers,
    rowsRaw,
  };
}

function titleFromUploadFile(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

function resolveMediaplanTitle(
  upload: MediaplanUpload,
  imp?: MediaplanImport | null
): string {
  const parsedCampaignName = imp?.meta?.campaign_name?.trim();
  return parsedCampaignName || "Название РК не размечено";
}

function normalizeHeaderForCompare(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

function getColumnDisplayName(key: КлючСтолбца): string {
  return НАЗВАНИЯ_СТОЛБЦОВ[key] || key;
}

function buildAutoColumnRefs(
  upload: MediaplanUpload,
  mappedColumns: Partial<Record<КлючСтолбца, string>>
): NonNullable<РазметкаRU["столбцыRefs"]> {
  const refs: NonNullable<РазметкаRU["столбцыRefs"]> = {};
  const anchorRowIndex = Math.max(upload.headerRow - 1, 0);
  for (const [key, label] of Object.entries(mappedColumns) as [КлючСтолбца, string][]) {
    if (!label) continue;
    const colIndex = upload.headers.findIndex((header) => header === label);
    if (colIndex < 0) continue;
    refs[key] = {
      address: getCellAddress(anchorRowIndex, colIndex),
      label,
      colIndex,
      dataStartRow: anchorRowIndex + 1,
    };
  }
  return refs;
}

function createInitialMapping(upload: MediaplanUpload): РазметкаRU {
  const autoColumns = autoMapColumnsRU(upload.headers);
  return {
    ячейки: {},
    ячейкиRefs: autoMapCampaignCellsRU(upload),
    столбцы: autoColumns,
    столбцыRefs: buildAutoColumnRefs(upload, autoColumns),
  };
}

const PLACEMENT_KEY_TO_COLUMN_KEY: Partial<Record<keyof PlacementRow, КлючСтолбца>> = {
  platform_name: "Название позиции",
  supplier: "Поставщик",
  placement_type: "Тип размещения",
  format: "Формат размещения",
  hosting: "Хостинг видео",
  environment: "Среда размещения",
  measurement_type: "Тип измерения",
  banner_name: "Название баннера",
  target_url: "URL баннера",
  time_start: "Время начала",
  time_end: "Время окончания",
  code_type: "Тип кода",
  delegate_suppliers: "Делегирование поставщиков",
  tracker_site: "Трекерный сайт",
  auditor_mediascope: "Mediascope",
  auditor_url: "URL аудитора",
  vast_version: "VAST версия",
  auditor_redirect: "Редирект",
  macro_exss: "exss",
  macro_erir: "ЕРИР",
  macro_bundle_id: "Bundle ID",
  macro_adv_id: "GAID/IDFA",
  macro_ext_id: "Внешний ID",
  dyn_click: "Дин. параметры клика",
  dyn_impression: "Дин. параметры показа",
  geo: "Гео",
  audience: "Целевая аудитория",
};

function buildLockedCampaignCells(target: MediaplanRecord): Partial<Record<КлючЯчейки, string>> {
  const meta = target.import?.meta;
  return {
    "Рекламодатель": meta?.advertiser || target.advertiser || "",
    "Название РК": meta?.campaign_name || target.campaignName || "",
    "Агентство": meta?.agency || "",
    "Бренд": meta?.brand || target.brand || "",
    "Продукт": meta?.product || "",
    "Старт РК": meta?.date_start || "",
    "Окончание РК": meta?.date_end || "",
  };
}

function deriveAppendColumnKeys(target: MediaplanRecord): КлючСтолбца[] {
  const keys = new Set<КлючСтолбца>(ОБЯЗАТЕЛЬНЫЕ_СТОЛБЦЫ);
  (Object.keys(target.mapping?.столбцыRefs || {}) as КлючСтолбца[]).forEach((key) => keys.add(key));
  (Object.keys(target.mapping?.столбцы || {}) as КлючСтолбца[]).forEach((key) => keys.add(key));

  if (!keys.size && target.import?.rows.length) {
    for (const row of target.import.rows) {
      (Object.entries(PLACEMENT_KEY_TO_COLUMN_KEY) as [keyof PlacementRow, КлючСтолбца][]).forEach(([sourceKey, columnKey]) => {
        const value = row[sourceKey];
        if (Array.isArray(value) ? value.length > 0 : value != null && String(value).trim() !== "") {
          keys.add(columnKey);
        }
      });
    }
  }

  return [...ОБЯЗАТЕЛЬНЫЕ_СТОЛБЦЫ, ...ДОП_СТОЛБЦЫ].filter((key, index, array) => keys.has(key) && array.indexOf(key) === index);
}

function findHeaderLike(headers: unknown[], expected?: string): string | undefined {
  if (!expected) return undefined;
  const normalized = normalizeHeaderForCompare(expected);
  if (!normalized) return undefined;
  for (const rawHeader of Array.from(headers || [])) {
    const header = rawHeader == null ? "" : String(rawHeader);
    if (normalizeHeaderForCompare(header) === normalized) {
      return header.trim();
    }
  }
  return undefined;
}

function createAppendMapping(upload: MediaplanUpload | null, target: MediaplanRecord): РазметкаRU {
  const lockedCells = buildLockedCampaignCells(target);
  const columnKeys = deriveAppendColumnKeys(target);
  if (!upload) {
    return {
      ячейки: lockedCells,
      ячейкиRefs: {},
      столбцы: {},
      столбцыRefs: {},
    };
  }

  const autoColumns = autoMapColumnsRU(upload.headers);
  const nextColumns: Partial<Record<КлючСтолбца, string>> = {};

  columnKeys.forEach((key) => {
    const targetLabel =
      target.mapping?.столбцыRefs?.[key]?.label ||
      target.mapping?.столбцы?.[key];
    const matchedHeader = findHeaderLike(upload.headers, targetLabel) || autoColumns[key];
    if (matchedHeader) nextColumns[key] = matchedHeader;
  });

  return {
    ячейки: lockedCells,
    ячейкиRefs: {},
    столбцы: nextColumns,
    столбцыRefs: buildAutoColumnRefs(upload, nextColumns),
  };
}

function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function formatCellValue(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ") || "—";
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  return String(value);
}

function formatScenarioValue(key: keyof PlacementRow, value: PlacementRow[keyof PlacementRow]): string {
  if (!hasValue(value)) return "—";
  if (Array.isArray(value)) return value.filter(Boolean).join(", ") || "—";
  if (key === "format") return value === "video" ? "Видео" : "Баннер";
  if (key === "environment") {
    return {
      web: "Web",
      "in-app": "In-app",
      smart: "Smart TV",
      mixed: "Смешанная",
    }[String(value)] || String(value);
  }
  if (key === "measurement_type") {
    return {
      audit: "Базовый аудит",
      ivt: "IVT + Adserving",
      full_verification: "Full Verification",
      click_only: "Click-аудит",
      audit_viewability: "Аудит + Viewability",
    }[String(value)] || String(value);
  }
  return String(value);
}

type ScenarioColumn = {
  key: keyof PlacementRow;
  label: string;
  always?: boolean;
};

const SCENARIO_COLUMNS: ScenarioColumn[] = [
  { key: "platform_name", label: НАЗВАНИЯ_СТОЛБЦОВ["Название позиции"], always: true },
  { key: "supplier", label: НАЗВАНИЯ_СТОЛБЦОВ["Поставщик"], always: true },
  { key: "placement_type", label: НАЗВАНИЯ_СТОЛБЦОВ["Тип размещения"] },
  { key: "format", label: НАЗВАНИЯ_СТОЛБЦОВ["Формат размещения"], always: true },
  { key: "hosting", label: НАЗВАНИЯ_СТОЛБЦОВ["Хостинг видео"] },
  { key: "environment", label: НАЗВАНИЯ_СТОЛБЦОВ["Среда размещения"], always: true },
  { key: "measurement_type", label: НАЗВАНИЯ_СТОЛБЦОВ["Тип измерения"], always: true },
  { key: "banner_name", label: НАЗВАНИЯ_СТОЛБЦОВ["Название баннера"] },
  { key: "target_url", label: НАЗВАНИЯ_СТОЛБЦОВ["URL баннера"] },
  { key: "code_type", label: НАЗВАНИЯ_СТОЛБЦОВ["Тип кода"] },
  { key: "tracker_site", label: НАЗВАНИЯ_СТОЛБЦОВ["Трекерный сайт"] },
  { key: "vast_version", label: НАЗВАНИЯ_СТОЛБЦОВ["VAST версия"] },
  { key: "delegate_suppliers", label: НАЗВАНИЯ_СТОЛБЦОВ["Делегирование поставщиков"] },
  { key: "time_start", label: НАЗВАНИЯ_СТОЛБЦОВ["Время начала"] },
  { key: "time_end", label: НАЗВАНИЯ_СТОЛБЦОВ["Время окончания"] },
  { key: "auditor_mediascope", label: НАЗВАНИЯ_СТОЛБЦОВ["Mediascope"] },
  { key: "auditor_url", label: НАЗВАНИЯ_СТОЛБЦОВ["URL аудитора"] },
  { key: "auditor_redirect", label: НАЗВАНИЯ_СТОЛБЦОВ["Редирект"] },
  { key: "macro_exss", label: НАЗВАНИЯ_СТОЛБЦОВ["exss"] },
  { key: "macro_erir", label: НАЗВАНИЯ_СТОЛБЦОВ["ЕРИР"] },
  { key: "macro_bundle_id", label: НАЗВАНИЯ_СТОЛБЦОВ["Bundle ID"] },
  { key: "macro_adv_id", label: НАЗВАНИЯ_СТОЛБЦОВ["GAID/IDFA"] },
  { key: "macro_ext_id", label: НАЗВАНИЯ_СТОЛБЦОВ["Внешний ID"] },
  { key: "dyn_impression", label: НАЗВАНИЯ_СТОЛБЦОВ["Дин. параметры показа"] },
  { key: "dyn_click", label: НАЗВАНИЯ_СТОЛБЦОВ["Дин. параметры клика"] },
  { key: "geo", label: НАЗВАНИЯ_СТОЛБЦОВ["Гео"] },
  { key: "audience", label: НАЗВАНИЯ_СТОЛБЦОВ["Целевая аудитория"] },
];

function UploadPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draft") || "";
  const mediaplanId = searchParams.get("mp") || "";
  const targetMediaplanId = searchParams.get("targetMp") || "";
  const isAppendMode = searchParams.get("append") === "1" && Boolean(targetMediaplanId);
  const [isHydrated, setIsHydrated] = useState(false);
  const [upload, setUpload] = useState<MediaplanUpload | null>(null);
  const [mapping, setMapping] = useState<РазметкаRU>({ ячейки: {}, столбцы: {} });
  const [draftNotice, setDraftNotice] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [templatesVersion, setTemplatesVersion] = useState(0);
  const [picker, setPicker] = useState<{
    rowIndex: number;
    colIndex: number;
    address: string;
    x: number;
    y: number;
    headerName?: string;
  } | null>(null);
  const [matchedTemplates, setMatchedTemplates] = useState<ReturnType<typeof findMappingTemplatesByHeaders>>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const targetMediaplan = useMemo(
    () => (isHydrated && isAppendMode ? getMediaplan(targetMediaplanId) : null),
    [isHydrated, isAppendMode, targetMediaplanId]
  );
  const appendAccessDenied = isAppendMode && isHydrated && (
    targetMediaplan?.status !== "кампания создана" || targetMediaplan?.source === "create"
  );
  const appendColumnKeys = useMemo(
    () => (targetMediaplan ? deriveAppendColumnKeys(targetMediaplan) : [...ОБЯЗАТЕЛЬНЫЕ_СТОЛБЦЫ]),
    [targetMediaplan]
  );
  const lockedCampaignFields = useMemo(
    () => (targetMediaplan ? buildLockedCampaignCells(targetMediaplan) : {}),
    [targetMediaplan]
  );
  const appendScenarioRows = useMemo(() => targetMediaplan?.import?.rows ?? [], [targetMediaplan]);
  const appendScenarioColumns = useMemo(
    () =>
      SCENARIO_COLUMNS.filter((column) => {
        if (column.always) return true;
        return appendScenarioRows.some((row) => hasValue(row[column.key]));
      }),
    [appendScenarioRows]
  );
  const appendCampaignFields = useMemo(() => {
    const meta = targetMediaplan?.import?.meta;
    if (!targetMediaplan) return [];
    return [
      { label: "Рекламодатель", value: meta?.advertiser || targetMediaplan.advertiser || "—" },
      { label: "Название РК", value: meta?.campaign_name || targetMediaplan.campaignName || "—" },
      { label: "Агентство", value: meta?.agency || "—" },
      { label: "Бренд", value: meta?.brand || targetMediaplan.brand || "—" },
      { label: "Продукт", value: meta?.product || "—" },
      { label: "Старт РК", value: meta?.date_start || "—" },
      { label: "Окончание РК", value: meta?.date_end || "—" },
    ];
  }, [targetMediaplan]);
  const validation = useMemo(() => {
    const baseValidation = validateMappingRU(mapping, upload || undefined);
    const appendStructureErrors: string[] = [];

    if (isAppendMode && targetMediaplan && upload) {
      const parentHeaders = (targetMediaplan.upload?.headers || [])
        .map((header) => String(header ?? "").trim())
        .filter(Boolean);
      const currentHeaders = (upload.headers || [])
        .map((header) => String(header ?? "").trim())
        .filter(Boolean);

      const normalizedParent = parentHeaders.map(normalizeHeaderForCompare);
      const normalizedCurrent = currentHeaders.map(normalizeHeaderForCompare);

      if (normalizedParent.length) {
        if (normalizedParent.length !== normalizedCurrent.length) {
          appendStructureErrors.push(
            `Структура файла не совпадает с материнским медиапланом: ожидается ${normalizedParent.length} колонок, получено ${normalizedCurrent.length}.`
          );
        } else {
          for (let index = 0; index < normalizedParent.length; index += 1) {
            if (normalizedParent[index] !== normalizedCurrent[index]) {
              appendStructureErrors.push(
                "Структура файла не совпадает с материнским медиапланом. Состав и порядок колонок должны быть такими же, как в исходном медиаплане."
              );
              break;
            }
          }
        }
      }
    }

    return {
      ...baseValidation,
      ready: baseValidation.ready && appendStructureErrors.length === 0,
      errors: [...appendStructureErrors, ...baseValidation.errors],
    };
  }, [isAppendMode, mapping, targetMediaplan, upload]);
  const requiredTotal = isAppendMode
    ? appendColumnKeys.length
    : ОБЯЗАТЕЛЬНЫЕ_ЯЧЕЙКИ.length + ОБЯЗАТЕЛЬНЫЕ_СТОЛБЦЫ.length;
  const requiredReady = isAppendMode
    ? validation.colsOK
    : validation.cellsOK + validation.colsOK;
  const progressPercent = requiredTotal > 0 ? Math.round((requiredReady / requiredTotal) * 100) : 0;
  const currentImport = useMemo(() => (upload ? applyMappingRU(mapping, upload) : null), [mapping, upload]);
  const mediaplanTitle = upload ? resolveMediaplanTitle(upload, currentImport) : "";
  const hasParsedMediaplanTitle = Boolean(currentImport?.meta?.campaign_name?.trim());
  const suggestions = useMemo(
    () => (upload ? suggestColumnsRU(upload.headers) : {}),
    [upload]
  );
  const allCellKeys = useMemo(
    () => (isAppendMode ? [] : [...ОБЯЗАТЕЛЬНЫЕ_ЯЧЕЙКИ, ...ДОП_ЯЧЕЙКИ]),
    [isAppendMode]
  );
  const allColumnKeys = useMemo(
    () => (isAppendMode ? appendColumnKeys : [...ОБЯЗАТЕЛЬНЫЕ_СТОЛБЦЫ, ...ДОП_СТОЛБЦЫ]),
    [appendColumnKeys, isAppendMode]
  );
  const matrixColumnCount = useMemo(() => {
    if (!upload?.matrix?.length) return 0;
    return upload.matrix.reduce((max, row) => Math.max(max, row.length), 0);
  }, [upload]);
  const matrixColumns = useMemo(
    () => Array.from({ length: matrixColumnCount }, (_, index) => index),
    [matrixColumnCount]
  );
  const visibleMatrix = useMemo(() => {
    if (!upload?.matrix?.length) return [];
    const rowsToShow = Math.min(upload.matrix.length, Math.max(upload.headerRow + 40, 60));
    return upload.matrix.slice(0, rowsToShow);
  }, [upload]);
  const assignedCellKeys = useMemo(() => {
    return Object.fromEntries(
      Object.entries(mapping.ячейкиRefs || {})
        .filter(([, ref]) => ref?.address)
        .map(([key, ref]) => [ref.address, key as КлючЯчейки])
    ) as Partial<Record<string, КлючЯчейки>>;
  }, [mapping.ячейкиRefs]);
  const assignedColumnKeys = useMemo(() => {
    return Object.fromEntries(
      Object.entries(mapping.столбцыRefs || {})
        .filter(([, ref]) => ref?.address)
        .map(([key, ref]) => [ref.address, key as КлючСтолбца])
    ) as Partial<Record<string, КлючСтолбца>>;
  }, [mapping.столбцыRefs]);

  useEffect(() => {
    setMatchedTemplates(upload ? findMappingTemplatesByHeaders(upload.headers) : []);
  }, [upload, templatesVersion]);

  useEffect(() => {
    setSelectedTemplateId((current) => (current && matchedTemplates.some((item) => item.id === current) ? current : ""));
  }, [matchedTemplates]);

  useEffect(() => {
    if (isAppendMode && !draftId) {
      setUpload(null);
      setMapping(targetMediaplan ? createAppendMapping(null, targetMediaplan) : { ячейки: {}, столбцы: {} });
      setIsHydrated(true);
      return;
    }
    setUpload(sanitizeUpload(loadUpload()));
    setMapping(loadMappingRU() || { ячейки: {}, столбцы: {} });
    setIsHydrated(true);
  }, [draftId, isAppendMode, targetMediaplan]);

  useEffect(() => {
    if (!isHydrated) return;
    if (mediaplanId) {
      const storedMediaplan = getMediaplan(mediaplanId);
      if (storedMediaplan?.upload) {
        setUpload(sanitizeUpload(storedMediaplan.upload));
        setMapping(storedMediaplan.mapping || { ячейки: {}, столбцы: {} });
        saveUpload(storedMediaplan.upload);
        if (storedMediaplan.mapping) saveMappingRU(storedMediaplan.mapping);
        if (storedMediaplan.import) saveImport(storedMediaplan.import);
      }
      return;
    }
    if (!draftId) return;
    const draft = getDraft(draftId);
    if (!draft?.upload) return;
    setUpload(sanitizeUpload(draft.upload));
    setMapping(draft.mapping || { ячейки: {}, столбцы: {} });
    const linkedMediaplan = findMediaplanByDraftId(draftId);
    saveUpload(draft.upload);
    if (draft.mapping) saveMappingRU(draft.mapping);
    if (draft.import) saveImport(draft.import);
    setDraftNotice(`Открыт черновик «${draft.name}».`);
    if (linkedMediaplan) {
      router.replace(`/mediaplan/upload?mp=${linkedMediaplan.id}&draft=${draftId}`);
    }
  }, [draftId, isHydrated, mediaplanId, router]);

  useEffect(() => {
    if (!isHydrated || !isAppendMode || !targetMediaplan || draftId) return;
    setMapping(createAppendMapping(upload, targetMediaplan));
  }, [draftId, isAppendMode, isHydrated, targetMediaplan, upload]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-mapping-picker]")) {
        setPicker(null);
      }
    }
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  async function handleFile(file: File) {
    const buffer = await file.arrayBuffer();
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith(".csv")) {
      const text = new TextDecoder("utf-8").decode(new Uint8Array(buffer));
      const { matrix, headers, rowsRaw } = parseCsv(text);
      const nextUpload: MediaplanUpload = {
        fileName: file.name,
        sheet: "csv",
        headerRow: 1,
        headers,
        rowsRaw,
        matrix,
        range: { startRow: 0, endRow: Math.max(matrix.length - 1, 0), startCol: 0, endCol: Math.max(headers.length - 1, 0) },
      };
      setUpload(nextUpload);
      saveUpload(nextUpload);
      const nextMapping = isAppendMode && targetMediaplan
        ? createAppendMapping(nextUpload, targetMediaplan)
        : createInitialMapping(nextUpload);
      const nextImport = applyMappingRU(nextMapping, nextUpload);
      const nextTitle = resolveMediaplanTitle(nextUpload, nextImport);
      setMapping(nextMapping);
      const record = upsertUploadMediaplan({
        id: mediaplanId || undefined,
        upload: nextUpload,
        mapping: nextMapping,
        imp: nextImport,
        status: "в очереди",
        title: nextTitle,
      });
      setDraftNotice("");
      setPicker(null);
      if (isAppendMode) {
        router.replace(`/mediaplan/upload?targetMp=${targetMediaplanId}&append=1`);
        return;
      }
      router.replace(`/mediaplan/upload?mp=${record.id}`);
      return;
    }

    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true }) as unknown[][];
    const headerIdx = detectHeaderRow(matrix);
    const headers = sanitizeHeaders(matrix[headerIdx] || []);
    const body = matrix
      .slice(headerIdx + 1)
      .filter((row) => !isBlankSpreadsheetRow(row));
    const rowsRaw = body.map((row) => {
      const out: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        out[header] = row[index];
      });
      return out;
    });

    const nextUpload: MediaplanUpload = {
      fileName: file.name,
      sheet: sheetName,
      headerRow: headerIdx + 1,
      headers,
      rowsRaw,
      matrix,
      range: {
        startRow: 0,
        endRow: Math.max(matrix.length - 1, 0),
        startCol: 0,
        endCol: Math.max(headers.length - 1, 0),
      },
    };
    setUpload(nextUpload);
    saveUpload(nextUpload);
    const nextMapping = isAppendMode && targetMediaplan
      ? createAppendMapping(nextUpload, targetMediaplan)
      : createInitialMapping(nextUpload);
    const nextImport = applyMappingRU(nextMapping, nextUpload);
    const nextTitle = resolveMediaplanTitle(nextUpload, nextImport);
    setMapping(nextMapping);
    const record = upsertUploadMediaplan({
      id: mediaplanId || undefined,
      upload: nextUpload,
      mapping: nextMapping,
      imp: nextImport,
      status: "в очереди",
      title: nextTitle,
    });
    setDraftNotice("");
    setPicker(null);
    if (isAppendMode) {
      router.replace(`/mediaplan/upload?targetMp=${targetMediaplanId}&append=1`);
      return;
    }
    router.replace(`/mediaplan/upload?mp=${record.id}`);
  }

  function assignCellRef(key: КлючЯчейки, rowIndex: number, colIndex: number) {
    if (!upload) return;
    const value = upload.matrix?.[rowIndex]?.[colIndex];
    const nextAddress = getCellAddress(rowIndex, colIndex);
    setMapping((current) => {
      const nextCells = { ...current.ячейки };
      const nextRefs = Object.fromEntries(
        Object.entries(current.ячейкиRefs || {}).filter(([, ref]) => ref?.address !== nextAddress)
      ) as NonNullable<РазметкаRU["ячейкиRefs"]>;
      delete nextCells[key];
      return {
        ...current,
        ячейки: nextCells,
        ячейкиRefs: {
          ...nextRefs,
          [key]: {
            address: nextAddress,
            value: value == null ? undefined : String(value).trim() || undefined,
          },
        },
      };
    });
    setPicker(null);
  }

  function clearCellRef(key: КлючЯчейки) {
    setMapping((current) => {
      const nextCells = { ...current.ячейки };
      const nextRefs = { ...(current.ячейкиRefs || {}) };
      delete nextCells[key];
      delete nextRefs[key];
      return {
        ...current,
        ячейки: nextCells,
        ячейкиRefs: nextRefs,
      };
    });
  }

  function assignColumnRef(key: КлючСтолбца, rowIndex: number, colIndex: number) {
    if (!upload) return;
    const label = getCellText(upload.matrix?.[rowIndex]?.[colIndex]);
    const nextAddress = getCellAddress(rowIndex, colIndex);
    setMapping((current) => {
      const nextColumns = { ...current.столбцы, [key]: label === "—" ? nextAddress : label };
      const nextRefs = Object.fromEntries(
        Object.entries(current.столбцыRefs || {}).filter(([, ref]) => ref?.address !== nextAddress)
      ) as NonNullable<РазметкаRU["столбцыRefs"]>;
      return {
        ...current,
        столбцы: nextColumns,
        столбцыRefs: {
          ...nextRefs,
          [key]: {
            address: nextAddress,
            label: label === "—" ? undefined : label,
            colIndex,
            dataStartRow: rowIndex + 1,
          },
        },
      };
    });
    setPicker(null);
  }

  function clearColumnRef(key: КлючСтолбца) {
    setMapping((current) => {
      const nextColumns = { ...current.столбцы };
      const nextRefs = { ...(current.столбцыRefs || {}) };
      delete nextColumns[key];
      delete nextRefs[key];
      return {
        ...current,
        столбцы: nextColumns,
        столбцыRefs: nextRefs,
      };
    });
  }

  function persistMapping() {
    saveMappingRU(mapping);
    if (!upload || isAppendMode) return;
    const resolvedTitle = resolveMediaplanTitle(upload, currentImport);
    upsertUploadMediaplan({
      id: mediaplanId || undefined,
      upload,
      mapping,
      imp: currentImport,
      draftId: draftId || undefined,
      status: validation.errors.length ? "ошибка" : "в очереди",
      title: resolvedTitle,
    });
  }

  function saveCurrentDraft() {
    if (!upload || !currentImport) return;
    saveMappingRU(mapping);
    saveImport(currentImport);
    const savedDraft = saveUploadDraft({
      id: draftId || undefined,
      upload,
      mapping,
      imp: currentImport,
    });
    if (isAppendMode) {
      setDraftNotice(`Черновик «${savedDraft.name}» сохранён.`);
      router.replace(`/mediaplan/upload?targetMp=${targetMediaplanId}&append=1&draft=${savedDraft.id}`);
      return;
    }
    const record = upsertUploadMediaplan({
      id: mediaplanId || undefined,
      upload,
      mapping,
      imp: currentImport,
      draftId: savedDraft.id,
      status: validation.errors.length > 0 ? "ошибка" : "в очереди",
      title: resolveMediaplanTitle(upload, currentImport),
    });
    setDraftNotice(`Черновик «${savedDraft.name}» сохранён.`);
    router.replace(`/mediaplan/upload?mp=${record.id}&draft=${savedDraft.id}`);
  }

  function saveCurrentTemplate() {
    if (!upload) return;
    const suggestedName = titleFromUploadFile(upload.fileName);
    const templateName = window.prompt("Название шаблона разметки", suggestedName);
    if (!templateName?.trim()) return;
    saveMappingTemplate({
      name: templateName.trim(),
      headersFingerprint: headersFingerprint(upload.headers),
      mapping,
    });
    setTemplatesVersion((value) => value + 1);
  }

  function applySelectedTemplate() {
    if (!upload) return;
    if (!selectedTemplateId) {
      setMapping({ ...createInitialMapping(upload), templateId: undefined });
      setPicker(null);
      return;
    }
    const template = matchedTemplates.find((item) => item.id === selectedTemplateId);
    if (!template) return;
    setMapping(applyMappingTemplate(template, upload.headers));
    setPicker(null);
  }

  function openCellPicker(rowIndex: number, colIndex: number, event: React.MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const pickerWidth = 420;
    const pickerHeight = 640;
    setPicker({
      rowIndex,
      colIndex,
      address: getCellAddress(rowIndex, colIndex),
      x: Math.max(16, Math.min(rect.left + 24, window.innerWidth - pickerWidth - 16)),
      y: Math.max(16, Math.min(rect.top + 24, window.innerHeight - pickerHeight - 16)),
      headerName: upload?.headers[colIndex],
    });
  }

  function createCampaignFromUpload() {
    if (!upload || !currentImport || !validation.ready) return;
    if (appendAccessDenied) return;
    saveMappingRU(mapping);
    saveImport(currentImport);
    if (isAppendMode && targetMediaplanId) {
      const appendedScenarioNames = currentImport.rows.map((row) => row.platform_name || row.banner_name || "").filter(Boolean);
      const record = appendScenariosToMediaplan({
        id: targetMediaplanId,
        scenarioNames: appendedScenarioNames,
        upload,
        mapping,
        imp: currentImport,
      });
      upsertCampaignFromMediaplan(record);
      saveMediaplanScenarioHighlight(record.id, appendedScenarioNames);
      router.push(`/mediaplan/${record.id}?flash=scenarios-added`);
      return;
    }
    const record = upsertUploadMediaplan({
      id: mediaplanId || undefined,
      upload,
      mapping,
      imp: currentImport,
      draftId: draftId || undefined,
      status: "кампания создана",
      title: resolveMediaplanTitle(upload, currentImport),
    });
    upsertCampaignFromMediaplan(record);
    router.push(`/mediaplan?flash=mediaplan-created&created=${record.id}`);
  }

  function clearCurrentUpload() {
    setUpload(null);
    setMapping({ ячейки: {}, столбцы: {} });
    setDraftNotice("");
    setPicker(null);
    clearUpload();
    clearMappingRU();
    clearImport();
    if (isAppendMode && targetMediaplan) {
      setMapping(createAppendMapping(null, targetMediaplan));
    }
    if (isAppendMode) {
      router.replace(`/mediaplan/upload?targetMp=${targetMediaplanId}&append=1`);
      return;
    }
    router.replace("/mediaplan/upload");
  }

  if (appendAccessDenied && targetMediaplan) {
    return (
      <div className="mx-auto max-w-[960px] space-y-5 bg-[#fbfcff] px-3 py-4">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Добавление через Excel недоступно</h2>
              <p className="mt-1 text-sm text-slate-500">
                {targetMediaplan.status !== "кампания создана"
                  ? `Медиаплан «${targetMediaplan.title}» находится в статусе «${targetMediaplan.status}». Добавление сценариев доступно только для медиапланов со статусом «Кампания создана».`
                  : `Медиаплан «${targetMediaplan.title}» был создан через упрощённое создание. Новые сценарии можно добавлять только тем же способом.`}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/mediaplan/${targetMediaplan.id}`}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                К карточке медиаплана
              </Link>
              {targetMediaplan.status === "кампания создана" && (
                <Link
                  href={`/mediaplan/upload/create?targetMp=${targetMediaplan.id}&append=1`}
                  className="rounded-full bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700"
                >
                  Перейти к упрощённому добавлению
                </Link>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-4 py-4 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1920px] space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-3 text-2xl font-medium tracking-tight text-slate-600 sm:text-3xl">
            <PencilRuler className="h-7 w-7 shrink-0 text-slate-500" strokeWidth={1.8} />
            {isAppendMode ? "Добавление сценариев через Excel" : "Разметка медиаплана"}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Загрузите Excel или CSV, проверьте найденные колонки и сопоставьте обязательные объекты прямо в табличном предпросмотре.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
            Файл: <b className="text-slate-800">{upload?.fileName || "не загружен"}</b>
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
            Строки: <b className="text-slate-800">{upload ? upload.rowsRaw.length : "0"}</b>
          </span>
          <span className={`rounded-full border px-3 py-1.5 font-medium ${validation.ready ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
            {requiredReady}/{requiredTotal || 0} · {progressPercent}%
          </span>
        </div>
      </header>

      {isAppendMode && targetMediaplan && (
        <section className="rounded-[24px] border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="font-semibold text-slate-900">Добавление сценариев в существующий медиаплан</div>
              <div>
                {targetMediaplan.title} · {targetMediaplan.id} · {targetMediaplan.status}
              </div>
            </div>
            <div className="relative flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setHelpOpen((value) => !value)}
                className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-sky-50"
              >
                <CircleHelp className="h-4 w-4 text-sky-600" strokeWidth={1.8} />
                Справка
              </button>
              <div className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs text-slate-600">
                Текущий состав: {targetMediaplan.rowsCount || 0} сценариев
              </div>
              {helpOpen && (
                <div className="absolute right-0 top-full z-20 mt-2 w-[420px] max-w-[calc(100vw-32px)] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.16)]">
                  <div className="mb-2 text-sm font-semibold text-slate-900">Как работает добавление сценариев</div>
                  <div className="space-y-3 text-sm leading-6 text-slate-700">
                    <p>
                      Этот экран нужен для догрузки новых сценариев в уже существующий медиаплан. Новый медиаплан при этой операции не создаётся.
                    </p>
                    <p>
                      Вы добавляете только новые строки сценариев. Объекты на всю кампанию, такие как рекламодатель, название РК, бренд и даты, уже зафиксированы в выбранном медиаплане и менять их здесь нельзя.
                    </p>
                    <p>
                      Файл должен содержать тот же состав объектов сценария, что и у медиаплана, в который вы добавляете позиции. Разметка колонок подставляется автоматически по структуре существующего медиаплана.
                    </p>
                    <p>
                      После загрузки новые сценарии будут добавлены к текущему составу медиаплана и отобразятся в его карточке.
                    </p>
                  </div>
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                    Ограничение: если медиаплан был создан через Excel, добавление сценариев выполняется только через Excel.
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {isAppendMode && targetMediaplan && (
        <section className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3">
              <div className="text-sm font-semibold text-slate-900">Объекты на всю кампанию</div>
              <div className="text-xs text-slate-500">Наследуются из существующего медиаплана и не редактируются</div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {appendCampaignFields.map((field) => (
                <div key={field.label} className="grid grid-cols-[150px_minmax(0,1fr)] border-b border-slate-200 last:border-b-0">
                  <div className="border-r border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                    {field.label}
                  </div>
                  <div className="px-3 py-2 text-sm text-slate-800">{formatCellValue(field.value)}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-800">
              При догрузке позиций изменение объектов на всю кампанию не допускается.
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Текущий состав медиаплана</div>
                <div className="text-xs text-slate-500">Существующие сценарии, в которые будут добавлены новые позиции</div>
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                {targetMediaplan.rowsCount || appendScenarioRows.length || targetMediaplan.scenarioNames?.length || 0} сценариев
              </div>
            </div>

            {appendScenarioRows.length ? (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="min-w-[1120px] border-collapse text-sm text-slate-800">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-3 py-3 text-center font-semibold text-slate-700">
                        №
                      </th>
                      {appendScenarioColumns.map((column) => (
                        <th key={column.key} className="border-b border-r border-slate-200 px-4 py-3 text-left font-semibold text-slate-800 last:border-r-0">
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {appendScenarioRows.map((row, index) => (
                      <tr key={`${row.platform_name || "scenario"}-${index}`} className="align-top odd:bg-white even:bg-slate-50/40">
                        <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-inherit px-3 py-3 text-center text-slate-500">
                          {index + 1}
                        </td>
                        {appendScenarioColumns.map((column) => (
                          <td key={`${column.key}-${index}`} className="border-b border-r border-slate-200 px-4 py-3 text-slate-700 last:border-r-0">
                            {formatScenarioValue(column.key, row[column.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : targetMediaplan.scenarioNames?.length ? (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="min-w-[640px] border-collapse text-sm text-slate-800">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="w-16 border-b border-r border-slate-200 bg-slate-50 px-3 py-3 text-center font-semibold text-slate-700">№</th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-800">Название позиции</th>
                    </tr>
                  </thead>
                  <tbody>
                    {targetMediaplan.scenarioNames.map((scenario, index) => (
                      <tr key={`${scenario}-${index}`} className="odd:bg-white even:bg-slate-50/40">
                        <td className="border-b border-r border-slate-200 px-3 py-3 text-center text-slate-500">{index + 1}</td>
                        <td className="border-b border-slate-200 px-4 py-3 text-slate-700">{scenario}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                Состав сценариев для этого медиаплана ещё не отображён.
              </div>
            )}
          </div>
        </section>
      )}

      <section
        className="rounded-2xl border border-slate-100 bg-white p-3"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
      >
        {!isAppendMode && (
          <div className="mb-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-600">Шаблон разметки</div>
              {matchedTemplates.length > 0 && (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  найдено: {matchedTemplates.length}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 sm:min-w-[280px] sm:flex-none"
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
              >
                <option value="">Системный</option>
                {matchedTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={applySelectedTemplate}
                disabled={!upload}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-lg text-sm transition ${
                  upload ? "bg-sky-500 text-white hover:bg-sky-600" : "bg-slate-100 text-slate-400"
                }`}
                title="Применить шаблон"
              >
                <ArrowRight className="h-5 w-5" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={saveCurrentTemplate}
                disabled={!upload}
                className={`inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium transition ${
                  upload ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" : "border border-slate-100 bg-slate-50 text-slate-400"
                }`}
              >
                <Bookmark className="h-4 w-4" strokeWidth={1.8} />
                Сохранить шаблон
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
          {!isAppendMode && (
            <div className="min-w-[260px] flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Название медиаплана
              </label>
              <div
                className={`flex min-h-11 w-full items-center rounded-lg border px-3 text-sm ${
                  hasParsedMediaplanTitle
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                <span className="truncate">
                  {upload ? mediaplanTitle : "Появится после разбора объекта «Название РК»"}
                </span>
              </div>
              <div className="mt-1 text-xs leading-5 text-slate-500">
                Название берётся только из обязательного объекта «Название РК»: из авторазбора файла или из выбранной пользователем ячейки.
              </div>
            </div>
          )}
          <div className="min-w-[260px] flex-1 rounded-lg border border-slate-200 bg-[#fafafa] px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={1.8} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-700">
                  {upload ? upload.fileName : "Файл не выбран"}
                </div>
                <div className="truncate text-xs text-slate-500">
                  {upload
                    ? `${upload.rowsRaw.length} строк · лист «${upload.sheet}» · строка заголовков ${upload.headerRow}`
                    : isAppendMode
                      ? "Загрузите .xlsx, .xls или .csv с такой же структурой"
                      : "Загрузите .xlsx, .xls или .csv"}
                </div>
              </div>
            </div>
          </div>
          <a
            href="/templates/mediaplan_template.xlsx"
            download
            className="inline-flex h-11 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Скачать шаблон
          </a>
          <button
            type="button"
            onClick={clearCurrentUpload}
            disabled={!upload}
            className={`inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium ${
              upload ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50" : "border-slate-100 bg-slate-50 text-slate-400"
            }`}
          >
            <RotateCcw className="h-4 w-4" strokeWidth={1.8} />
            Очистить
          </button>
          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-200">
            <Upload className="h-4 w-4" strokeWidth={1.8} />
            {upload ? "Заменить Excel" : "Загрузить Excel"}
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
              }}
              className="hidden"
            />
          </label>
        </div>
      </section>

        {draftNotice && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700">
            {draftNotice}
          </div>
        )}

      {!isHydrated && <div className="rounded-xl border bg-white p-6 text-sm text-slate-500">Загружаем состояние страницы…</div>}

      {isHydrated && !upload && (
        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-[#fafafa] p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
            <div>
              <h2 className="text-sm font-semibold text-slate-600">Предпросмотр таблицы</h2>
              <p className="mt-1 text-xs text-slate-500">После загрузки здесь появятся строки медиаплана и разметка объектов.</p>
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
              Файл не выбран
            </div>
          </div>
          <div className="relative min-h-[360px] overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[980px] border-collapse text-[15px] text-slate-400">
              <thead>
                <tr>
                  <th className="w-12 border-b border-r border-slate-200 bg-[#fafafa] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">#</th>
                  {["A", "B", "C", "D", "E"].map((column) => (
                    <th key={column} className="border-b border-r border-slate-200 bg-[#fafafa] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide last:border-r-0">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((row) => (
                  <tr key={row}>
                    <th className="border-b border-r border-slate-200 bg-white px-3 py-8 text-left text-xs font-medium text-slate-400">{row}</th>
                    {["", "", "", "", ""].map((_, index) => (
                      <td key={`${row}-${index}`} className="border-b border-r border-slate-200 bg-white px-3 py-8 last:border-r-0" />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="absolute inset-0 flex items-center justify-center bg-white/55 px-4">
              <div className="max-w-md rounded-2xl border border-slate-200 bg-white px-6 py-5 text-center shadow-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <Upload className="h-6 w-6" strokeWidth={1.8} />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-800">Загрузите файл, чтобы начать разметку</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Поддерживаются .xlsx, .xls и .csv. После загрузки появятся столбцы, обязательные поля и кнопка создания рекламной кампании.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {isHydrated && upload && (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-100 bg-[#fafafa] p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                  <div>
                    Файл: <b>{upload.fileName}</b> · Лист: <b>{upload.sheet}</b> · Строка заголовков: <b>{upload.headerRow}</b>
                  </div>
                  <div>
                    {isAppendMode ? (
                      <>
                        Колонки сценариев: <b>{validation.colsOK}/{appendColumnKeys.length}</b>
                      </>
                    ) : (
                      <>
                        Заполнено: ячейки <b>{validation.cellsOK}/{ОБЯЗАТЕЛЬНЫЕ_ЯЧЕЙКИ.length}</b>, столбцы{" "}
                        <b>{validation.colsOK}/{ОБЯЗАТЕЛЬНЫЕ_СТОЛБЦЫ.length}</b>
                      </>
                    )}
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <div className="space-y-1">
                    <div className="font-medium text-slate-900">
                      {isAppendMode ? "Добавление позиций в существующий медиаплан" : "Разметка медиаплана"}
                    </div>
                    <div className="text-slate-600">
                      {isAppendMode
                        ? "Кликните по ячейке заголовка и сопоставьте её с объектом сценария. Кампанийные параметры унаследованы и не редактируются."
                        : "Кликните по ячейке и выберите объект из списка. Для столбцов назначается весь выбранный столбец."}
                    </div>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                    {picker ? `Выбрана ячейка ${picker.address}` : "Выберите ячейку для разметки"}
                  </div>
                </div>

                <div className="relative max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full min-w-max border-collapse text-[15px]">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-20 border-b border-r border-slate-200 bg-[#fafafa] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                          #
                        </th>
                        {matrixColumns.map((colIndex) => (
                          <th
                            key={colIndex}
                            className="border-b border-r border-slate-200 bg-[#fafafa] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                          >
                            {toExcelColumnLabel(colIndex)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleMatrix.map((row, rowIndex) => (
                        <tr
                          key={rowIndex}
                          className={rowIndex === upload.headerRow - 1 ? "bg-sky-50/70" : rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/50"}
                        >
                          <th className="sticky left-0 z-10 border-r border-t border-slate-200 bg-inherit px-3 py-2 text-left text-xs font-medium text-slate-400">
                            {rowIndex + 1}
                          </th>
                          {matrixColumns.map((colIndex) => {
                            const address = getCellAddress(rowIndex, colIndex);
                            const assignedCellKey = assignedCellKeys[address];
                            const assignedColumnKey = assignedColumnKeys[address];
                            const columnRangeKey = Object.entries(mapping.столбцыRefs || {}).find(
                              ([, ref]) => ref?.colIndex === colIndex && rowIndex >= (ref?.dataStartRow ?? Number.MAX_SAFE_INTEGER)
                            )?.[0] as КлючСтолбца | undefined;
                            const displayValue = getCellText(row[colIndex]);

                            return (
                              <td key={address} className="border-t border-r border-slate-200 align-top">
                                <button
                                  type="button"
                                  onClick={(event) => openCellPicker(rowIndex, colIndex, event)}
                                  className={[
                                    "relative flex min-h-[72px] w-56 flex-col items-start justify-start px-3 py-3 text-left transition hover:bg-sky-50/70",
                                    assignedCellKey ? "bg-sky-100/80 ring-1 ring-inset ring-sky-300" : "",
                                    assignedColumnKey ? "bg-emerald-100/90 ring-1 ring-inset ring-emerald-300" : "",
                                    !assignedColumnKey && columnRangeKey ? "bg-emerald-50/60" : "",
                                  ].join(" ")}
                                  title={
                                    [assignedCellKey ? `Ячейка: ${assignedCellKey}` : "", assignedColumnKey ? `Якорь столбца: ${assignedColumnKey}` : "", columnRangeKey ? `Данные столбца: ${columnRangeKey}` : ""]
                                      .filter(Boolean)
                                      .join(" · ") || `${address} · выбрать объект`
                                  }
                                >
                                  <span className="text-[10px] uppercase tracking-[0.14em] text-slate-300">{address}</span>
                                  <div className="mb-1.5 flex flex-wrap gap-1">
                                    {assignedCellKey && (
                                      <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm">
                                        {assignedCellKey}
                                      </span>
                                    )}
                                    {assignedColumnKey && (
                                      <span className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[10px] font-medium text-emerald-700 shadow-sm">
                                        {assignedColumnKey}
                                      </span>
                                    )}
                                    {!assignedColumnKey && columnRangeKey && (
                                      <span className="rounded-full border border-emerald-100 bg-white/80 px-2 py-0.5 text-[10px] font-medium text-emerald-700 shadow-sm">
                                        {columnRangeKey}
                                      </span>
                                    )}
                                  </div>
                                  <span className="line-clamp-3 text-[15px] leading-5 text-slate-600">{displayValue}</span>
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {picker && (
                    <div
                      data-mapping-picker
                      className="fixed z-50 flex max-h-[80vh] w-[420px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.16)]"
                      style={{ left: picker.x, top: picker.y }}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Разметка ячейки</div>
                          <div className="text-base font-semibold text-slate-900">{picker.address}</div>
                          <div className="mt-1 text-xs leading-5 text-slate-500">
                            {upload.matrix?.[picker.rowIndex]?.[picker.colIndex] != null
                              ? String(upload.matrix[picker.rowIndex][picker.colIndex])
                              : "Пустая ячейка"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPicker(null)}
                          className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
                        >
                          Закрыть
                        </button>
                      </div>

                      <div className="space-y-4 overflow-y-auto pr-1">
                        {!isAppendMode && (
                          <div className="min-h-0">
                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Параметры медиаплана</div>
                            <div className="max-h-[34vh] space-y-1 overflow-y-auto pr-1">
                              {allCellKeys.map((key) => (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => assignCellRef(key, picker.rowIndex, picker.colIndex)}
                                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                >
                                  <span>{key}</span>
                                  {mapping.ячейкиRefs?.[key]?.address && (
                                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                                      {mapping.ячейкиRefs[key]?.address}
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="min-h-0">
                          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            {isAppendMode ? "Столбцы сценариев" : "Столбцы позиций"}
                          </div>
                          <div className="max-h-[34vh] space-y-1 overflow-y-auto pr-1">
                            {allColumnKeys.map((key) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => assignColumnRef(key, picker.rowIndex, picker.colIndex)}
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                              >
                                <span>{getColumnDisplayName(key)}</span>
                                {mapping.столбцыRefs?.[key]?.address && (
                                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                    {mapping.столбцыRefs[key]?.address}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {(validation.errors.length > 0 || validation.warnings.length > 0) && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <details className="rounded-2xl border border-rose-100 bg-white p-4" open={validation.errors.length > 0}>
                    <summary className="cursor-pointer text-sm font-medium text-rose-700">
                      Ошибки разметки ({validation.errors.length})
                    </summary>
                    <ul className="mt-3 space-y-2 text-sm text-rose-700">
                      {validation.errors.map((error, index) => (
                        <li key={`${error}-${index}`}>• {error}</li>
                      ))}
                    </ul>
                  </details>

                  <details className="rounded-2xl border border-amber-100 bg-white p-4" open={validation.warnings.length > 0}>
                    <summary className="cursor-pointer text-sm font-medium text-amber-700">
                      Предупреждения ({validation.warnings.length})
                    </summary>
                    <ul className="mt-3 space-y-2 text-sm text-amber-700">
                      {validation.warnings.map((warning, index) => (
                        <li key={`${warning}-${index}`}>• {warning}</li>
                      ))}
                    </ul>
                  </details>
                </div>
              )}
            </div>

            <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
              {isAppendMode ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-slate-500" strokeWidth={1.8} />
                    <h2 className="text-[15px] font-semibold text-slate-700">Объекты на всю кампанию</h2>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(lockedCampaignFields)
                      .filter(([, value]) => String(value || "").trim().length > 0)
                      .map(([key, value]) => (
                        <div key={key} className="grid grid-cols-[150px_minmax(0,1fr)] overflow-hidden rounded-xl border border-slate-200">
                          <div className="bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">{key}</div>
                          <div className="px-3 py-2 text-sm text-slate-800">{value}</div>
                        </div>
                      ))}
                  </div>
                  <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-800">
                    Эти параметры уже заданы в существующем медиаплане и не могут быть изменены при добавлении новых сценариев.
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-slate-500" strokeWidth={1.8} />
                    <h2 className="text-[15px] font-semibold text-slate-700">Параметры медиаплана</h2>
                  </div>
                  <div className="space-y-2.5">
                    {ОБЯЗАТЕЛЬНЫЕ_ЯЧЕЙКИ.map((key) => (
                      <div key={key} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <div>
                          <div className="text-sm font-medium text-slate-800">{key}</div>
                          <div className="mt-1 text-xs leading-5 text-slate-500">
                            {mapping.ячейкиRefs?.[key]?.address
                              ? `${mapping.ячейкиRefs[key]?.address} · ${mapping.ячейкиRefs[key]?.value || "Пустая ячейка"}`
                              : "Не задано"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              mapping.ячейкиRefs?.[key]?.address
                                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                          >
                            {mapping.ячейкиRefs?.[key]?.address ? "готово" : "нужно"}
                          </span>
                          {mapping.ячейкиRefs?.[key]?.address && (
                            <button
                              type="button"
                              onClick={() => clearCellRef(key)}
                              className="rounded-full border border-slate-200 px-2 py-1 text-[10px] text-slate-600 hover:bg-slate-50"
                            >
                              Очистить
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    <details className="pt-2">
                      <summary className="cursor-pointer text-sm font-medium text-slate-700">Дополнительные параметры</summary>
                      <div className="mt-3 space-y-2.5">
                        {ДОП_ЯЧЕЙКИ.map((key) => (
                          <div key={key} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                            <div>
                              <div className="text-sm text-slate-700">{key}</div>
                              <div className="mt-1 text-xs leading-5 text-slate-500">
                                {mapping.ячейкиRefs?.[key]?.address
                                  ? `${mapping.ячейкиRefs[key]?.address} · ${mapping.ячейкиRefs[key]?.value || "Пустая ячейка"}`
                                  : "Не задано"}
                              </div>
                            </div>
                            {mapping.ячейкиRefs?.[key]?.address && (
                              <button
                                type="button"
                                onClick={() => clearCellRef(key)}
                                className="rounded-full border border-slate-200 px-2 py-1 text-[10px] text-slate-600 hover:bg-slate-50"
                              >
                                Очистить
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Bookmark className="h-5 w-5 text-slate-500" strokeWidth={1.8} />
                  <h2 className="text-[15px] font-semibold text-slate-700">
                    {isAppendMode ? "Столбцы сценариев" : "Столбцы позиций"}
                  </h2>
                </div>
                <div className="space-y-2.5">
                  {(isAppendMode ? appendColumnKeys : ОБЯЗАТЕЛЬНЫЕ_СТОЛБЦЫ).map((key) => {
                    const suggestion = suggestions[key];
                    return (
                      <div key={key} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-800">{getColumnDisplayName(key)}</span>
                            {suggestion && !mapping.столбцыRefs?.[key]?.address && !mapping.столбцы[key] && (
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${suggestionTone(suggestion.confidence)}`}>
                                авто: {suggestion.column}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {mapping.столбцыRefs?.[key]?.address
                              ? `${mapping.столбцыRefs[key]?.address} · ниже по столбцу`
                              : mapping.столбцы[key] || "Не задано"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              mapping.столбцыRefs?.[key]?.address || mapping.столбцы[key]
                                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                          >
                            {mapping.столбцыRefs?.[key]?.address || mapping.столбцы[key] ? "готово" : "нужно"}
                          </span>
                          {(mapping.столбцыRefs?.[key]?.address || mapping.столбцы[key]) && (
                            <button
                              type="button"
                              onClick={() => clearColumnRef(key)}
                              className="rounded-full border border-slate-200 px-2 py-1 text-[10px] text-slate-600 hover:bg-slate-50"
                            >
                              Очистить
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {!isAppendMode && (
                    <details className="pt-2">
                      <summary className="cursor-pointer text-sm font-medium text-slate-700">Дополнительные столбцы</summary>
                      <div className="mt-3 space-y-2.5">
                        {ДОП_СТОЛБЦЫ.map((key) => {
                          const suggestion = suggestions[key];
                          return (
                            <div key={key} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-slate-700">{getColumnDisplayName(key)}</span>
                                  {suggestion && !mapping.столбцыRefs?.[key]?.address && !mapping.столбцы[key] && (
                                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${suggestionTone(suggestion.confidence)}`}>
                                      авто: {suggestion.column}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {mapping.столбцыRefs?.[key]?.address
                                    ? `${mapping.столбцыRefs[key]?.address} · ниже по столбцу`
                                    : mapping.столбцы[key] || "Не задано"}
                                </div>
                              </div>
                              {(mapping.столбцыRefs?.[key]?.address || mapping.столбцы[key]) && (
                                <button
                                  type="button"
                                  onClick={() => clearColumnRef(key)}
                                  className="rounded-full border border-slate-200 px-2 py-1 text-[10px] text-slate-600 hover:bg-slate-50"
                                >
                                  Очистить
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4 text-sm text-amber-900">
                <div className="flex items-start gap-3">
                  <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" strokeWidth={1.8} />
                  <div className="leading-6">
                    {isAppendMode
                      ? "Кликните по ячейке заголовка и выберите объект сценария. Кампанийные параметры и набор колонок наследуются от существующего медиаплана."
                      : "Чтобы задать параметр, кликните по ячейке в таблице и выберите нужный объект из списка."}
                  </div>
                </div>
              </div>

              {!validation.ready && (
                <div className="rounded-2xl border border-rose-100 bg-rose-50/90 p-4 text-sm text-rose-800">
                  <div className="flex items-start gap-3">
                    <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" strokeWidth={1.8} />
                    <div className="leading-6">
                      {isAppendMode ? "Не все обязательные колонки сценариев сопоставлены." : "Не заданы обязательные параметры медиаплана."}
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 text-sm font-semibold text-slate-900">3. Завершение</div>
                <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${validation.ready ? "bg-emerald-500" : "bg-sky-500"}`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {!isAppendMode && (
                    <button onClick={persistMapping} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      Сохранить разметку
                    </button>
                  )}
                  <button onClick={saveCurrentDraft} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                    Сохранить в черновики
                  </button>
                  <button
                    disabled={!validation.ready}
                    onClick={createCampaignFromUpload}
                    className={`rounded-2xl px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
                      validation.ready ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {isAppendMode ? "Добавить сценарии в медиаплан" : "Создать рекламную кампанию"}
                  </button>
                </div>
              </div>
            </aside>
          </section>
      )}
      </div>
    </div>
  );
}

export default function UploadPage() {
  return (
    <Suspense fallback={null}>
      <UploadPageContent />
    </Suspense>
  );
}
