import { query } from "@/query/engine";
import {
  selectAudienceFrequencyDistribution,
  selectConversionsTable,
  selectConversionsTimeseries,
  selectMonitoringRows,
  selectOverviewCampaignExport,
  selectOverviewGeneralKpis,
  selectOverviewTopDomains,
  selectOverviewTopGeos,
  selectOverviewVideoKpis,
  selectPerformanceTable,
  selectSeries,
  selectSpendTimeseries,
  selectVerificationByDevice,
  selectVerificationKpis,
  selectVerificationTimeseries,
  selectVideoAvailability,
  selectVideoTable,
  selectVideoTimeseries,
  selectWorstDomains,
  type PerformanceLevel,
} from "@/query/selectors";
import type { Filters } from "@/query/types";
import type { WorkBook } from "xlsx";

type XlsxModule = typeof import("xlsx");

function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fmtFloat(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function appendWorkbookSheet(
  xlsx: XlsxModule,
  wb: WorkBook,
  name: string,
  rows: Record<string, unknown>[]
) {
  const safeRows = rows.length ? rows : [{ Статус: "Нет данных" }];
  const ws = xlsx.utils.json_to_sheet(safeRows);
  xlsx.utils.book_append_sheet(wb, ws, name.slice(0, 31));
}

export async function exportDashboardDataXlsx(filters: Filters) {
  if (typeof window === "undefined") return;

  const xlsx = await import("xlsx");

  const overviewRows = (selectOverviewCampaignExport(filters).rows as Record<string, unknown>[]).map((row) => {
    const impressions = safeNumber(row.impressions);
    const validImpressions = safeNumber(row.validImpressions);

    return {
      "ID кампании": safeNumber(row.campaignId),
      "Рекламная кампания": String(row.campaignName ?? "—"),
      "Засчитанные показы": validImpressions,
      "Показы с кукой": safeNumber(row.cookieImpressions),
      "Охват": safeNumber(row.reach),
      "Частота": Number(fmtFloat(safeNumber(row.frequency))),
      "Засчитанные клики": safeNumber(row.validClicks),
      "Клики с кукой": safeNumber(row.cookieClicks),
      CTR: safeNumber(row.ctr),
      "IVT показы": Math.max(0, impressions - validImpressions),
      "IVT показы, %": safeNumber(row.ivtRate),
      "IVT клики": safeNumber(row.ivtClicks),
      "IVT клики, %": safeNumber(row.ivtClickRate),
      "Измеримые показы": safeNumber(row.measurableIab),
      "Видимые показы": safeNumber(row.viewableImpressions),
      "Видимость, %": safeNumber(row.viewabilityRate),
      "Brand Safety, %": safeNumber(row.brandSafetyRate),
      "Старты видео": safeNumber(row.vastStart),
      "VCR100 / досмотры до 100%": safeNumber(row.vcr100),
      "Всего конверсий": safeNumber(row.totalConversions),
      "Конверсии post-view": safeNumber(row.postViewConv),
      "Конверсии post-click": safeNumber(row.postClickConv),
      "Ассоциированные конверсии": safeNumber(row.associatedConversions),
      "Инкрементальные конверсии": safeNumber(row.incrementalConversions),
      Затраты: safeNumber(row.spend),
      CPM: safeNumber(row.cpm),
      CPC: safeNumber(row.cpc),
      CPA: safeNumber(row.cpa),
    };
  });

  const generalKpiRow = (selectOverviewGeneralKpis(filters).rows[0] ?? {}) as Record<string, unknown>;
  const videoKpiRow = (selectOverviewVideoKpis(filters).rows[0] ?? {}) as Record<string, unknown>;
  const verificationKpiRow = (selectVerificationKpis(filters).rows[0] ?? {}) as Record<string, unknown>;

  const overviewKpiSheet = [
    {
      "Засчитанные показы": safeNumber(generalKpiRow.validImpressions),
      "Показы с кукой": safeNumber(generalKpiRow.cookieImpressions),
      "Охват": safeNumber(generalKpiRow.reach),
      "Частота": safeNumber(generalKpiRow.frequency),
      "Засчитанные клики": safeNumber(generalKpiRow.validClicks),
      "Клики с кукой": safeNumber(generalKpiRow.cookieClicks),
      CTR: safeNumber(generalKpiRow.ctr),
      "IVT показы": Math.max(0, safeNumber(generalKpiRow.impressions) - safeNumber(generalKpiRow.validImpressions)),
      "IVT показы, %": safeNumber(generalKpiRow.ivtRate),
      "IVT клики": safeNumber(generalKpiRow.ivtClicks),
      "IVT клики, %": safeNumber(generalKpiRow.ivtClickRate),
      "Измеримые показы": safeNumber(generalKpiRow.measurableIab),
      "Видимые показы": safeNumber(generalKpiRow.viewableImpressions),
      "Видимость, %": safeNumber(generalKpiRow.viewabilityRate),
      "Brand Safety, %": safeNumber(generalKpiRow.brandSafetyRate),
      "Старты видео": safeNumber(videoKpiRow.vastStart),
      "VCR100 / досмотры до 100%": safeNumber(videoKpiRow.vcr100),
      "Всего конверсий": safeNumber(generalKpiRow.totalConversions),
      "Конверсии post-view": safeNumber(generalKpiRow.postViewConv),
      "Конверсии post-click": safeNumber(generalKpiRow.postClickConv),
      "Ассоциированные конверсии": safeNumber(generalKpiRow.associatedConversions),
      "Инкрементальные конверсии": safeNumber(generalKpiRow.incrementalConversions),
      Затраты: safeNumber(generalKpiRow.spend),
      CPM: safeNumber(generalKpiRow.cpm),
      CPC: safeNumber(generalKpiRow.cpc),
      CPA: safeNumber(generalKpiRow.cpa),
    },
  ];

  const impressionsSeries = (selectSeries(filters, "impressions").rows as Record<string, unknown>[]).map((row) => ({
    Дата: String(row.date ?? ""),
    Час: row.hour ?? "",
    Показы: safeNumber(row.impressions),
  }));
  const clicksCtrSeriesRaw = query({
    filters,
    dimensions: filters.grain === "hour" ? ["date", "hour"] : ["date"],
    metrics: ["clicks", "ctr"],
    sort: [{ field: "date", dir: "asc" }, { field: "hour", dir: "asc" }],
  }).rows as Record<string, unknown>[];
  const clicksCtrSeries = clicksCtrSeriesRaw.map((row) => ({
    Дата: String(row.date ?? ""),
    Час: row.hour ?? "",
    Клики: safeNumber(row.clicks),
    CTR: safeNumber(row.ctr),
  }));
  const viewabilitySeries = (selectSeries(filters, "viewabilityRate").rows as Record<string, unknown>[]).map((row) => ({
    Дата: String(row.date ?? ""),
    Час: row.hour ?? "",
    "Видимость, %": safeNumber(row.viewabilityRate),
  }));
  const ivtSeries = query({
    filters,
    dimensions: filters.grain === "hour" ? ["date", "hour"] : ["date"],
    metrics: ["ivtRate", "givtRate", "sivtRate"],
    sort: [{ field: "date", dir: "asc" }, { field: "hour", dir: "asc" }],
  }).rows as Record<string, unknown>[];
  const ivtSeriesRows = ivtSeries.map((row) => ({
    Дата: String(row.date ?? ""),
    Час: row.hour ?? "",
    "IVT, %": safeNumber(row.ivtRate),
    "GIVT, %": safeNumber(row.givtRate),
    "SIVT, %": safeNumber(row.sivtRate),
  }));
  const spendSeriesRows = (selectSpendTimeseries(filters).rows as Record<string, unknown>[]).map((row) => ({
    Дата: String(row.date ?? ""),
    Час: row.hour ?? "",
    Затраты: safeNumber(row.spend),
  }));
  const conversionsSeriesRows = (selectConversionsTimeseries(filters).rows as Record<string, unknown>[]).map((row) => ({
    Дата: String(row.date ?? ""),
    Час: row.hour ?? "",
    "Всего конверсий": safeNumber(row.totalConversions),
    "Конверсии post-view": safeNumber(row.postViewConv),
    "Конверсии post-click": safeNumber(row.postClickConv),
    "Инкрементальные конверсии": safeNumber(row.incrementalConversions),
  }));
  const topDomainsRows = (selectOverviewTopDomains(filters).rows as Record<string, unknown>[]).map((row) => ({
    Домен: String(row.domain ?? "—"),
    Показы: safeNumber(row.impressions),
    Охват: safeNumber(row.reach),
    Клики: safeNumber(row.clicks),
    CTR: safeNumber(row.ctr),
    "IVT, %": safeNumber(row.ivtRate),
    "Brand Safety, %": safeNumber(row.brandSafetyRate),
  }));
  const topGeosRows = (selectOverviewTopGeos(filters).rows as Record<string, unknown>[]).map((row) => ({
    Гео: String(row.geo ?? "—"),
    Показы: safeNumber(row.impressions),
    Охват: safeNumber(row.reach),
    Клики: safeNumber(row.clicks),
    CTR: safeNumber(row.ctr),
  }));
  const frequencyRows = selectAudienceFrequencyDistribution(filters).map((row) => ({
    "Бакет частоты": String(row.bucket ?? "—"),
    Охват: safeNumber(row.reach),
    "Доля охвата": safeNumber(row.reachShare),
  }));

  const performanceRows = (selectPerformanceTable({
    filters,
    level: (filters.tableDimension as PerformanceLevel) ?? "campaign",
    limit: 5000,
  }).rows as Record<string, unknown>[]).map((row) => ({
    ID: safeNumber(row.campaignId || row.placementId),
    Название: String(row.campaignName ?? row.placementName ?? row.supplier ?? row.client ?? row.advertiser ?? "—"),
    Показы: safeNumber(row.impressions),
    "Засчитанные показы": safeNumber(row.validImpressions),
    Клики: safeNumber(row.clicks),
    "Засчитанные клики": safeNumber(row.validClicks),
    CTR: safeNumber(row.ctr),
    "IVT, %": safeNumber(row.ivtRate),
    "Видимость, %": safeNumber(row.viewabilityRate),
    Затраты: safeNumber(row.spend),
    CPM: safeNumber(row.cpm),
    CPC: safeNumber(row.cpc),
    CPA: safeNumber(row.cpa),
    "Всего конверсий": safeNumber(row.totalConversions),
  }));

  const verificationKpiSheet = [
    {
      "IVT, %": safeNumber(verificationKpiRow.ivtRate),
      "GIVT, %": safeNumber(verificationKpiRow.givtRate),
      "SIVT, %": safeNumber(verificationKpiRow.sivtRate),
      "Показы GIVT": safeNumber(verificationKpiRow.givtImpressions),
      "Показы SIVT": safeNumber(verificationKpiRow.sivtImpressions),
      "Засчитанные показы": safeNumber(verificationKpiRow.validImpressions),
      "Засчитанные клики": safeNumber(verificationKpiRow.validClicks),
      "Видимые показы": safeNumber(verificationKpiRow.viewableImpressions),
      "Видимость, %": safeNumber(verificationKpiRow.viewabilityRate),
      "IVT клики": safeNumber(verificationKpiRow.ivtClicks),
      "Клики GIVT": safeNumber(verificationKpiRow.givtClicks),
      "Клики SIVT": safeNumber(verificationKpiRow.sivtClicks),
      "IVT клики, %": safeNumber(verificationKpiRow.ivtClickRate),
      "Клики GIVT %": safeNumber(verificationKpiRow.givtClickRate),
      "Клики SIVT %": safeNumber(verificationKpiRow.sivtClickRate),
      "Brand Safety, %": safeNumber(verificationKpiRow.brandSafetyRate),
    },
  ];
  const verificationTimeseriesRows = (selectVerificationTimeseries(filters).rows as Record<string, unknown>[]).map((row) => ({
    Дата: String(row.date ?? ""),
    Час: row.hour ?? "",
    "IVT, %": safeNumber(row.ivtRate),
    "GIVT, %": safeNumber(row.givtRate),
    "SIVT, %": safeNumber(row.sivtRate),
  }));
  const verificationByDeviceRows = (selectVerificationByDevice(filters).rows as Record<string, unknown>[]).map((row) => ({
    Устройство: String(row.deviceType ?? "—"),
    Показы: safeNumber(row.impressions),
    "IVT, %": safeNumber(row.ivtRate),
    "GIVT, %": safeNumber(row.givtRate),
    "SIVT, %": safeNumber(row.sivtRate),
    "Видимость, %": safeNumber(row.viewabilityRate),
  }));
  const worstDomainsRows = (selectWorstDomains(filters).rows as Record<string, unknown>[]).map((row) => ({
    Домен: String(row.domain ?? "—"),
    Показы: safeNumber(row.impressions),
    "Засчитанные показы": safeNumber(row.validImpressions),
    Клики: safeNumber(row.clicks),
    "Засчитанные клики": safeNumber(row.validClicks),
    "IVT, %": safeNumber(row.ivtRate),
    "GIVT, %": safeNumber(row.givtRate),
    "SIVT, %": safeNumber(row.sivtRate),
    "Brand Safety, %": safeNumber(row.brandSafetyRate),
    "Видимость, %": safeNumber(row.viewabilityRate),
  }));
  const monitoringRows = (selectMonitoringRows(filters, "campaign").rows as Record<string, unknown>[]).map((row) => ({
    Кампания: String(row.campaignName ?? "—"),
    Устройство: String(row.deviceType ?? "—"),
    Формат: String(row.format ?? "—"),
    Показы: safeNumber(row.impressions),
    "GIVT, %": safeNumber(row.givtRate),
    "SIVT, %": safeNumber(row.sivtRate),
    "Видимость, %": safeNumber(row.viewabilityRate),
  }));

  const videoKpiSheet = [
    {
      Показы: safeNumber(videoKpiRow.impressions),
      Затраты: safeNumber(videoKpiRow.spend),
      CPM: safeNumber(videoKpiRow.cpm),
      "Старты видео": safeNumber(videoKpiRow.vastStart),
      "VAST Complete": safeNumber(videoKpiRow.vastComplete),
      VCR100: safeNumber(videoKpiRow.vcr100),
      VCR25: safeNumber(videoKpiRow.vastQ1),
      VCR50: safeNumber(videoKpiRow.vastMid),
      VCR75: safeNumber(videoKpiRow.vastQ3),
    },
  ];
  const videoAvailabilityRows = (selectVideoAvailability(filters).rows as Record<string, unknown>[]).map((row) => ({
    Формат: String(row.format ?? "—"),
    Показы: safeNumber(row.impressions),
    "Старты видео": safeNumber(row.vastStart),
  }));
  const videoTimeseriesRows = (selectVideoTimeseries(filters).rows as Record<string, unknown>[]).map((row) => ({
    Дата: String(row.date ?? ""),
    Час: row.hour ?? "",
    Показы: safeNumber(row.impressions),
    Затраты: safeNumber(row.spend),
    CPM: safeNumber(row.cpm),
    "Старты видео": safeNumber(row.vastStart),
    "VAST Complete": safeNumber(row.vastComplete),
    VCR100: safeNumber(row.vcr100),
  }));
  const videoTableRows = (selectVideoTable(filters).rows as Record<string, unknown>[]).map((row) => ({
    "ID кампании": safeNumber(row.campaignId),
    Кампания: String(row.campaignName ?? "—"),
    "Старты видео": safeNumber(row.vastStart),
    "VAST Complete": safeNumber(row.vastComplete),
    VCR100: safeNumber(row.vcr100),
  }));

  const conversionsTableRows = (selectConversionsTable(filters).rows as Record<string, unknown>[]).map((row) => ({
    "ID кампании": safeNumber(row.campaignId),
    Кампания: String(row.campaignName ?? "—"),
    "Конверсии post-view": safeNumber(row.postViewConv),
    "Конверсии post-click": safeNumber(row.postClickConv),
    "Всего конверсий": safeNumber(row.totalConversions),
    "Инкрементальные конверсии": safeNumber(row.incrementalConversions),
    Затраты: safeNumber(row.spend),
    CPA: safeNumber(row.cpa),
  }));

  const wb = xlsx.utils.book_new();
  appendWorkbookSheet(xlsx, wb, "Overview KPI", overviewKpiSheet);
  appendWorkbookSheet(xlsx, wb, "Overview Campaigns", overviewRows);
  appendWorkbookSheet(xlsx, wb, "Impressions", impressionsSeries);
  appendWorkbookSheet(xlsx, wb, "Clicks CTR", clicksCtrSeries);
  appendWorkbookSheet(xlsx, wb, "Viewability", viewabilitySeries);
  appendWorkbookSheet(xlsx, wb, "IVT", ivtSeriesRows);
  appendWorkbookSheet(xlsx, wb, "Spend", spendSeriesRows);
  appendWorkbookSheet(xlsx, wb, "Conversions", conversionsSeriesRows);
  appendWorkbookSheet(xlsx, wb, "Top Domains", topDomainsRows);
  appendWorkbookSheet(xlsx, wb, "Top Geos", topGeosRows);
  appendWorkbookSheet(xlsx, wb, "Freq Distribution", frequencyRows);
  appendWorkbookSheet(xlsx, wb, "Performance", performanceRows);
  appendWorkbookSheet(xlsx, wb, "Verification KPI", verificationKpiSheet);
  appendWorkbookSheet(xlsx, wb, "Verification Trend", verificationTimeseriesRows);
  appendWorkbookSheet(xlsx, wb, "Verification Device", verificationByDeviceRows);
  appendWorkbookSheet(xlsx, wb, "Worst Domains", worstDomainsRows);
  appendWorkbookSheet(xlsx, wb, "Monitoring", monitoringRows);
  appendWorkbookSheet(xlsx, wb, "Video KPI", videoKpiSheet);
  appendWorkbookSheet(xlsx, wb, "Video Availability", videoAvailabilityRows);
  appendWorkbookSheet(xlsx, wb, "Video Trend", videoTimeseriesRows);
  appendWorkbookSheet(xlsx, wb, "Video Table", videoTableRows);
  appendWorkbookSheet(xlsx, wb, "Conversions Table", conversionsTableRows);
  xlsx.writeFile(wb, `dashboard_data_${filters.dateFrom}_${filters.dateTo}.xlsx`);
}
