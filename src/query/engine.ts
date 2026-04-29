import { MOCK_DATASET } from "@/data/mockDataset";
import type {
  AttributionModel,
  AdFormat,
  DatasetRow,
  Dimension,
  Filters,
  Metric,
  Query,
  QueryResponse,
} from "@/query/types";

function safeDiv(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return numerator / denominator;
}

const QUERY_CACHE_LIMIT = 200;
const queryCache = new Map<string, QueryResponse>();

function makeQueryCacheKey(q: Query): string {
  return JSON.stringify(q);
}

function cloneQueryResponse(response: QueryResponse): QueryResponse {
  return {
    rows: response.rows.map((row) => ({ ...row })),
    meta: { ...response.meta },
  };
}

function readQueryCache(key: string): QueryResponse | null {
  const cached = queryCache.get(key);
  if (!cached) return null;
  queryCache.delete(key);
  queryCache.set(key, cached);
  return cloneQueryResponse(cached);
}

function writeQueryCache(key: string, response: QueryResponse): void {
  queryCache.set(key, cloneQueryResponse(response));
  if (queryCache.size <= QUERY_CACHE_LIMIT) return;

  const oldestKey = queryCache.keys().next().value;
  if (oldestKey) queryCache.delete(oldestKey);
}

const MODEL_COEFFICIENTS: Record<
  AttributionModel,
  { postViewMultiplier: number; postClickMultiplier: number; incrementalShareMultiplier: number }
> = {
  last_non_direct_click: { postViewMultiplier: 0.9, postClickMultiplier: 1.1, incrementalShareMultiplier: 1.0 },
  last_touch: { postViewMultiplier: 1.0, postClickMultiplier: 1.0, incrementalShareMultiplier: 1.0 },
  linear: { postViewMultiplier: 1.05, postClickMultiplier: 0.95, incrementalShareMultiplier: 1.0 },
};

