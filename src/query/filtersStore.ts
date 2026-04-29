import { create } from "zustand";
import { CATALOG } from "@/data/mockDataset";
import type {
  AdFormat,
  AttributionMode,
  AttributionModel,
  AttributionWindow,
  CookiesMode,
  DatePreset,
  GlobalFiltersState,
  Grain,
  TableDimension,
  VerificationType,
} from "@/query/types";

const EXCLUSIONS_STORAGE_KEY = "adriver/dashboard/exclusions";

type FiltersStore = GlobalFiltersState & {
  initialized: boolean;
  initialCampaignIds: number[];
  hydrateFromUrl: (params: URLSearchParams, campaignIdsFromEntry: number[]) => void;
  setDatePreset: (preset: DatePreset) => void;
  setCustomDateRange: (dateFrom: string, dateTo: string) => void;
  setCompare: (value: boolean) => void;
  setGrain: (value: Grain) => void;
  setAttributionMode: (value: AttributionMode) => void;
  setAttributionModel: (value: AttributionModel) => void;
  setAttributionWindow: (value: AttributionWindow) => void;
  setCampaignIds: (ids: number[]) => void;
  setPlacementIds: (ids: number[]) => void;
  setCreativeIds: (ids: number[]) => void;
  setBrands: (brands: string[]) => void;
  setAdvertisers: (advertisers: string[]) => void;
  setCampaignTags: (campaignTags: string[]) => void;
  setSuppliers: (suppliers: string[]) => void;
  setPlacementEnvironments: (placementEnvironments: string[]) => void;
  setDomains: (domains: string[]) => void;
  setGeos: (geos: string[]) => void;
  setDeviceTypes: (types: string[]) => void;
  setOs: (os: string[]) => void;
  setFormats: (formats: AdFormat[]) => void;
  setCookiesMode: (value: CookiesMode) => void;
  setVerificationType: (value: VerificationType) => void;
  setTableDimension: (value: TableDimension) => void;
  addExcludedDomain: (domain: string) => void;
  removeExcludedDomain: (domain: string) => void;
  resetFilters: () => void;
};

function toDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date();
  return date;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateRangeForPreset(preset: DatePreset, maxDate: string): { from: string; to: string } {
  const to = toDate(maxDate);
  const from = new Date(to);

  if (preset === "today") {
    return { from: formatDate(to), to: formatDate(to) };
  }

  if (preset === "7d") {
    from.setDate(to.getDate() - 6);
    return { from: formatDate(from), to: formatDate(to) };
  }

  if (preset === "30d") {
    from.setDate(to.getDate() - 29);
    return { from: formatDate(from), to: formatDate(to) };
  }

  return { from: CATALOG.dateFrom, to: CATALOG.dateTo };
}

function parseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseNumberArray(raw: string | null): number[] {
  if (!raw) return [];
  const out: number[] = [];
  const seen = new Set<number>();
  raw.split(",").forEach((x) => {
    const n = Number(x.trim());
    if (!Number.isFinite(n) || n <= 0 || seen.has(n)) return;
    seen.add(n);
    out.push(n);
  });
  return out;
}

function sameNumberArray(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function readExclusions(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(EXCLUSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((x) => String(x)).filter(Boolean);
  } catch {
    return [];
  }
}

function writeExclusions(values: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EXCLUSIONS_STORAGE_KEY, JSON.stringify(values));
}

const defaultRange = dateRangeForPreset("7d", CATALOG.dateTo);
const ATTR_MODELS: AttributionModel[] = [
  "last_non_direct_click",
  "last_touch",
  "linear",
];
const ATTR_WINDOWS: AttributionWindow[] = [1, 7, 30, 60, 90];
const COOKIES_MODES: CookiesMode[] = ["all", "with", "without"];
const VERIFICATION_TYPES: VerificationType[] = [
  "all",
  "basic_audit",
  "ivt_adserving",
  "full_verification",
  "click_audit",
];
const TABLE_DIMENSIONS: TableDimension[] = [
  "campaign",
  "placement",
  "supplier",
  "client",
  "advertiser",
  "date",
];

