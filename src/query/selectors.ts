import { query } from "@/query/engine";
import type {
  AdFormat,
  Dimension,
  Filters,
  GlobalFiltersState,
  Grain,
  Metric,
  QuerySort,
  TableDimension,
} from "@/query/types";

export type PerformanceLevel = TableDimension;

function withFormats(filters: Filters, formats: AdFormat[]): Filters {
  return {
    ...filters,
    formats,
  };
}

function withVideo(filters: Filters): Filters {
  return withFormats(filters, ["video"]);
}

export function toQueryFilters(state: GlobalFiltersState): Filters {
  return {
    dateFrom: state.dateFrom,
    dateTo: state.dateTo,
    campaignIds: state.campaignIds,
    placementIds: state.placementIds,
    creativeIds: state.creativeIds,
    brands: state.brands,
    advertisers: state.advertisers,
    suppliers: state.suppliers,
    placementEnvironments: state.placementEnvironments,
    domains: state.domains,
    geos: state.geos,
    deviceTypes: state.deviceTypes,
    os: state.os,
    formats: state.formats,
    cookiesMode: state.cookiesMode,
    verificationType: state.verificationType,
    tableDimension: state.tableDimension,
    grain: state.grain,
    attributionMode: state.attributionMode,
    attributionModel: state.attributionModel,
    attributionWindow: state.attributionWindow,
    exclusionsDomains: state.exclusionsDomains,
  };
}

function timeDimensions(grain: Grain): Dimension[] {
  return grain === "hour" ? ["date", "hour"] : ["date"];
}

export function selectOverviewGeneralKpis(filters: Filters) {
  return query({
    filters,
    dimensions: [],
    metrics: [
      "impressions",
      "validImpressions",
      "cookieImpressions",
      "measurableIab",
      "viewableImpressions",
      "viewabilityRate",
      "reach",
      "frequency",
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
      "spend",
      "cpm",
      "cpr",
      "cpc",
      "cpa",
      "ivtRate",
      "brandSafetyRate",
      "postViewConv",
      "postClickConv",
      "associatedConversions",
      "totalConversions",
      "incrementalConversions",
    ],
  });
}

export function selectOverviewKpis(filters: Filters, prevFilters?: Filters) {
  return {
    current: selectOverviewGeneralKpis(filters),
    prev: prevFilters ? selectOverviewGeneralKpis(prevFilters) : null,
  };
}

export function selectOverviewVideoKpis(filters: Filters) {
  return query({
    filters: withVideo(filters),
    dimensions: [],
    metrics: ["impressions", "spend", "cpm", "vastStart", "vcr100", "vastComplete", "vastQ1", "vastMid", "vastQ3"],
  });
}

export function selectVideoAvailability(filters: Filters) {
  return query({
    filters,
    dimensions: ["format"],
    metrics: ["impressions", "vastStart"],
  });
}

export function selectSeries(filters: Filters, metric: Metric) {
  return query({
    filters,
    dimensions: timeDimensions(filters.grain),
    metrics: [metric],
    sort: [
      { field: "date", dir: "asc" },
      { field: "hour", dir: "asc" },
    ],
  });
}

export function selectSeriesBreakdown(filters: Filters, metric: Metric, breakdownDimensions: Dimension[]) {
  return query({
    filters,
    dimensions: [...timeDimensions(filters.grain), ...breakdownDimensions],
    metrics: [metric],
    sort: [
      { field: "date", dir: "asc" },
      { field: "hour", dir: "asc" },
    ],
  });
}

export function selectSpendTimeseries(filters: Filters) {
  return query({
    filters,
    dimensions: timeDimensions(filters.grain),
    metrics: ["spend"],
    sort: [
      { field: "date", dir: "asc" },
      { field: "hour", dir: "asc" },
    ],
  });
}

export function selectConversionsTimeseries(filters: Filters) {
  return query({
    filters,
    dimensions: timeDimensions(filters.grain),
    metrics: ["postViewConv", "postClickConv", "totalConversions", "incrementalConversions"],
    sort: [
      { field: "date", dir: "asc" },
      { field: "hour", dir: "asc" },
    ],
  });
}

export function selectVideoTimeseries(filters: Filters) {
  return query({
    filters: withVideo(filters),
    dimensions: timeDimensions(filters.grain),
    metrics: ["impressions", "spend", "cpm", "vastStart", "vastComplete", "vcr100"],
    sort: [
      { field: "date", dir: "asc" },
      { field: "hour", dir: "asc" },
    ],
  });
}

