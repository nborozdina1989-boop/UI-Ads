export const METRICS = [
  "impressions",
  "validImpressions",
  "cookieImpressions",
  "measurableIab",
  "viewableImpressions",
  "viewabilityRate",
  "clicks",
  "validClicks",
  "cookieClicks",
  "ivtClicks",
  "givtClicks",
  "sivtClicks",
  "ivtClickRate",
  "givtClickRate",
  "sivtClickRate",
  "ctr",
  "reach",
  "frequency",
  "spend",
  "cpm",
  "cpr",
  "cpc",
  "cpa",
  "ivtRate",
  "givtRate",
  "sivtRate",
  "givtImpressions",
  "sivtImpressions",
  "brandSafetyRate",
  "vastStart",
  "vastQ1",
  "vastMid",
  "vastQ3",
  "vastComplete",
  "postViewConv",
  "postClickConv",
  "associatedConversions",
  "overlapConv",
  "totalConversions",
  "incrementalConversions",
  "vcr100",
] as const;

export type Metric = (typeof METRICS)[number];

export const DIMENSIONS = [
  "date",
  "hour",
  "campaignId",
  "campaignName",
  "placementId",
  "placementName",
  "creativeId",
  "creativeName",
  "supplier",
  "placementEnvironment",
  "client",
  "advertiser",
  "domain",
  "geo",
  "deviceType",
  "os",
  "format",
  "cookiesFlag",
  "verificationType",
] as const;

export type Dimension = (typeof DIMENSIONS)[number];

export type Grain = "day" | "hour";
export type AttributionMode = "post-view" | "post-click";
export type AttributionWindow = 1 | 7 | 30 | 60 | 90;
export type AttributionModel =
  | "last_non_direct_click"
  | "last_touch"
  | "linear";

export type AdFormat = "display" | "video" | "native" | "audio";
export type CookiesMode = "all" | "with" | "without";
export type VerificationType =
  | "all"
  | "basic_audit"
  | "ivt_adserving"
  | "full_verification"
  | "click_audit";
export type TableDimension = "campaign" | "placement" | "supplier" | "client" | "advertiser" | "date";

export type Filters = {
  dateFrom: string;
  dateTo: string;
  campaignIds: number[];
  placementIds: number[];
  creativeIds: number[];
  brands: string[];
  advertisers: string[];
  suppliers: string[];
  placementEnvironments: string[];
  domains: string[];
  geos: string[];
  deviceTypes: string[];
  os: string[];
  formats: AdFormat[];
  cookiesMode: CookiesMode;
  verificationType: VerificationType;
  tableDimension: TableDimension;
  grain: Grain;
  attributionMode: AttributionMode;
  attributionModel: AttributionModel;
  attributionWindow: AttributionWindow;
  exclusionsDomains: string[];
};

export type QuerySort = { field: string; dir: "asc" | "desc" };

export type Query = {
  metrics: Metric[];
  dimensions: Dimension[];
  filters: Filters;
  sort?: QuerySort[];
  limit?: number;
  offset?: number;
};

export type QueryResponse = {
  rows: Record<string, unknown>[];
  meta: {
    sampled: boolean;
    freshnessSeconds: number;
    totalRows?: number;
  };
};

export type DatasetRow = {
  date: string;
  hour: number;
  campaignId: number;
  campaignName: string;
  placementId: number;
  placementName: string;
  creativeId: number;
  creativeName: string;
  brand: string;
  supplier: string;
  placementEnvironment: string;
  client: string;
  advertiser: string;
  domain: string;
  geo: string;
  deviceType: string;
  os: string;
  format: AdFormat;
  cookiesFlag: boolean;
  verificationType: Exclude<VerificationType, "all">;
  impressions: number;
  validImpressions: number;
  viewableImpressions: number;
  viewabilityRate: number;
  clicks: number;
  validClicks: number;
  ivtClicks: number;
  givtClicks: number;
  sivtClicks: number;
  ivtClickRate: number;
  givtClickRate: number;
  sivtClickRate: number;
  reach: number;
  spend: number;
  ivtRate: number;
  givtRate: number;
  sivtRate: number;
  givtImpressions: number;
  sivtImpressions: number;
  brandSafetyRate: number;
  vastStart: number;
  vastQ1: number;
  vastMid: number;
  vastQ3: number;
  vastComplete: number;
  postViewConv: number;
  postClickConv: number;
  overlapConv: number;
  totalConversions: number;
  incrementalShare: number;
  incrementalConversions: number;
};

export type DatePreset = "today" | "7d" | "30d" | "custom";

export type DashboardSection =
  | "overview"
  | "performance"
  | "verification"
  | "video"
  | "conversions"
  | "exports"
  | "help";

export type GlobalFiltersState = {
  datePreset: DatePreset;
  dateFrom: string;
  dateTo: string;
  compare: boolean;
  grain: Grain;
  campaignIds: number[];
  placementIds: number[];
  creativeIds: number[];
  brands: string[];
  advertisers: string[];
  campaignTags: string[];
  suppliers: string[];
  placementEnvironments: string[];
  domains: string[];
  geos: string[];
  deviceTypes: string[];
  os: string[];
  formats: AdFormat[];
  cookiesMode: CookiesMode;
  verificationType: VerificationType;
  tableDimension: TableDimension;
  attributionMode: AttributionMode;
  attributionModel: AttributionModel;
  attributionWindow: AttributionWindow;
  exclusionsDomains: string[];
};