export const useDashboardFiltersStore = create<FiltersStore>((set, get) => ({
  initialized: false,
  initialCampaignIds: [],
  datePreset: "7d",
  dateFrom: defaultRange.from,
  dateTo: defaultRange.to,
  compare: false,
  grain: "day",
  campaignIds: [],
  placementIds: [],
  creativeIds: [],
  brands: [],
  advertisers: [],
  campaignTags: [],
  suppliers: [],
  placementEnvironments: [],
  domains: [],
  geos: [],
  deviceTypes: [],
  os: [],
  formats: [],
  cookiesMode: "all",
  verificationType: "all",
  tableDimension: "campaign",
  attributionMode: "post-view",
  attributionModel: "last_touch",
  attributionWindow: 90,
  exclusionsDomains: [],

  hydrateFromUrl: (params, campaignIdsFromEntry) => {
    const campaignIdsFromUrl = parseNumberArray(params.get("campaignIds"));
    const incomingCampaignIds = campaignIdsFromUrl.length ? campaignIdsFromUrl : campaignIdsFromEntry;

    if (get().initialized) {
      if (!incomingCampaignIds.length) return;
      const state = get();
      if (
        sameNumberArray(state.campaignIds, incomingCampaignIds) &&
        sameNumberArray(state.initialCampaignIds, incomingCampaignIds)
      ) {
        return;
      }
      set({
        campaignIds: incomingCampaignIds,
        initialCampaignIds: incomingCampaignIds,
      });
      return;
    }

    const presetRaw = params.get("preset") as DatePreset | null;
    const preset: DatePreset =
      presetRaw === "today" || presetRaw === "7d" || presetRaw === "30d" || presetRaw === "custom"
        ? presetRaw
        : "7d";

    const presetRange = dateRangeForPreset(preset, CATALOG.dateTo);
    const dateFrom = params.get("from") || presetRange.from;
    const dateTo = params.get("to") || presetRange.to;

    const initialCampaignIds = incomingCampaignIds;

    const grainRaw = params.get("grain");
    const grain: Grain = grainRaw === "hour" ? "hour" : "day";
    const attrRaw = params.get("attr");
    const attributionMode: AttributionMode = attrRaw === "post-click" ? "post-click" : "post-view";
    const modelRaw = params.get("attr_model");
    const normalizedModelRaw =
      modelRaw === "last_click" ? "last_non_direct_click" : modelRaw;
    const attributionModel: AttributionModel = ATTR_MODELS.includes(normalizedModelRaw as AttributionModel)
      ? (normalizedModelRaw as AttributionModel)
      : "last_touch";
    const attributionWindowRaw = Number(params.get("attr_window"));
    const attributionWindow: AttributionWindow = ATTR_WINDOWS.includes(attributionWindowRaw as AttributionWindow)
      ? (attributionWindowRaw as AttributionWindow)
      : 90;
    const cookiesRaw = params.get("cookies");
    const cookiesMode: CookiesMode = COOKIES_MODES.includes(cookiesRaw as CookiesMode)
      ? (cookiesRaw as CookiesMode)
      : "all";
    const verificationRaw = params.get("verificationType");
    const normalizedVerificationRaw =
      verificationRaw === "iab"
        ? "basic_audit"
        : verificationRaw === "ias"
          ? "ivt_adserving"
          : verificationRaw === "moat"
            ? "full_verification"
            : verificationRaw;
    const verificationType: VerificationType = VERIFICATION_TYPES.includes(verificationRaw as VerificationType)
      ? (verificationRaw as VerificationType)
      : VERIFICATION_TYPES.includes(normalizedVerificationRaw as VerificationType)
        ? (normalizedVerificationRaw as VerificationType)
      : "all";
    const dimensionRaw = params.get("tableDimension");
    const tableDimension: TableDimension = TABLE_DIMENSIONS.includes(dimensionRaw as TableDimension)
      ? (dimensionRaw as TableDimension)
      : "campaign";

    set({
      initialized: true,
      initialCampaignIds,
      datePreset: preset,
      dateFrom,
      dateTo,
      compare: params.get("compare") === "1",
      grain,
      campaignIds: initialCampaignIds,
      placementIds: parseNumberArray(params.get("placementIds")),
      creativeIds: parseNumberArray(params.get("creativeIds")),
      brands: parseStringArray(params.get("brands")),
      advertisers: parseStringArray(params.get("advertisers")),
      campaignTags: parseStringArray(params.get("campaignTags")),
      suppliers: parseStringArray(params.get("suppliers")),
      placementEnvironments: parseStringArray(params.get("placementEnvironments")),
      domains: parseStringArray(params.get("domains")),
      geos: parseStringArray(params.get("geos")),
      deviceTypes: parseStringArray(params.get("deviceTypes")),
      os: parseStringArray(params.get("os")),
      formats: parseStringArray(params.get("formats")) as AdFormat[],
      cookiesMode,
      verificationType,
      tableDimension,
      attributionMode,
      attributionModel,
      attributionWindow,
      exclusionsDomains: readExclusions(),
    });
  },

  setDatePreset: (preset) => {
    if (preset === "custom") {
      set({ datePreset: "custom" });
      return;
    }
    const range = dateRangeForPreset(preset, CATALOG.dateTo);
    set({
      datePreset: preset,
      dateFrom: range.from,
      dateTo: range.to,
      grain: preset === "today" ? "hour" : get().grain,
    });
  },

  setCustomDateRange: (dateFrom, dateTo) => {
    set({ datePreset: "custom", dateFrom, dateTo });
  },

  setCompare: (compare) => set({ compare }),
  setGrain: (grain) => set({ grain }),
  setAttributionMode: (attributionMode) => set({ attributionMode }),
  setAttributionModel: (attributionModel) => set({ attributionModel }),
  setAttributionWindow: (attributionWindow) => set({ attributionWindow }),
  setCampaignIds: (campaignIds) => set({ campaignIds }),
  setPlacementIds: (placementIds) => set({ placementIds }),
  setCreativeIds: (creativeIds) => set({ creativeIds }),
  setBrands: (brands) => set({ brands }),
  setAdvertisers: (advertisers) => set({ advertisers }),
  setCampaignTags: (campaignTags) => set({ campaignTags }),
  setSuppliers: (suppliers) => set({ suppliers }),
  setPlacementEnvironments: (placementEnvironments) => set({ placementEnvironments }),
  setDomains: (domains) => set({ domains }),
  setGeos: (geos) => set({ geos }),
  setDeviceTypes: (deviceTypes) => set({ deviceTypes }),
  setOs: (os) => set({ os }),
  setFormats: (formats) => set({ formats }),
  setCookiesMode: (cookiesMode) => set({ cookiesMode }),
  setVerificationType: (verificationType) => set({ verificationType }),
  setTableDimension: (tableDimension) => set({ tableDimension }),

  addExcludedDomain: (domain) => {
    const normalized = domain.trim().toLowerCase();
    if (!normalized) return;
    const next = Array.from(new Set([...get().exclusionsDomains, normalized]));
    writeExclusions(next);
    set({ exclusionsDomains: next });
  },

  removeExcludedDomain: (domain) => {
    const normalized = domain.trim().toLowerCase();
    const next = get().exclusionsDomains.filter((x) => x !== normalized);
    writeExclusions(next);
    set({ exclusionsDomains: next });
  },

  resetFilters: () => {
    const state = get();
    const range = dateRangeForPreset("7d", CATALOG.dateTo);
    set({
      datePreset: "7d",
      dateFrom: range.from,
      dateTo: range.to,
      compare: false,
      grain: "day",
      campaignIds: state.initialCampaignIds,
      placementIds: [],
      creativeIds: [],
      brands: [],
      advertisers: [],
      campaignTags: [],
      suppliers: [],
      placementEnvironments: [],
      domains: [],
      geos: [],
      deviceTypes: [],
      os: [],
      formats: [],
      cookiesMode: "all",
      verificationType: "all",
      tableDimension: "campaign",
      attributionMode: "post-view",
      attributionModel: "last_touch",
      attributionWindow: 90,
    });
  },
}));

