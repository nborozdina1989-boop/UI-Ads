import type { DatasetRow, Filters } from "@/query/types";

export type BudgetTemplateRow = {
  campaign_id: number;
  campaign_name: string;
  placement_id: number;
  placement_name: string;
  planned_budget: string;
};

export type ParsedBudgetRow = {
  campaignId: number;
  campaignName: string;
  placementId: number;
  placementName: string;
  plannedBudget: number;
};

export type BudgetParseError = {
  placementId: string;
  reason: string;
};

export type BudgetKpis = {
  plannedBudget: number;
  budgetCoverageRatio: number;
  coveredPlacements: number;
  totalPlacements: number;
  budgetVsSpend: number;
  budgetVsSpendPct: number | null;
  spend: number;
};

type PlacementScopeRow = {
  placementId: number;
  placementName: string;
  campaignId: number;
  campaignName: string;
};

function includesIfFiltered<T>(value: T, selected: T[]): boolean {
  if (!selected.length) return true;
  return selected.includes(value);
}

function matchesFilters(row: DatasetRow, filters: Filters): boolean {
  if (filters.dateFrom && row.date < filters.dateFrom) return false;
  if (filters.dateTo && row.date > filters.dateTo) return false;
  if (!includesIfFiltered(row.campaignId, filters.campaignIds)) return false;
  if (!includesIfFiltered(row.placementId, filters.placementIds)) return false;
  if (!includesIfFiltered(row.creativeId, filters.creativeIds)) return false;
  if (!includesIfFiltered(row.brand, filters.brands)) return false;
  if (!includesIfFiltered(row.advertiser, filters.advertisers)) return false;
  if (!includesIfFiltered(row.supplier, filters.suppliers)) return false;
  if (!includesIfFiltered(row.placementEnvironment, filters.placementEnvironments)) return false;
  if (!includesIfFiltered(row.domain, filters.domains)) return false;
  if (!includesIfFiltered(row.geo, filters.geos)) return false;
  if (!includesIfFiltered(row.deviceType, filters.deviceTypes)) return false;
  if (!includesIfFiltered(row.os, filters.os)) return false;
  if (!includesIfFiltered(row.format, filters.formats)) return false;
  if (filters.cookiesMode === "with" && !row.cookiesFlag) return false;
  if (filters.cookiesMode === "without" && row.cookiesFlag) return false;
  if (filters.verificationType !== "all" && row.verificationType !== filters.verificationType) return false;
  if (filters.exclusionsDomains.includes(row.domain)) return false;
  return true;
}

function parseBudgetNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value).replaceAll(" ", "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function getBudgetPlacementScope(filters: Filters, dataset: DatasetRow[]): PlacementScopeRow[] {
  const map = new Map<number, PlacementScopeRow>();
  for (const row of dataset) {
    if (!matchesFilters(row, filters)) continue;
    if (!map.has(row.placementId)) {
      map.set(row.placementId, {
        placementId: row.placementId,
        placementName: row.placementName,
        campaignId: row.campaignId,
        campaignName: row.campaignName,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.campaignName !== b.campaignName) return a.campaignName.localeCompare(b.campaignName, "ru");
    return a.placementName.localeCompare(b.placementName, "ru");
  });
}

export async function exportBudgetsTemplate(filters: Filters, dataset: DatasetRow[]): Promise<{
  downloaded: boolean;
  fileName: string | null;
  rowCount: number;
}> {
  if (!filters.campaignIds.length) {
    return { downloaded: false, fileName: null, rowCount: 0 };
  }

  const selectedCampaignIds = new Set(filters.campaignIds);
  const map = new Map<number, PlacementScopeRow>();
  for (const row of dataset) {
    if (!selectedCampaignIds.has(row.campaignId)) continue;
    if (!map.has(row.placementId)) {
      map.set(row.placementId, {
        placementId: row.placementId,
        placementName: row.placementName,
        campaignId: row.campaignId,
        campaignName: row.campaignName,
      });
    }
  }

  const rows: BudgetTemplateRow[] = Array.from(map.values())
    .sort((a, b) => {
      if (a.campaignName !== b.campaignName) return a.campaignName.localeCompare(b.campaignName, "ru");
      return a.placementName.localeCompare(b.placementName, "ru");
    })
    .map((item) => ({
      campaign_id: item.campaignId,
      campaign_name: item.campaignName,
      placement_id: item.placementId,
      placement_name: item.placementName,
      planned_budget: "",
    }));

  const xlsx = await import("xlsx");
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(rows, {
    header: ["campaign_id", "campaign_name", "placement_id", "placement_name", "planned_budget"],
  });
  xlsx.utils.book_append_sheet(wb, ws, "Budgets");

  const ids = filters.campaignIds.join("-");
  const fileName = `budgets_${filters.dateFrom}_${filters.dateTo}_campaigns_${ids}.xlsx`;
  xlsx.writeFile(wb, fileName);

  return { downloaded: true, fileName, rowCount: rows.length };
}

export async function parseBudgetsXlsx(file: File): Promise<{
  rows: ParsedBudgetRow[];
  errors: BudgetParseError[];
}> {
  const required = ["campaign_id", "campaign_name", "placement_id", "placement_name", "planned_budget"];

  const xlsx = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = xlsx.read(buffer, { type: "array" });
  const sheet = workbook.Sheets.Budgets ?? workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    return { rows: [], errors: [{ placementId: "—", reason: "Лист Budgets не найден" }] };
  }

  const headerRows = xlsx.utils.sheet_to_json<Array<unknown>>(sheet, { header: 1, blankrows: false });
  const headers = (headerRows[0] ?? []).map((x) => String(x).trim());
  const missing = required.filter((col) => !headers.includes(col));
  if (missing.length) {
    return {
      rows: [],
      errors: missing.map((col) => ({
        placementId: "—",
        reason: `Отсутствует обязательная колонка: ${col}`,
      })),
    };
  }

  const jsonRows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const rows: ParsedBudgetRow[] = [];
  const errors: BudgetParseError[] = [];
  const seenPlacementIds = new Set<number>();

  jsonRows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const campaignId = Number(row.campaign_id);
    const campaignName = String(row.campaign_name ?? "").trim();
    const placementId = Number(row.placement_id);
    const placementName = String(row.placement_name ?? "").trim();
    const plannedBudget = parseBudgetNumber(row.planned_budget);

    if (!Number.isFinite(campaignId) || campaignId <= 0) {
      errors.push({ placementId: String(row.placement_id ?? "—"), reason: `Строка ${rowNum}: campaign_id некорректен` });
      return;
    }
    if (!Number.isFinite(placementId) || placementId <= 0) {
      errors.push({ placementId: String(row.placement_id ?? "—"), reason: `Строка ${rowNum}: placement_id некорректен` });
      return;
    }
    if (plannedBudget === null || plannedBudget < 0) {
      errors.push({ placementId: String(placementId), reason: `Строка ${rowNum}: planned_budget должен быть числом >= 0` });
      return;
    }
    if (seenPlacementIds.has(placementId)) {
      errors.push({ placementId: String(placementId), reason: `Строка ${rowNum}: дубликат placement_id` });
      return;
    }
    seenPlacementIds.add(placementId);

    rows.push({
      campaignId,
      campaignName,
      placementId,
      placementName,
      plannedBudget,
    });
  });

  return { rows, errors };
}

export function computeBudgetKpis(
  filters: Filters,
  dataset: DatasetRow[],
  budgetsByPlacementId: Record<string, number>
): BudgetKpis {
  const placementScope = getBudgetPlacementScope(filters, dataset);
  const placements = placementScope.map((item) => item.placementId);

  let spend = 0;
  for (const row of dataset) {
    if (!matchesFilters(row, filters)) continue;
    spend += row.spend;
  }

  let plannedBudget = 0;
  let coveredPlacements = 0;
  placements.forEach((placementId) => {
    const value = budgetsByPlacementId[String(placementId)];
    if (Number.isFinite(value) && value >= 0) {
      coveredPlacements += 1;
      plannedBudget += value;
    }
  });

  const totalPlacements = placementScope.length;
  const budgetCoverageRatio = totalPlacements > 0 ? coveredPlacements / totalPlacements : 0;
  const budgetVsSpend = plannedBudget - spend;
  const budgetVsSpendPct = plannedBudget > 0 ? budgetVsSpend / plannedBudget : null;

  return {
    plannedBudget,
    budgetCoverageRatio,
    coveredPlacements,
    totalPlacements,
    budgetVsSpend,
    budgetVsSpendPct,
    spend,
  };
}