export function selectOverviewTopDomains(filters: Filters) {
  return query({
    filters,
    dimensions: ["domain"],
    metrics: [
      "impressions",
      "validImpressions",
      "viewableImpressions",
      "viewabilityRate",
      "reach",
      "clicks",
      "validClicks",
      "ivtClicks",
      "givtClicks",
      "sivtClicks",
      "ivtClickRate",
      "givtClickRate",
      "sivtClickRate",
      "ctr",
      "ivtRate",
      "givtRate",
      "sivtRate",
      "brandSafetyRate",
    ],
    sort: [{ field: "impressions", dir: "desc" }],
    limit: 20,
  });
}

export function selectOverviewTopGeos(filters: Filters) {
  return query({
    filters,
    dimensions: ["geo"],
    metrics: ["impressions", "reach", "clicks", "ctr"],
    sort: [{ field: "impressions", dir: "desc" }],
    limit: 20,
  });
}

export function selectOverviewCampaignExport(filters: Filters) {
  return query({
    filters,
    dimensions: ["campaignId", "campaignName"],
    metrics: [
      "impressions",
      "validImpressions",
      "cookieImpressions",
      "reach",
      "frequency",
      "clicks",
      "validClicks",
      "cookieClicks",
      "ctr",
      "ivtClicks",
      "ivtClickRate",
      "ivtRate",
      "measurableIab",
      "viewableImpressions",
      "viewabilityRate",
      "brandSafetyRate",
      "vastStart",
      "vcr100",
      "postViewConv",
      "postClickConv",
      "associatedConversions",
      "totalConversions",
      "incrementalConversions",
      "spend",
      "cpm",
      "cpc",
      "cpa",
    ],
    sort: [
      { field: "campaignName", dir: "asc" },
      { field: "campaignId", dir: "asc" },
    ],
  });
}

function levelDimensions(level: PerformanceLevel): Dimension[] {
  if (level === "campaign") return ["campaignId", "campaignName"];
  if (level === "placement") return ["campaignId", "campaignName", "placementId", "placementName"];
  if (level === "supplier") return ["supplier"];
  if (level === "client") return ["client"];
  if (level === "advertiser") return ["advertiser"];
  return ["date"];
}

export function selectPerformanceRows(params: {
  filters: Filters;
  level: PerformanceLevel;
  sort?: QuerySort[];
  limit?: number;
  offset?: number;
}) {
  const { filters, level, sort, limit, offset } = params;
  return query({
    filters,
    dimensions: levelDimensions(level),
    metrics: [
      "impressions",
      "validImpressions",
      "viewableImpressions",
      "viewabilityRate",
      "reach",
      "frequency",
      "clicks",
      "validClicks",
      "ivtClicks",
      "givtClicks",
      "sivtClicks",
      "ivtClickRate",
      "givtClickRate",
      "sivtClickRate",
      "ctr",
      "ivtRate",
      "givtRate",
      "sivtRate",
      "spend",
      "cpm",
      "cpr",
      "cpc",
      "cpa",
      "vcr100",
      "postViewConv",
      "postClickConv",
      "totalConversions",
      "incrementalConversions",
    ],
    sort,
    limit,
    offset,
  });
}

export const selectPerformanceTable = selectPerformanceRows;

export function selectVerificationKpis(filters: Filters) {
  return query({
    filters,
    dimensions: [],
    metrics: [
      "ivtRate",
      "givtRate",
      "sivtRate",
      "givtImpressions",
      "sivtImpressions",
      "validImpressions",
      "validClicks",
      "viewableImpressions",
      "viewabilityRate",
      "ivtClicks",
      "givtClicks",
      "sivtClicks",
      "ivtClickRate",
      "givtClickRate",
      "sivtClickRate",
      "brandSafetyRate",
      "impressions",
      "clicks",
    ],
  });
}

export function selectWorstDomainsByIvt(filters: Filters) {
  return query({
    filters,
    dimensions: ["domain"],
    metrics: [
      "impressions",
      "validImpressions",
      "viewableImpressions",
      "viewabilityRate",
      "clicks",
      "validClicks",
      "ivtClicks",
      "givtClicks",
      "sivtClicks",
      "ivtClickRate",
      "givtClickRate",
      "sivtClickRate",
      "ivtRate",
      "givtRate",
      "sivtRate",
      "brandSafetyRate",
    ],
    sort: [{ field: "ivtRate", dir: "desc" }],
    limit: 20,
  });
}

export const selectWorstDomains = selectWorstDomainsByIvt;

export function selectVerificationBenchmarks(filters: Filters, dimension: "deviceType" | "os") {
  return query({
    filters,
    dimensions: [dimension],
    metrics: ["ivtRate", "givtRate", "sivtRate", "viewabilityRate", "impressions"],
    sort: [{ field: "ivtRate", dir: "desc" }],
  });
}

export function selectVerificationTimeseries(filters: Filters) {
  return query({
    filters,
    dimensions: timeDimensions(filters.grain),
    metrics: ["ivtRate", "givtRate", "sivtRate"],
    sort: [
      { field: "date", dir: "asc" },
      { field: "hour", dir: "asc" },
    ],
  });
}