export function serializeFiltersToParams(state: GlobalFiltersState): URLSearchParams {
  const params = new URLSearchParams();
  params.set("preset", state.datePreset);
  params.set("from", state.dateFrom);
  params.set("to", state.dateTo);
  if (state.compare) params.set("compare", "1");
  if (state.grain !== "day") params.set("grain", state.grain);
  if (state.campaignIds.length) params.set("campaignIds", state.campaignIds.join(","));
  if (state.placementIds.length) params.set("placementIds", state.placementIds.join(","));
  if (state.creativeIds.length) params.set("creativeIds", state.creativeIds.join(","));
  if (state.brands.length) params.set("brands", state.brands.join(","));
  if (state.advertisers.length) params.set("advertisers", state.advertisers.join(","));
  if (state.campaignTags.length) params.set("campaignTags", state.campaignTags.join(","));
  if (state.suppliers.length) params.set("suppliers", state.suppliers.join(","));
  if (state.placementEnvironments.length) {
    params.set("placementEnvironments", state.placementEnvironments.join(","));
  }
  if (state.domains.length) params.set("domains", state.domains.join(","));
  if (state.geos.length) params.set("geos", state.geos.join(","));
  if (state.deviceTypes.length) params.set("deviceTypes", state.deviceTypes.join(","));
  if (state.os.length) params.set("os", state.os.join(","));
  if (state.formats.length) params.set("formats", state.formats.join(","));
  if (state.cookiesMode !== "all") params.set("cookies", state.cookiesMode);
  if (state.verificationType !== "all") params.set("verificationType", state.verificationType);
  if (state.tableDimension !== "campaign") params.set("tableDimension", state.tableDimension);
  params.set("attr", state.attributionMode);
  params.set("attr_model", state.attributionModel);
  if (state.attributionWindow !== 90) params.set("attr_window", String(state.attributionWindow));
  return params;
}

export function daysBetweenInclusive(dateFrom: string, dateTo: string): number {
  const from = toDate(dateFrom);
  const to = toDate(dateTo);
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (24 * 3600 * 1000)) + 1;
}