function hashToUnit(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

type CompiledFilters = {
  dateFrom: string;
  dateTo: string;
  campaignIds?: Set<number>;
  placementIds?: Set<number>;
  creativeIds?: Set<number>;
  brands?: Set<string>;
  advertisers?: Set<string>;
  suppliers?: Set<string>;
  placementEnvironments?: Set<string>;
  domains?: Set<string>;
  geos?: Set<string>;
  deviceTypes?: Set<string>;
  os?: Set<string>;
  formats?: Set<AdFormat>;
  exclusionsDomains?: Set<string>;
  cookiesMode: Filters["cookiesMode"];
  verificationType: Filters["verificationType"];
};

function toSetOrUndefined<T>(values: T[]): Set<T> | undefined {
  return values.length ? new Set(values) : undefined;
}

function compileFilters(filters: Filters): CompiledFilters {
  return {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    campaignIds: toSetOrUndefined(filters.campaignIds),
    placementIds: toSetOrUndefined(filters.placementIds),
    creativeIds: toSetOrUndefined(filters.creativeIds),
    brands: toSetOrUndefined(filters.brands),
    advertisers: toSetOrUndefined(filters.advertisers),
    suppliers: toSetOrUndefined(filters.suppliers),
    placementEnvironments: toSetOrUndefined(filters.placementEnvironments),
    domains: toSetOrUndefined(filters.domains),
    geos: toSetOrUndefined(filters.geos),
    deviceTypes: toSetOrUndefined(filters.deviceTypes),
    os: toSetOrUndefined(filters.os),
    formats: toSetOrUndefined(filters.formats),
    exclusionsDomains: toSetOrUndefined(filters.exclusionsDomains),
    cookiesMode: filters.cookiesMode,
    verificationType: filters.verificationType,
  };
}

function includesSet<T>(value: T, selected?: Set<T>): boolean {
  if (!selected) return true;
  return selected.has(value);
}

function rowMatchesFilters(row: DatasetRow, filters: CompiledFilters): boolean {
  if (filters.dateFrom && row.date < filters.dateFrom) return false;
  if (filters.dateTo && row.date > filters.dateTo) return false;

  if (!includesSet(row.campaignId, filters.campaignIds)) return false;
  if (!includesSet(row.placementId, filters.placementIds)) return false;
  if (!includesSet(row.creativeId, filters.creativeIds)) return false;
  if (!includesSet(row.brand, filters.brands)) return false;
  if (!includesSet(row.advertiser, filters.advertisers)) return false;
  if (!includesSet(row.supplier, filters.suppliers)) return false;
  if (!includesSet(row.placementEnvironment, filters.placementEnvironments)) return false;
  if (!includesSet(row.domain, filters.domains)) return false;
  if (!includesSet(row.geo, filters.geos)) return false;
  if (!includesSet(row.deviceType, filters.deviceTypes)) return false;
  if (!includesSet(row.os, filters.os)) return false;
  if (!includesSet(row.format, filters.formats)) return false;
  if (filters.cookiesMode === "with" && !row.cookiesFlag) return false;
  if (filters.cookiesMode === "without" && row.cookiesFlag) return false;
  if (filters.verificationType !== "all" && row.verificationType !== filters.verificationType) return false;
  if (filters.exclusionsDomains?.has(row.domain)) return false;

  return true;
}

export function applyFilters(data: DatasetRow[], filters: Filters): DatasetRow[] {
  const compiled = compileFilters(filters);
  return data.filter((row) => rowMatchesFilters(row, compiled));
}

type AggregationState = {
  dimensions: Record<string, unknown>;
  impressions: number;
  validImpressions: number;
  cookieImpressions: number;
  measurableIab: number;
  viewableImpressions: number;
  clicks: number;
  validClicks: number;
  cookieClicks: number;
  ivtClicks: number;
  givtClicks: number;
  sivtClicks: number;
  reach: number;
  spend: number;
  vastStart: number;
  vastQ1: number;
  vastMid: number;
  vastQ3: number;
  vastComplete: number;
  postViewConv: number;
  postClickConv: number;
  overlapConv: number;
  totalConversions: number;
  incrementalConversions: number;
  incrementalShareWeighted: number;
  baseTotalConversions: number;
  givtImpressions: number;
  sivtImpressions: number;
  ivtWeighted: number;
  givtWeighted: number;
  sivtWeighted: number;
  brandSafetyWeighted: number;
};

function buildGroupKey(row: DatasetRow, dimensions: Dimension[]): string {
  if (!dimensions.length) return "__all__";
  let key = "";
  for (let i = 0; i < dimensions.length; i += 1) {
    if (i > 0) key += "¦";
    key += String(row[dimensions[i]]);
  }
  return key;
}

function initAggregation(row: DatasetRow, dimensions: Dimension[]): AggregationState {
  const dimValues: Record<string, unknown> = {};
  for (const d of dimensions) dimValues[d] = row[d];

  return {
    dimensions: dimValues,
    impressions: 0,
    validImpressions: 0,
    cookieImpressions: 0,
    measurableIab: 0,
    viewableImpressions: 0,
    clicks: 0,
    validClicks: 0,
    cookieClicks: 0,
    ivtClicks: 0,
    givtClicks: 0,
    sivtClicks: 0,
    reach: 0,
    spend: 0,
    vastStart: 0,
    vastQ1: 0,
    vastMid: 0,
    vastQ3: 0,
    vastComplete: 0,
    postViewConv: 0,
    postClickConv: 0,
    overlapConv: 0,
    totalConversions: 0,
    incrementalConversions: 0,
    incrementalShareWeighted: 0,
    baseTotalConversions: 0,
    givtImpressions: 0,
    sivtImpressions: 0,
    ivtWeighted: 0,
    givtWeighted: 0,
    sivtWeighted: 0,
    brandSafetyWeighted: 0,
  };
}

function updateAggregation(acc: AggregationState, row: DatasetRow): void {
  acc.impressions += row.impressions;
  acc.validImpressions += row.validImpressions;
  acc.cookieImpressions += row.cookiesFlag ? row.impressions : 0;
  acc.measurableIab += row.impressions;
  acc.viewableImpressions += row.viewableImpressions;
  acc.clicks += row.clicks;
  acc.validClicks += row.validClicks;
  acc.cookieClicks += row.cookiesFlag ? row.clicks : 0;
  acc.ivtClicks += row.ivtClicks;
  acc.givtClicks += row.givtClicks;
  acc.sivtClicks += row.sivtClicks;
  acc.reach += row.reach;
  acc.spend += row.spend;
  acc.vastStart += row.vastStart;
  acc.vastQ1 += row.vastQ1;
  acc.vastMid += row.vastMid;
  acc.vastQ3 += row.vastQ3;
  acc.vastComplete += row.vastComplete;
  acc.postViewConv += row.postViewConv;
  acc.postClickConv += row.postClickConv;
  acc.overlapConv += row.overlapConv;
  acc.totalConversions += row.totalConversions;
  acc.incrementalConversions += row.incrementalConversions;
  acc.incrementalShareWeighted += row.incrementalShare * row.totalConversions;
  acc.baseTotalConversions += row.totalConversions;
  acc.givtImpressions += row.givtImpressions;
  acc.sivtImpressions += row.sivtImpressions;
  acc.ivtWeighted += row.ivtRate * row.impressions;
  acc.givtWeighted += row.givtRate * row.impressions;
  acc.sivtWeighted += row.sivtRate * row.impressions;
  acc.brandSafetyWeighted += row.brandSafetyRate * row.impressions;
}

function finalizeAggregation(acc: AggregationState, filters: Filters): Record<string, unknown> {
  const modelK = MODEL_COEFFICIENTS[filters.attributionModel];
  const postViewConv = Math.max(0, Math.round(acc.postViewConv * modelK.postViewMultiplier));
  const postClickConv = Math.max(0, Math.round(acc.postClickConv * modelK.postClickMultiplier));
  const overlapSeed = JSON.stringify(acc.dimensions) || "__all__";
  const overlapK = 0.1 + hashToUnit(overlapSeed) * 0.2;
  const overlapConv = Math.min(
    Math.round(Math.min(postViewConv, postClickConv) * overlapK),
    Math.min(postViewConv, postClickConv)
  );
  const totalConversions = Math.max(0, postViewConv + postClickConv - overlapConv);
  const baseIncrementalShare =
    acc.baseTotalConversions > 0 ? safeDiv(acc.incrementalShareWeighted, acc.baseTotalConversions) : 0.22;
  const incrementalConversions = Math.max(
    0,
    Math.min(
      totalConversions,
      Math.round(totalConversions * baseIncrementalShare * modelK.incrementalShareMultiplier)
    )
  );

  const ctr = safeDiv(acc.clicks, acc.impressions);
  const viewabilityRate = safeDiv(acc.viewableImpressions, acc.impressions);
  const ivtClickRate = safeDiv(acc.ivtClicks, acc.clicks);
  const givtClickRate = safeDiv(acc.givtClicks, acc.clicks);
  const sivtClickRate = safeDiv(acc.sivtClicks, acc.clicks);
  const frequency = safeDiv(acc.impressions, acc.reach);
  const ivtRate = safeDiv(acc.ivtWeighted, acc.impressions);
  const givtRate = safeDiv(acc.givtWeighted, acc.impressions);
  const sivtRate = safeDiv(acc.sivtWeighted, acc.impressions);
  const brandSafetyRate = safeDiv(acc.brandSafetyWeighted, acc.impressions);
  const vcr100 = safeDiv(acc.vastComplete, acc.vastStart);
  const cpm = safeDiv(acc.spend, acc.impressions / 1000);
  const cpr = safeDiv(acc.spend, acc.reach / 1000);
  const cpc = safeDiv(acc.spend, acc.clicks);
  const cpa = safeDiv(acc.spend, totalConversions);

  return {
    ...acc.dimensions,
    impressions: acc.impressions,
    validImpressions: acc.validImpressions,
    cookieImpressions: acc.cookieImpressions,
    measurableIab: acc.measurableIab,
    viewableImpressions: acc.viewableImpressions,
    viewabilityRate,
    clicks: acc.clicks,
    validClicks: acc.validClicks,
    cookieClicks: acc.cookieClicks,
    ivtClicks: acc.ivtClicks,
    givtClicks: acc.givtClicks,
    sivtClicks: acc.sivtClicks,
    ivtClickRate,
    givtClickRate,
    sivtClickRate,
    ctr,
    reach: acc.reach,
    frequency,
    spend: acc.spend,
    cpm,
    cpr,
    cpc,
    cpa,
    ivtRate,
    givtRate,
    sivtRate,
    givtImpressions: acc.givtImpressions,
    sivtImpressions: acc.sivtImpressions,
    brandSafetyRate,
    vastStart: acc.vastStart,
    vastQ1: acc.vastQ1,
    vastMid: acc.vastMid,
    vastQ3: acc.vastQ3,
    vastComplete: acc.vastComplete,
    postViewConv,
    postClickConv,
    associatedConversions: overlapConv,
    overlapConv,
    totalConversions,
    incrementalConversions,
    vcr100,
  };
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""), "ru");
}