export function selectVerificationByDevice(filters: Filters) {
  return query({
    filters,
    dimensions: ["deviceType"],
    metrics: ["ivtRate", "givtRate", "sivtRate", "viewabilityRate", "impressions"],
    sort: [{ field: "impressions", dir: "desc" }],
  });
}

export function selectMonitoringRows(
  filters: Filters,
  rowDimension: "campaign" | "placement" | "supplier" = "campaign"
) {
  const dimensions: Dimension[] =
    rowDimension === "placement"
      ? ["placementId", "placementName", "campaignName", "deviceType", "format"]
      : rowDimension === "supplier"
        ? ["supplier", "deviceType", "format"]
        : ["campaignId", "campaignName", "deviceType", "format"];

  return query({
    filters,
    dimensions,
    metrics: ["impressions", "givtRate", "sivtRate", "viewabilityRate"],
    sort: [
      {
        field: rowDimension === "placement" ? "placementName" : rowDimension === "supplier" ? "supplier" : "campaignName",
        dir: "asc",
      },
    ],
    limit: 5000,
  });
}

export function selectVideoFunnel(filters: Filters) {
  return query({
    filters: withVideo(filters),
    dimensions: [],
    metrics: ["vastStart", "vastQ1", "vastMid", "vastQ3", "vastComplete", "vcr100"],
  });
}

export function selectVideoTable(filters: Filters) {
  return query({
    filters: withVideo(filters),
    dimensions: ["campaignId", "campaignName"],
    metrics: ["vastStart", "vastComplete", "vcr100"],
    sort: [{ field: "vastStart", dir: "desc" }],
    limit: 20,
  });
}

export function selectConversionsSeries(filters: Filters) {
  return query({
    filters,
    dimensions: timeDimensions(filters.grain),
    metrics: ["totalConversions", "postViewConv", "postClickConv", "incrementalConversions", "spend", "cpa"],
    sort: [
      { field: "date", dir: "asc" },
      { field: "hour", dir: "asc" },
    ],
  });
}

export function selectConversionsByCampaign(filters: Filters) {
  return query({
    filters,
    dimensions: ["campaignId", "campaignName"],
    metrics: [
      "postViewConv",
      "postClickConv",
      "totalConversions",
      "incrementalConversions",
      "spend",
      "cpa",
    ],
    sort: [{ field: "totalConversions", dir: "desc" }],
    limit: 30,
  });
}

export const selectConversionsTable = selectConversionsByCampaign;

export function aggregateByDimension(filters: Filters, dimension: Dimension) {
  return query({
    filters,
    dimensions: [dimension],
    metrics: [
      "impressions",
      "validImpressions",
      "clicks",
      "validClicks",
      "viewabilityRate",
      "ivtRate",
      "givtRate",
      "sivtRate",
    ],
  });
}

export function buildTimeseries(filters: Filters, grain: Grain, metric: Metric) {
  return query({
    filters: { ...filters, grain },
    dimensions: grain === "hour" ? ["date", "hour"] : ["date"],
    metrics: [metric],
    sort: [
      { field: "date", dir: "asc" },
      { field: "hour", dir: "asc" },
    ],
  });
}

export function computeBenchmarkedCells(
  value: number,
  benchmark: number,
  mode: "higher-is-worse" | "lower-is-worse"
) {
  const delta = value - benchmark;
  const isWarning = mode === "higher-is-worse" ? value > benchmark : value < benchmark;
  return {
    value,
    benchmark,
    delta,
    isWarning,
  };
}

export function selectAudienceFrequencyDistribution(filters: Filters) {
  const res = query({
    filters,
    dimensions: ["campaignId"],
    metrics: ["impressions", "reach", "frequency"],
  });

  const buckets = {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
    "6-10": 0,
    "11-20": 0,
    "20+": 0,
  };

  res.rows.forEach((row) => {
    const reach = Number(row.reach ?? 0);
    const frequency = Number(row.frequency ?? 0);
    if (!reach) return;

    if (frequency <= 1.5) buckets["1"] += reach;
    else if (frequency <= 2.5) buckets["2"] += reach;
    else if (frequency <= 3.5) buckets["3"] += reach;
    else if (frequency <= 4.5) buckets["4"] += reach;
    else if (frequency <= 5.5) buckets["5"] += reach;
    else if (frequency <= 10.5) buckets["6-10"] += reach;
    else if (frequency <= 20.5) buckets["11-20"] += reach;
    else buckets["20+"] += reach;
  });

  const totalReach = Object.values(buckets).reduce((sum, value) => sum + value, 0);

  return Object.entries(buckets).map(([bucket, reach]) => ({
    bucket,
    reach,
    reachShare: totalReach > 0 ? reach / totalReach : 0,
  }));
}