const DIMENSION_KEYS = new Set<string>([
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
]);

function pickMetrics(row: Record<string, unknown>, metricsSet?: Set<Metric>): Record<string, unknown> {
  if (!metricsSet?.size) return row;
  const out: Record<string, unknown> = {};

  // Всегда возвращаем измерения + явно запрошенные метрики.
  Object.entries(row).forEach(([key, value]) => {
    if (DIMENSION_KEYS.has(key) || metricsSet?.has(key as Metric)) {
      out[key] = value;
    }
  });

  return out;
}

export function query(q: Query): QueryResponse {
  const cacheKey = makeQueryCacheKey(q);
  const cached = readQueryCache(cacheKey);
  if (cached) return cached;

  const compiledFilters = compileFilters(q.filters);
  const metricsSet = q.metrics.length ? new Set(q.metrics) : undefined;
  const map = new Map<string, AggregationState>();

  for (const row of MOCK_DATASET) {
    if (!rowMatchesFilters(row, compiledFilters)) continue;

    const key = buildGroupKey(row, q.dimensions);
    const existing = map.get(key);
    if (existing) {
      updateAggregation(existing, row);
      continue;
    }

    const next = initAggregation(row, q.dimensions);
    updateAggregation(next, row);
    map.set(key, next);
  }

  let rows = Array.from(map.values()).map((acc) => finalizeAggregation(acc, q.filters));

  if (q.sort?.length) {
    rows = rows.sort((a, b) => {
      for (const s of q.sort ?? []) {
        const cmp = compareValues(a[s.field], b[s.field]);
        if (cmp !== 0) return s.dir === "asc" ? cmp : -cmp;
      }
      return 0;
    });
  }

  const offset = Math.max(0, q.offset ?? 0);
  const limit = q.limit ?? rows.length;
  const totalRows = rows.length;

  rows = rows.slice(offset, offset + limit).map((row) => pickMetrics(row, metricsSet));

  const response = {
    rows,
    meta: {
      sampled: false,
      freshnessSeconds: 15,
      totalRows,
    },
  };

  writeQueryCache(cacheKey, response);
  return cloneQueryResponse(response);
}
