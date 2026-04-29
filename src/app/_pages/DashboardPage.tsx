'use client';

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import { CATALOG, MOCK_DATASET } from "@/data/mockDataset";
import { getArchivedIds } from "@/lib/archfav";
import { getAllTagsMap, listCampaigns } from "@/lib/campaigns";
import { query } from "@/query/engine";
import {
  computeBudgetKpis,
  exportBudgetsTemplate,
  getBudgetPlacementScope,
  parseBudgetsXlsx,
  type BudgetParseError,
} from "@/query/budgets";
import {
  daysBetweenInclusive,
  serializeFiltersToParams,
  useDashboardFiltersStore,
} from "@/query/filtersStore";
import { useBudgetsStore } from "@/query/budgetsStore";
import { runQueryAsync } from "@/query/runQueryAsync";
import {
  selectConversionsTable,
  selectConversionsSeries,
  selectConversionsTimeseries,
  selectOverviewGeneralKpis,
  selectOverviewTopDomains,
  selectOverviewTopGeos,
  selectOverviewVideoKpis,
  selectAudienceFrequencyDistribution,
  selectMonitoringRows,
  selectPerformanceTable,
  selectSpendTimeseries,
  selectSeries,
  selectVideoAvailability,
  selectVerificationByDevice,
  selectVerificationKpis,
  selectVerificationTimeseries,
  selectWorstDomains,
  toQueryFilters,
  selectSeriesBreakdown,
  type PerformanceLevel,
} from "@/query/selectors";
import type {
  AdFormat,
  AttributionMode,
  AttributionModel,
  AttributionWindow,
  CookiesMode,
  DashboardSection,
  Dimension,
  Filters,
  GlobalFiltersState,
  Metric,
  QuerySort,
  QueryResponse,
  TableDimension,
  VerificationType,
} from "@/query/types";

type RechartsModule = typeof import("recharts");

function lazyRechartsComponent<K extends keyof RechartsModule>(name: K): RechartsModule[K] {
  return dynamic(
    () => import("recharts").then((mod) => mod[name] as unknown as React.ComponentType<unknown>),
    { ssr: false }
  ) as unknown as RechartsModule[K];
}

const Bar = lazyRechartsComponent("Bar");
const BarChart = lazyRechartsComponent("BarChart");
const CartesianGrid = lazyRechartsComponent("CartesianGrid");
const Cell = lazyRechartsComponent("Cell");
const ComposedChart = lazyRechartsComponent("ComposedChart");
const Line = lazyRechartsComponent("Line");
const LineChart = lazyRechartsComponent("LineChart");
const Pie = lazyRechartsComponent("Pie");
const PieChart = lazyRechartsComponent("PieChart");
const ReferenceLine = lazyRechartsComponent("ReferenceLine");
const ResponsiveContainer = lazyRechartsComponent("ResponsiveContainer");
const Tooltip = lazyRechartsComponent("Tooltip");
const XAxis = lazyRechartsComponent("XAxis");
const YAxis = lazyRechartsComponent("YAxis");

const PerformanceDataTable = dynamic(
  () => import("@/app/_pages/PerformanceDataTable").then((mod) => mod.PerformanceDataTable),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

const EMPTY_RESPONSE: QueryResponse = {
  rows: [],
  meta: { sampled: false, freshnessSeconds: 0 },
};

const KPI_MODE_STORAGE_KEY = "adriver/dashboard/kpi-mode";

type Option = {
  value: string;
  label: string;
};

const NO_MATCH_CAMPAIGN_ID = -1;

type SectionMeta = {
  id: DashboardSection;
  label: string;
  enabledForAdvertiser: boolean;
};

type KpiMode = "compact" | "expanded";

type MetricHelpKey =
  | "impressions"
  | "validImpressions"
  | "validImpressionsRate"
  | "ivtImpressions"
  | "givtImpressions"
  | "sivtImpressions"
  | "measurableIab"
  | "viewableImpressions"
  | "viewabilityRate"
  | "reach"
  | "frequency"
  | "spend"
  | "budget"
  | "plannedBudget"
  | "budgetCoverage"
  | "budgetVsSpend"
  | "totalConversions"
  | "incrementalConversions"
  | "cpm"
  | "cpr"
  | "cpc"
  | "cpa"
  | "clicks"
  | "validClicks"
  | "validClicksRate"
  | "ivtClicks"
  | "givtClicks"
  | "sivtClicks"
  | "ivtClickRate"
  | "givtClickRate"
  | "sivtClickRate"
  | "ctr"
  | "ivtRate"
  | "givtRate"
  | "sivtRate"
  | "brandSafetyRate"
  | "vastStart"
  | "vastComplete"
  | "vtrByImpressions"
  | "vtrByStarts"
  | "vcr25"
  | "vcr50"
  | "vcr75"
  | "vcr100"
  | "postViewConv"
  | "postClickConv"
  | "cookieImpressions"
  | "cookieClicks"
  | "associatedConversions"
  | "frequencyDistributionReach";

type MetricHelpItem = {
  title: string;
  definition: string;
  formula: string;
  interpretation: string;
};

const SECTIONS: SectionMeta[] = [
  { id: "overview", label: "Обзор", enabledForAdvertiser: true },
  { id: "performance", label: "Эффективность", enabledForAdvertiser: true },
  { id: "verification", label: "Верификация", enabledForAdvertiser: true },
  { id: "video", label: "Видео", enabledForAdvertiser: true },
  { id: "conversions", label: "Конверсии", enabledForAdvertiser: true },
  { id: "exports", label: "Экспорт-импорт", enabledForAdvertiser: false },
  { id: "help", label: "Справка", enabledForAdvertiser: true },
];

const ATTRIBUTION_MODEL_OPTIONS: Array<{ value: AttributionModel; label: string }> = [
  { value: "last_non_direct_click", label: "Last non-direct click" },
  { value: "last_touch", label: "Last touch" },
  { value: "linear", label: "Линейная" },
];

const ATTRIBUTION_WINDOW_OPTIONS: Array<{ value: AttributionWindow; label: string }> = [
  { value: 1, label: "24 часа" },
  { value: 7, label: "7 дней" },
  { value: 30, label: "30 дней" },
  { value: 60, label: "60 дней" },
  { value: 90, label: "90 дней" },
];

const COOKIES_MODE_OPTIONS: Array<{ value: CookiesMode; label: string }> = [
  { value: "all", label: "Cookies: все" },
  { value: "with", label: "Cookies: с cookie" },
  { value: "without", label: "Cookies: без cookie" },
];

const VERIFICATION_TYPE_OPTIONS: Array<{ value: VerificationType; label: string }> = [
  { value: "all", label: "Все типы" },
  { value: "basic_audit", label: "Базовый аудит" },
  { value: "ivt_adserving", label: "IVT + Adserving" },
  { value: "full_verification", label: "Full Verification" },
  { value: "click_audit", label: "Click-аудит" },
];

const VERIFICATION_BENCHMARKS = {
  adriver: {
    label: "AdRiver",
    values: {
      display: {
        Desktop: { givtRate: 0.014, sivtRate: 0.073, viewabilityRate: 0.614 },
        Mobile: { givtRate: 0.013, sivtRate: 0.037, viewabilityRate: 0.597 },
      },
      video: {
        Desktop: { givtRate: 0.01, sivtRate: 0.099, viewabilityRate: 0.937 },
        Mobile: { givtRate: 0.005, sivtRate: 0.049, viewabilityRate: 0.834 },
      },
    },
  },
  arir: {
    label: "ARIR",
    values: {
      display: {
        Desktop: { givtRate: 0.026, sivtRate: 0.058, viewabilityRate: 0.597 },
        Mobile: { givtRate: 0.026, sivtRate: 0.036, viewabilityRate: 0.579 },
      },
      video: {
        Desktop: { givtRate: 0.021, sivtRate: 0.083, viewabilityRate: 0.891 },
        Mobile: { givtRate: 0.017, sivtRate: 0.059, viewabilityRate: 0.792 },
      },
    },
  },
} as const;

const METRIC_HELP: Record<MetricHelpKey, MetricHelpItem> = {
  impressions: {
    title: "Показы",
    definition: "Количество показов рекламных материалов за выбранный период и срез фильтров.",
    formula: "Сумма показов.",
    interpretation:
      "База для объёма. Сравнивай динамику и распределение по доменам/гео/устройствам.",
  },
  validImpressions: {
    title: "Засчитанные показы",
    definition: "Количество показов после исключения невалидного трафика.",
    formula: "Засчитанные показы = Показы × (1 - IVT показы, %).",
    interpretation: "Используется для оценки фактического качества показов после фильтрации фрода.",
  },
  cookieImpressions: {
    title: "Показы с кукой",
    definition: "Количество показов, пришедшихся на строки с доступным cookie-сигналом.",
    formula: "Сумма показов по строкам, где cookiesFlag = true.",
    interpretation:
      "Это база для корректного чтения cookie-зависимых метрик, в первую очередь охвата и частоты.",
  },
  validImpressionsRate: {
    title: "Засчитано показов, %",
    definition: "Доля засчитанных показов от общего объёма показов.",
    formula: "Засчитано показов, % = Засчитанные показы / Показы × 100%.",
    interpretation:
      "Чем выше показатель, тем меньше потерь трафика на фрод/технический шум.",
  },
  ivtImpressions: {
    title: "IVT показы",
    definition: "Количество показов, классифицированных как невалидный трафик.",
    formula: "IVT показы = Показы - Засчитанные показы.",
    interpretation:
      "Рост в абсолюте на сопоставимом объёме показов требует проверки источников и таргетинга.",
  },
  givtImpressions: {
    title: "Показы GIVT",
    definition: "Абсолютное число показов, попавших в категорию GIVT.",
    formula: "Показы GIVT = Показы × Показы GIVT %.",
    interpretation:
      "Используется для оценки масштаба базового невалидного трафика в штуках, а не только в доле.",
  },
  sivtImpressions: {
    title: "Показы SIVT",
    definition: "Абсолютное число показов, попавших в категорию SIVT.",
    formula: "Показы SIVT = Показы × Показы SIVT %.",
    interpretation:
      "Помогает оценить фактический объём сложного фрода и приоритизировать чистку площадок.",
  },
  measurableIab: {
    title: "Измеримые показы",
    definition: "Количество показов, где технически возможно измерить видимость по IAB/MRC.",
    formula: "Сумма показов с доступным сигналом измерения видимости.",
    interpretation:
      "Если метрика низкая, доли видимости интерпретируются менее надёжно из-за узкой измеримой базы.",
  },
  viewableImpressions: {
    title: "Видимые показы",
    definition: "Количество показов, удовлетворяющих критериям видимости IAB/MRC.",
    formula: "Видимые показы (IAB) = Показы × Видимость (IAB).",
    interpretation: "Показывает реальный контакт, а не просто факт отдачи креатива.",
  },
  viewabilityRate: {
    title: "Видимость, %",
    definition: "Доля показов, признанных видимыми по стандарту IAB/MRC.",
    formula: "Видимость (IAB), % = Видимые показы (IAB) / Показы × 100%.",
    interpretation: "Ниже бенчмарка — сигнал пересмотра инвентаря, форматов и частоты.",
  },
  reach: {
    title: "Охват",
    definition: "Количество уникальных пользователей, увидевших рекламу.",
    formula: "Уникальные пользователи (охват) за период/срез.",
    interpretation: "Отвечает на «скольких людей затронули». Важно вместе с частотой.",
  },
  frequency: {
    title: "Частота",
    definition: "Среднее число показов на одного уникального пользователя.",
    formula: "Частота = Показы / Охват.",
    interpretation:
      "Высокая частота при стагнации охвата — сигнал выгорания/узкого таргетинга.",
  },
  spend: {
    title: "Затраты",
    definition: "Суммарные затраты на рекламу за выбранный период.",
    formula: "Сумма затрат по текущему срезу.",
    interpretation: "Показывает общий бюджетный объём. Анализируй вместе с CPM/CPC/CPA.",
  },
  budget: {
    title: "Бюджет",
    definition: "Бюджетная величина, используемая в отчётах конструктора и план-факт анализе.",
    formula: "Сумма бюджетов по выбранной сущности отчёта.",
    interpretation:
      "Используется как верхнеуровневый лимит и ориентир для контроля отклонений по затратам.",
  },
  plannedBudget: {
    title: "Плановый бюджет",
    definition: "Бюджет, заданный в плане по выбранному срезу размещений.",
    formula: "Сумма плановых бюджетов по размещениям в текущем фильтре.",
    interpretation:
      "База для контроля исполнения плана. Сравнивайте с фактическими затратами.",
  },
  budgetCoverage: {
    title: "Budget coverage",
    definition: "Доля размещений, для которых задан плановый бюджет.",
    formula: "Budget coverage = Размещения с бюджетом / Все размещения × 100%.",
    interpretation:
      "Низкое покрытие снижает точность план-факт анализа и сигнализирует о неполноте загрузки бюджета.",
  },
  budgetVsSpend: {
    title: "План vs Затраты",
    definition: "Отклонение фактических затрат от планового бюджета.",
    formula: "План vs Затраты = Плановый бюджет - Фактические затраты.",
    interpretation:
      "Положительное значение означает запас бюджета, отрицательное — перерасход.",
  },
  totalConversions: {
    title: "Всего конверсий",
    definition:
      "Общее число конверсий: дедуплицированное объединение post-view и post-click. В прототипе дедуп моделируется.",
    formula: "Всего конверсий = Post-view + Post-click - пересечение (модельное).",
    interpretation: "Итоговый объём конверсий без двойного учёта одного события.",
  },
  incrementalConversions: {
    title: "Инкрементальные конверсии",
    definition:
      "Конверсии с доминирующим вкладом медийного канала (>70%). В прототипе значение моделируется.",
    formula: "Инкрементальные конверсии = round(Всего конверсий × доля инкрементальности).",
    interpretation: "Оценка дополнительного эффекта медийного канала поверх базового спроса.",
  },
  cpm: {
    title: "CPM",
    definition: "Стоимость 1000 показов.",
    formula: "CPM = Затраты / (Показы / 1000).",
    interpretation: "Показывает цену охвата по показам. Рост может сигнализировать о дорогом инвентаре.",
  },
  cpr: {
    title: "CPR",
    definition: "Стоимость 1000 уникальных пользователей.",
    formula: "CPR = Затраты / (Охват / 1000).",
    interpretation: "Полезен для оценки эффективности по охвату, а не по объёму показов.",
  },
  cpc: {
    title: "CPC",
    definition: "Стоимость клика.",
    formula: "CPC = Затраты / Клики.",
    interpretation: "Сравнивается между сопоставимыми форматами и по стабильным объёмам.",
  },
  cpa: {
    title: "CPA",
    definition: "Стоимость конверсии.",
    formula: "CPA = Затраты / Всего конверсий.",
    interpretation: "Ключевой показатель эффективности по целевому действию.",
  },
  clicks: {
    title: "Клики",
    definition: "Количество кликов по рекламным материалам.",
    formula: "Сумма кликов.",
    interpretation:
      "В паре с CTR показывает реакцию на креатив/плейсмент. Клик не гарантирует визит.",
  },
  validClicks: {
    title: "Засчитанные клики",
    definition: "Количество кликов после исключения невалидных кликов.",
    formula: "Засчитанные клики = Клики × (1 - доля невалидных кликов IVT).",
    interpretation: "Позволяет оценивать качество отклика без фрода в кликах.",
  },
  cookieClicks: {
    title: "Клики с кукой",
    definition: "Количество кликов, пришедшихся на строки с доступным cookie-сигналом.",
    formula: "Сумма кликов по строкам, где cookiesFlag = true.",
    interpretation:
      "Помогает отделить cookie-доступную часть кликового трафика от общего объёма и не ломает чтение кликовой логики.",
  },
  validClicksRate: {
    title: "Засчитано кликов, %",
    definition: "Доля засчитанных кликов от общего объёма кликов.",
    formula: "Засчитано кликов, % = Засчитанные клики / Клики × 100%.",
    interpretation:
      "Рост метрики подтверждает улучшение качества кликового трафика и снижение фрод-нагрузки.",
  },
  ivtClicks: {
    title: "IVT клики",
    definition: "Количество кликов, классифицированных как невалидная активность.",
    formula: "IVT клики = Клики - Засчитанные клики.",
    interpretation: "Рост метрики требует проверки источников трафика, креативов и сценариев клика.",
  },
  givtClicks: {
    title: "Клики GIVT",
    definition: "Количество невалидных кликов, отнесенных к General Invalid Traffic.",
    formula: "Клики GIVT = Клики × Клики GIVT %.",
    interpretation: "Используется для оценки формально определяемой невалидной кликовой активности.",
  },
  sivtClicks: {
    title: "Клики SIVT",
    definition: "Количество невалидных кликов, отнесенных к Sophisticated Invalid Traffic.",
    formula: "Клики SIVT = Клики × Клики SIVT %.",
    interpretation: "Показывает объем более сложной и поведенчески выявляемой невалидной кликовой активности.",
  },
  ivtClickRate: {
    title: "IVT клики, %",
    definition: "Доля невалидных кликов от общего количества кликов.",
    formula: "IVT клики, % = IVT клики / Клики × 100%.",
    interpretation: "Показывает, какая доля кликов отфильтрована как невалидная.",
  },
  givtClickRate: {
    title: "Клики GIVT %",
    definition: "Доля кликов GIVT от общего количества кликов.",
    formula: "Клики GIVT % = Клики GIVT / Клики × 100%.",
    interpretation: "Помогает понять долю кликов, отфильтрованных как general invalid traffic.",
  },
  sivtClickRate: {
    title: "Клики SIVT %",
    definition: "Доля кликов SIVT от общего количества кликов.",
    formula: "Клики SIVT % = Клики SIVT / Клики × 100%.",
    interpretation: "Используется для оценки доли сложного невалидного кликового трафика.",
  },
  ctr: {
    title: "CTR",
    definition: "Доля показов, завершившихся кликом.",
    formula: "CTR = Клики / Показы × 100%.",
    interpretation:
      "Сравнивай в рамках одинаковых форматов и при сопоставимом объёме показов.",
  },
  ivtRate: {
    title: "IVT показы, %",
    definition: "Доля невалидного трафика (подозрительные/некачественные показы).",
    formula: "IVT показы, % = IVT показы / Показы × 100%.",
    interpretation:
      "Рост метрики — повод проверять домены/площадки, устройства/ОС, гео и время.",
  },
  givtRate: {
    title: "Показы GIVT %",
    definition: "Доля показов, попавших в GIVT (общий невалидный трафик).",
    formula: "Показы GIVT % = Показы GIVT / Показы × 100%.",
    interpretation: "Показывает вклад базовых видов невалидного трафика в общий IVT.",
  },
  sivtRate: {
    title: "Показы SIVT %",
    definition: "Доля показов, попавших в SIVT (сложный невалидный трафик).",
    formula: "Показы SIVT % = Показы SIVT / Показы × 100%.",
    interpretation: "Рост SIVT обычно требует более жёсткого контроля площадок/источников.",
  },
  brandSafetyRate: {
    title: "Brand Safety, %",
    definition: "Доля показов в бренд-безопасном окружении по правилам классификации.",
    formula: "Brand safety, % = Безопасные показы / Показы × 100%.",
    interpretation: "Падение показателя — сигнал пересмотра источников/категорий контента.",
  },
  vastStart: {
    title: "Старты видео",
    definition: "Количество стартов просмотра видеорекламы.",
    formula: "Сумма стартов видео (VAST Start) только по видео-размещениям.",
    interpretation: "Лучше отражает реальный контакт в видео, чем просто «показы контейнера».",
  },
  vastComplete: {
    title: "VAST Complete",
    definition: "Количество досмотров видео до 100%.",
    formula: "Сумма событий VAST Complete по видео-размещениям.",
    interpretation:
      "Показывает объём завершённых просмотров; корректно анализировать вместе с VAST Start и VTR.",
  },
  vtrByImpressions: {
    title: "VTR от показов",
    definition: "Доля полных досмотров от загрузок креатива.",
    formula: "VTR от показов = VAST Complete / Креатив загружен × 100%.",
    interpretation:
      "Чувствителен к качеству инвентаря и старту ролика: показывает путь от загрузки до полного просмотра.",
  },
  vtrByStarts: {
    title: "VTR от стартов",
    definition: "Доля полных досмотров от стартов воспроизведения.",
    formula: "VTR от стартов = VAST Complete / VAST Start × 100%.",
    interpretation:
      "Метрика удержания после старта видео; по сути эквивалентна VCR100 в этом прототипе.",
  },
  vcr25: {
    title: "VCR25",
    definition: "Доля стартов, досмотревших видео до 25%.",
    formula: "VCR25 = VAST 25 / VAST Start × 100%.",
    interpretation:
      "Падение на ранней стадии указывает на проблемы первых секунд ролика/контекста показа.",
  },
  vcr50: {
    title: "VCR50",
    definition: "Доля стартов, досмотревших видео до 50%.",
    formula: "VCR50 = VAST 50 / VAST Start × 100%.",
    interpretation:
      "Позволяет оценить удержание середины ролика и устойчивость внимания аудитории.",
  },
  vcr75: {
    title: "VCR75",
    definition: "Доля стартов, досмотревших видео до 75%.",
    formula: "VCR75 = VAST 75 / VAST Start × 100%.",
    interpretation:
      "Переход к финалу ролика; полезно для сравнения креативов с разной длиной и монтажом.",
  },
  vcr100: {
    title: "VCR100 / досмотры до 100%",
    definition: "Доля стартов, завершившихся досмотром до 100%.",
    formula: "VCR100 = VAST Complete / VAST Start × 100% только по видео-размещениям.",
    interpretation:
      "Низкий VCR100 — повод смотреть длину ролика, формат (in/out-stream), качество инвентаря.",
  },
  postViewConv: {
    title: "Конверсии post-view",
    definition: "Конверсии после просмотра рекламы без клика в окне атрибуции.",
    formula: "Количество конверсий, атрибутированных по post-view (view → conversion).",
    interpretation:
      "Показатель вклада медийки без прямого отклика; критичны окно атрибуции и дедупликация.",
  },
  postClickConv: {
    title: "Конверсии post-click",
    definition: "Конверсии после клика по рекламе в окне атрибуции.",
    formula: "Количество конверсий, атрибутированных по post-click (click → conversion).",
    interpretation:
      "Чувствителен к корректности трекинг-ссылок и правилам приоритета атрибуции.",
  },
  associatedConversions: {
    title: "Ассоциированные конверсии",
    definition:
      "Конверсии, которые одновременно попадают в post-view и post-click до дедупликации. В прототипе это модельное пересечение двух потоков.",
    formula: "Ассоциированные конверсии = пересечение post-view и post-click.",
    interpretation:
      "Показывает объём пересечения двух моделей атрибуции и помогает понять масштаб дедупликации в итоговых конверсиях.",
  },
  frequencyDistributionReach: {
    title: "Frequency distribution по охвату",
    definition:
      "Распределение охвата по бакетам частоты контакта: показывает, какая доля аудитории увидела рекламу 1 раз, 2 раза, 3 раза и так далее.",
    formula:
      "Для каждой строки берём reach и frequency, относим охват в бакет частоты (1, 2, 3, 4, 5, 6-10, 11-20, 20+), затем суммируем охват внутри бакета. Доля охвата = Охват бакета / Общий охват.",
    interpretation:
      "Позволяет понять, равномерно ли распределяются контакты по аудитории. Рост доли в высоких бакетах может означать переизбыточную частоту, а концентрация в низких бакетах — недодавленную коммуникацию.",
  },
};

const METRIC_HELP_ORDER: MetricHelpKey[] = [
  "validImpressions",
  "cookieImpressions",
  "reach",
  "frequency",
  "validClicks",
  "cookieClicks",
  "ctr",
  "ivtImpressions",
  "ivtRate",
  "ivtClicks",
  "ivtClickRate",
  "givtImpressions",
  "sivtImpressions",
  "givtClicks",
  "sivtClicks",
  "givtRate",
  "sivtRate",
  "givtClickRate",
  "sivtClickRate",
  "measurableIab",
  "viewableImpressions",
  "viewabilityRate",
  "brandSafetyRate",
  "vastStart",
  "vastComplete",
  "vtrByImpressions",
  "vtrByStarts",
  "vcr25",
  "vcr50",
  "vcr75",
  "vcr100",
  "totalConversions",
  "postViewConv",
  "postClickConv",
  "associatedConversions",
  "incrementalConversions",
  "spend",
  "budget",
  "plannedBudget",
  "budgetCoverage",
  "budgetVsSpend",
  "cpm",
  "cpr",
  "cpc",
  "cpa",
];

function SectionIcon({ sectionId }: { sectionId: DashboardSection }) {
  const base = "h-5 w-5";

  if (sectionId === "overview") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={base}>
        <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" />
      </svg>
    );
  }

  if (sectionId === "performance") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={base}>
        <path d="M4 20V9m6 11V4m6 16v-8m4 8H2" />
      </svg>
    );
  }

  if (sectionId === "verification") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={base}>
        <path d="M12 3 4 6v6c0 5 3.4 7.9 8 9 4.6-1.1 8-4 8-9V6l-8-3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }

  if (sectionId === "video") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={base}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m11 9 5 3-5 3V9Z" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (sectionId === "conversions") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={base}>
        <path d="M4 19h16" />
        <path d="m6 15 4-4 3 3 5-6" />
        <path d="m17 8h1.5V9.5" />
      </svg>
    );
  }

  if (sectionId === "help") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={base}>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.8 9.2a2.3 2.3 0 1 1 3.9 1.8c-.9.7-1.6 1.2-1.6 2.5" />
        <path d="M12 17h.01" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={base}>
      <path d="M12 3v11" />
      <path d="m8 10 4 4 4-4" />
      <rect x="4" y="16" width="16" height="5" rx="1.5" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className ?? "h-4 w-4"}
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className ?? "h-4 w-4"}
      aria-hidden="true"
    >
      <path d="M4 6h16l-6 7v5l-4-2v-3L4 6Z" />
    </svg>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className ?? "h-4 w-4"}
      aria-hidden="true"
    >
      <path d="M19 12H5" />
      <path d="m11 18-6-6 6-6" />
    </svg>
  );
}

function BuilderIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className ?? "h-4 w-4"}
      aria-hidden="true"
    >
      <path d="m14 7 3-3 3 3-3 3-3-3Z" />
      <path d="m13 8-7 7a2.2 2.2 0 0 0 0 3.1l.9.9a2.2 2.2 0 0 0 3.1 0l7-7" />
      <path d="m4 20 3-3" />
    </svg>
  );
}

function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fmtInt(value: number): string {
  return Math.round(value).toLocaleString("ru-RU");
}

function fmtPercent(value: number, digits = 2): string {
  return `${(value * 100).toFixed(digits)}%`;
}

function fmtFloat(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function fmtCurrency(value: number): string {
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

async function exportDashboardDataXlsx(filters: Filters) {
  const mod = await import("@/app/_pages/dashboardExport");
  await mod.exportDashboardDataXlsx(filters);
}

const CHART_TICK_STYLE = { fontSize: 11, fill: "#6f7380" };
const CHART_TOOLTIP_CONTENT_STYLE = {
  fontSize: "11px",
  borderRadius: "8px",
  borderColor: "#d9dde3",
};
const CHART_TOOLTIP_LABEL_STYLE = { fontSize: "11px", color: "#1d1d1b" };
const CHART_TOOLTIP_ITEM_STYLE = { fontSize: "11px" };

function parseNumberList(raw: string | null): number[] {
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

function parseKpiMode(raw: string | null): KpiMode | null {
  if (raw === "compact" || raw === "expanded") return raw;
  return null;
}

function getSectionFromPath(pathname: string): DashboardSection {
  const segment = pathname.split("/").filter(Boolean)[1];
  if (
    segment === "overview" ||
    segment === "performance" ||
    segment === "verification" ||
    segment === "video" ||
    segment === "conversions" ||
    segment === "exports" ||
    segment === "help"
  ) {
    return segment;
  }
  return "overview";
}

function shiftPeriod(dateFrom: string, dateTo: string): { from: string; to: string } {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const diffDays = Math.max(1, Math.floor((to.getTime() - from.getTime()) / (24 * 3600 * 1000)) + 1);
  const prevTo = new Date(from);
  prevTo.setDate(from.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevTo.getDate() - (diffDays - 1));

  const format = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  return { from: format(prevFrom), to: format(prevTo) };
}

function buildTimelineLabel(row: Record<string, unknown>, grain: "day" | "hour"): string {
  const date = String(row.date ?? "");
  if (grain === "hour") {
    const hour = String(Math.max(0, Math.min(23, safeNumber(row.hour)))).padStart(2, "0");
    return `${date} ${hour}:00`;
  }
  return date;
}

type OverviewSliceId =
  | "campaign"
  | "supplier"
  | "placement"
  | "placementEnvironment"
  | "creative"
  | "domain"
  | "deviceType"
  | "format";

type OverviewSliceState = OverviewSliceId | "";
type IvtSliceId = OverviewSliceId | "qualitySplit";
type IvtSliceState = IvtSliceId | "";
type ConversionsMetricMode = "totalConversions" | "postViewConv" | "postClickConv";
type HeatmapMetricId = "ivt" | "impressions" | "clicks" | "conversions";

type OverviewSliceConfig = {
  label: string;
  dimensions: Dimension[];
  seriesLabel: (row: Record<string, unknown>) => string;
  filterValue: (row: Record<string, unknown>) => string | number;
};

type OverviewSliceSeries = {
  key: string;
  label: string;
  color: string;
  filterValue: string | number;
};

type SliceOption<T extends string> = {
  value: T;
  label: string;
};

type OverviewHiddenSummary = {
  count: number;
  labels: string[];
};

const OVERVIEW_BREAKDOWN_COLORS = ["#1d70b7", "#35a8e0", "#84bc00", "#f29100", "#5b2c83"] as const;

const OVERVIEW_SLICE_CONFIG: Record<OverviewSliceId, OverviewSliceConfig> = {
  campaign: {
    label: "Кампания",
    dimensions: ["campaignId", "campaignName"],
    seriesLabel: (row) => `${safeNumber(row.campaignId)} · ${String(row.campaignName ?? "—")}`,
    filterValue: (row) => safeNumber(row.campaignId),
  },
  supplier: {
    label: "Поставщик",
    dimensions: ["supplier"],
    seriesLabel: (row) => String(row.supplier ?? "—"),
    filterValue: (row) => String(row.supplier ?? "—"),
  },
  placement: {
    label: "Размещение",
    dimensions: ["placementId", "placementName"],
    seriesLabel: (row) => `${safeNumber(row.placementId)} · ${String(row.placementName ?? "—")}`,
    filterValue: (row) => safeNumber(row.placementId),
  },
  placementEnvironment: {
    label: "Среда размещения",
    dimensions: ["placementEnvironment"],
    seriesLabel: (row) => String(row.placementEnvironment ?? "—"),
    filterValue: (row) => String(row.placementEnvironment ?? "—"),
  },
  creative: {
    label: "Креатив",
    dimensions: ["creativeId", "creativeName"],
    seriesLabel: (row) => `${safeNumber(row.creativeId)} · ${String(row.creativeName ?? "—")}`,
    filterValue: (row) => safeNumber(row.creativeId),
  },
  domain: {
    label: "Домен",
    dimensions: ["domain"],
    seriesLabel: (row) => String(row.domain ?? "—"),
    filterValue: (row) => String(row.domain ?? "—"),
  },
  deviceType: {
    label: "Устройство",
    dimensions: ["deviceType"],
    seriesLabel: (row) => String(row.deviceType ?? "—"),
    filterValue: (row) => String(row.deviceType ?? "—"),
  },
  format: {
    label: "Формат",
    dimensions: ["format"],
    seriesLabel: (row) => String(row.format ?? "—").toUpperCase(),
    filterValue: (row) => String(row.format ?? "—"),
  },
};

function buildOverviewBreakdownTimeline(
  rows: Record<string, unknown>[],
  grain: "day" | "hour",
  metricKey: string,
  sliceId: OverviewSliceId
): {
  data: Array<Record<string, string | number>>;
  series: OverviewSliceSeries[];
  hasOthers: boolean;
  hiddenSummary: OverviewHiddenSummary | null;
} {
  const config = OVERVIEW_SLICE_CONFIG[sliceId];
  const totals = new Map<string, { label: string; total: number; filterValue: string | number }>();
  const points = new Map<string, Record<string, string | number>>();

  rows.forEach((row) => {
    const pointLabel = buildTimelineLabel(row, grain);
    const seriesLabel = config.seriesLabel(row);
    const seriesKey = `series:${seriesLabel}`;
    const value = safeNumber(row[metricKey]);

    const existingPoint = points.get(pointLabel) ?? { label: pointLabel };
    existingPoint[seriesKey] = safeNumber(existingPoint[seriesKey]) + value;
    points.set(pointLabel, existingPoint);

    const existingSeries = totals.get(seriesKey) ?? {
      label: seriesLabel,
      total: 0,
      filterValue: config.filterValue(row),
    };
    existingSeries.total += value;
    totals.set(seriesKey, existingSeries);
  });

  const rankedSeries = Array.from(totals.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .map(([key, meta]) => ({ key, label: meta.label, total: meta.total }));

  const topSeries = rankedSeries.slice(0, 4);
  const hiddenSeries = rankedSeries.slice(4);
  const topSeriesKeys = new Set(topSeries.map((series) => series.key));

  const data = Array.from(points.values())
    .sort((a, b) => String(a.label).localeCompare(String(b.label)))
    .map((point) => {
      const nextPoint: Record<string, string | number> = { label: String(point.label ?? "") };

      rankedSeries.forEach((series) => {
        const value = safeNumber(point[series.key]);
        if (topSeriesKeys.has(series.key)) {
          nextPoint[series.key] = value;
        }
      });

      topSeries.forEach((series) => {
        if (!(series.key in nextPoint)) nextPoint[series.key] = 0;
      });

      return nextPoint;
    });

  const series: OverviewSliceSeries[] = topSeries.map((item, index) => ({
    key: item.key,
    label: item.label,
    color: OVERVIEW_BREAKDOWN_COLORS[index] ?? OVERVIEW_BREAKDOWN_COLORS[OVERVIEW_BREAKDOWN_COLORS.length - 1],
    filterValue: item.total ? (totals.get(item.key)?.filterValue ?? item.label) : item.label,
  }));

  return {
    data,
    series,
    hasOthers: false,
    hiddenSummary: hiddenSeries.length
      ? {
          count: hiddenSeries.length,
          labels: hiddenSeries.slice(0, 12).map((series) => series.label),
        }
      : null,
  };
}

function calcDelta(current: number, prev: number): number | null {
  if (!prev) return null;
  return (current - prev) / prev;
}

function ratio(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return numerator / denominator;
}

function calcMedian(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function calcPearsonCorrelation(xValues: number[], yValues: number[]): number | null {
  if (xValues.length !== yValues.length || xValues.length < 2) return null;
  const xMean = xValues.reduce((sum, value) => sum + value, 0) / xValues.length;
  const yMean = yValues.reduce((sum, value) => sum + value, 0) / yValues.length;
  let numerator = 0;
  let xDenominator = 0;
  let yDenominator = 0;

  for (let i = 0; i < xValues.length; i += 1) {
    const xDiff = xValues[i] - xMean;
    const yDiff = yValues[i] - yMean;
    numerator += xDiff * yDiff;
    xDenominator += xDiff * xDiff;
    yDenominator += yDiff * yDiff;
  }

  const denominator = Math.sqrt(xDenominator * yDenominator);
  if (!denominator) return null;
  return numerator / denominator;
}

function useAsyncResource<T>(key: string, loader: () => T, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(loader);

  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    runQueryAsync(() => loaderRef.current())
      .then((next) => {
        if (!cancelled) {
          setData(next);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Ошибка данных");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return { data, loading, error };
}

function FiltersSkeleton() {
  return <div className="h-20 animate-pulse rounded-xl border bg-gray-100" />;
}

function CardSkeleton() {
  return <div className="h-[78px] animate-pulse rounded-xl border bg-gray-100" />;
}

function ChartSkeleton() {
  return <div className="h-72 animate-pulse rounded-xl border bg-gray-100" />;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">{text}</div>;
}

function MetricHelpTooltip({ metricKey }: { metricKey: MetricHelpKey }) {
  const help = METRIC_HELP[metricKey];
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  const updatePosition = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 0;
    const preferredLeft = rect.left + rect.width / 2;
    const minLeft = 172;
    const maxLeft = Math.max(minLeft, viewportWidth - 172);
    setPosition({
      left: Math.min(Math.max(preferredLeft, minLeft), maxLeft),
      top: rect.bottom + 8,
    });
  };

  const show = () => {
    updatePosition();
    setOpen(true);
  };

  const hide = () => setOpen(false);

  return (
    <span className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex h-2.5 w-2.5 items-center justify-center rounded-full border border-gray-300 text-[7px] text-gray-500 hover:bg-gray-50"
        aria-label={`Справка по метрике ${help.title}`}
        onMouseEnter={show}
        onFocus={show}
        onMouseLeave={hide}
        onBlur={hide}
      >
        ⓘ
      </button>
      <span
        className={`pointer-events-none fixed z-[80] w-80 -translate-x-1/2 rounded-md border bg-white p-3 text-[11px] text-gray-700 shadow-xl transition ${
          open ? "opacity-100" : "opacity-0"
        }`}
        style={{
          left: `${position.left}px`,
          top: `${position.top}px`,
          visibility: open ? "visible" : "hidden",
        }}
      >
        <span className="mb-1 block text-xs font-semibold text-gray-900">{help.title}</span>
        <span className="block"><span className="font-semibold">Определение:</span> {help.definition}</span>
        <span className="mt-1 block"><span className="font-semibold">Как считаем:</span> {help.formula}</span>
        <span className="mt-1 block"><span className="font-semibold">Интерпретация:</span> {help.interpretation}</span>
      </span>
    </span>
  );
}

function CompareHelpTooltip() {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] text-gray-500 hover:bg-gray-50"
        aria-label="Справка по сравнению с прошлым периодом"
      >
        ⓘ
      </button>
      <span className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 hidden w-80 -translate-x-1/2 rounded-md border bg-white p-3 text-[11px] text-gray-700 shadow-xl group-hover:block group-focus-within:block">
        <span className="mb-1 block text-xs font-semibold text-gray-900">Сравнение с прошлым периодом</span>
        <span className="block">
          Показывает те же метрики за предыдущий период той же длины и сравнение с текущим (Δ и %).
        </span>
        <span className="mt-1 block">Все фильтры, кроме дат, сохраняются.</span>
        <span className="mt-1 block">Пример: 11–17 фев → 4–10 фев.</span>
        <span className="mt-1 block">Если в прошлом периоде было 0, процент может не отображаться.</span>
      </span>
    </span>
  );
}

function MetricCard(props: {
  title: string;
  value: string;
  metricKey?: MetricHelpKey;
  disabled?: boolean;
  disabledHint?: string;
  delta?: number | null;
  highlighted?: boolean;
  hint?: string;
}) {
  const { title, value, metricKey, disabled, disabledHint, delta, highlighted, hint } = props;
  return (
    <div
      className={`h-[66px] rounded-xl border border-slate-200 bg-white px-2.5 py-2 hover:shadow-sm ${
        highlighted ? "border-sky-300 shadow-[inset_0_0_0_1px_rgba(14,165,233,0.25)]" : "border-slate-200"
      } ${disabled ? "opacity-55" : ""}`}
      title={disabled ? disabledHint : undefined}
    >
      <div className="flex h-full flex-col justify-between">
        <div className="flex min-w-0 items-center gap-1 text-[9px] text-slate-600">
          <span className="truncate" title={title}>{title}</span>
          {metricKey && <MetricHelpTooltip metricKey={metricKey} />}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="whitespace-nowrap tabular-nums text-[17px] font-semibold leading-tight text-slate-900">
            {value}
          </span>
        </div>
        <div className="min-h-[8px] space-y-0">
          {delta !== undefined && delta !== null && (
            <div className={`line-clamp-1 text-[9px] ${delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {delta >= 0 ? "+" : ""}
              {(delta * 100).toFixed(1)}% к прошлому периоду
            </div>
          )}
          {hint && <div className="line-clamp-1 text-[9px] text-slate-500">{hint}</div>}
          {disabled && disabledHint && <div className="line-clamp-1 text-[9px] text-gray-500">{disabledHint}</div>}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
    </div>
  );
}

function KpiSection(props: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  gridClassName?: string;
}) {
  const { title, subtitle, children, className, gridClassName } = props;
  return (
    <section className={className ?? ""}>
      <div className="mb-3 flex min-h-8 flex-col justify-end">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className={gridClassName ?? "grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"}>
        {children}
      </div>
    </section>
  );
}

function SectionChip(props: { title: string; subtitle?: string; withTopGap?: boolean }) {
  const { title, subtitle, withTopGap } = props;
  return (
    <div className={`col-span-full h-6 ${withTopGap ? "mt-2 md:mt-3" : ""}`}>
      <div className="flex h-full items-end gap-2">
        <span className="text-sm font-medium text-slate-700">{title}</span>
        {subtitle && <span className="text-xs text-slate-500">{subtitle}</span>}
      </div>
    </div>
  );
}

function MultiSelectFilter(props: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  className?: string;
}) {
  const { label, options, selected, onChange, className } = props;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const filteredOptions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(needle) ||
        String(opt.value).toLowerCase().includes(needle)
    );
  }, [options, search]);

  const toggle = (value: string) => {
    if (selectedSet.has(value)) {
      onChange(selected.filter((x) => x !== value));
      return;
    }
    onChange([...selected, value]);
  };

  return (
    <div className={className ?? "relative min-w-[170px]"}>
      <button
        type="button"
        className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-left text-sm hover:bg-gray-50"
        onClick={() => setOpen((x) => !x)}
      >
        <span className="font-medium">{label}</span>
        <span className="ml-2 text-xs text-gray-500">{selected.length ? `${selected.length}` : "Все"}</span>
      </button>
      {open && (
        <div className="absolute z-40 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-lg border bg-white p-2 shadow-lg">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск"
            className="mb-2 w-full rounded-md border px-2 py-1.5 text-xs"
          />
          <div className="mb-2 flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => onChange(options.map((o) => o.value))}
              className="rounded border px-2 py-1 hover:bg-gray-50"
            >
              Выбрать все
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="rounded border px-2 py-1 hover:bg-gray-50"
            >
              Снять все
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto rounded border px-2 py-1 hover:bg-gray-50"
            >
              Закрыть
            </button>
          </div>
          <div className="max-h-56 overflow-auto rounded border">
            {filteredOptions.map((opt) => {
              const checked = selectedSet.has(opt.value);
              return (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 border-b px-2 py-1.5 text-xs last:border-b-0 hover:bg-sky-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(opt.value)}
                  />
                  <span className="truncate">{opt.label}</span>
                </label>
              );
            })}
            {!filteredOptions.length && <div className="p-2 text-xs text-gray-500">Ничего не найдено</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function SingleSelectFilter(props: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const { label, value, options, onChange, className } = props;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedLabel = options.find((item) => item.value === value)?.label ?? value;
  const resetValue = options[0]?.value ?? value;
  const filteredOptions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(needle) ||
        String(opt.value).toLowerCase().includes(needle)
    );
  }, [options, search]);

  return (
    <div className={className ?? "relative min-w-[170px]"}>
      <button
        type="button"
        className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-left text-sm hover:bg-gray-50"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="font-medium">{label}</span>
        <span className="ml-2 text-xs text-gray-500">{selectedLabel}</span>
      </button>
      {open && (
        <div className="absolute z-40 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-lg border bg-white p-2 shadow-lg">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск"
            className="mb-2 w-full rounded-md border px-2 py-1.5 text-xs"
          />
          <div className="mb-2 flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => onChange(resetValue)}
              className="rounded border px-2 py-1 hover:bg-gray-50"
            >
              Сбросить
            </button>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setOpen(false);
              }}
              className="rounded border px-2 py-1 hover:bg-gray-50"
            >
              Применить
            </button>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setOpen(false);
              }}
              className="ml-auto rounded border px-2 py-1 hover:bg-gray-50"
            >
              Закрыть
            </button>
          </div>
          <div className="max-h-56 overflow-auto rounded border">
            {filteredOptions.map((opt) => {
              const checked = opt.value === value;
              return (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 border-b px-2 py-1.5 text-xs last:border-b-0 hover:bg-sky-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      onChange(opt.value);
                      setOpen(false);
                      setSearch("");
                    }}
                  />
                  <span className="truncate">{opt.label}</span>
                </label>
              );
            })}
            {!filteredOptions.length && <div className="p-2 text-xs text-gray-500">Ничего не найдено</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewSection(props: {
  filters: Filters;
  attributionMode: AttributionMode;
  kpiMode: KpiMode;
  onKpiModeChange: (mode: KpiMode) => void;
  onApplySliceFilter: (sliceId: OverviewSliceId, series: OverviewSliceSeries) => void;
  compare: boolean;
  compareFilters: Filters;
  grain: "day" | "hour";
  periodDays: number;
}) {
  const {
    filters,
    attributionMode,
    kpiMode,
    onKpiModeChange,
    onApplySliceFilter,
    compare,
    compareFilters,
    grain,
    periodDays,
  } = props;

  const keyBase = JSON.stringify(filters);
  const compareKey = JSON.stringify(compareFilters);
  const [impressionsSlice, setImpressionsSlice] = useState<OverviewSliceState>("");
  const [clicksSlice, setClicksSlice] = useState<OverviewSliceState>("");
  const [viewabilitySlice, setViewabilitySlice] = useState<OverviewSliceState>("");
  const [spendSlice, setSpendSlice] = useState<OverviewSliceState>("");
  const [conversionsSlice, setConversionsSlice] = useState<OverviewSliceState>("");
  const [conversionsMetricMode, setConversionsMetricMode] = useState<ConversionsMetricMode>("totalConversions");
  const [ivtSlice, setIvtSlice] = useState<IvtSliceState>("");
  const [heatmapMetric, setHeatmapMetric] = useState<HeatmapMetricId>("impressions");

  const impressionsSliceOptions: SliceOption<OverviewSliceId>[] = [
    { value: "campaign", label: "Кампания" },
    { value: "supplier", label: "Поставщик" },
    { value: "placement", label: "Размещение" },
    { value: "placementEnvironment", label: "Среда размещения" },
  ];
  const clicksSliceOptions: SliceOption<OverviewSliceId>[] = [
    { value: "campaign", label: "Кампания" },
    { value: "supplier", label: "Поставщик" },
    { value: "placement", label: "Размещение" },
    { value: "creative", label: "Креатив" },
    { value: "placementEnvironment", label: "Среда размещения" },
  ];
  const viewabilitySliceOptions: SliceOption<OverviewSliceId>[] = [
    { value: "campaign", label: "Кампания" },
    { value: "supplier", label: "Поставщик" },
    { value: "placement", label: "Размещение" },
    { value: "creative", label: "Креатив" },
    { value: "domain", label: "Домен" },
    { value: "placementEnvironment", label: "Среда размещения" },
  ];
  const spendSliceOptions: SliceOption<OverviewSliceId>[] = [
    { value: "campaign", label: "Кампания" },
    { value: "supplier", label: "Поставщик" },
    { value: "placement", label: "Размещение" },
    { value: "format", label: "Формат" },
  ];
  const conversionsSliceOptions: SliceOption<OverviewSliceId>[] = [
    { value: "campaign", label: "Кампания" },
    { value: "supplier", label: "Поставщик" },
    { value: "placement", label: "Размещение" },
    { value: "creative", label: "Креатив" },
    { value: "placementEnvironment", label: "Среда размещения" },
  ];
  const conversionsMetricOptions: SliceOption<ConversionsMetricMode>[] = [
    { value: "totalConversions", label: "Всего" },
    { value: "postViewConv", label: "Post-view" },
    { value: "postClickConv", label: "Post-click" },
  ];
  const ivtSliceOptions: SliceOption<IvtSliceId>[] = [
    { value: "qualitySplit", label: "GIVT% / SIVT%" },
    { value: "supplier", label: "Поставщик" },
    { value: "placement", label: "Размещение" },
    { value: "domain", label: "Домен" },
    { value: "placementEnvironment", label: "Среда размещения" },
    { value: "deviceType", label: "Устройство" },
  ];
  const heatmapMetricOptions: SliceOption<HeatmapMetricId>[] = [
    { value: "ivt", label: "IVT" },
    { value: "impressions", label: "Показы" },
    { value: "clicks", label: "Клики" },
    { value: "conversions", label: "Конверсии" },
  ];

  const generalKpisRes = useAsyncResource(
    `ov-kpi-general-${keyBase}`,
    () => selectOverviewGeneralKpis(filters),
    EMPTY_RESPONSE
  );
  const compareGeneralRes = useAsyncResource(
    `ov-kpi-general-prev-${compare ? compareKey : "off"}`,
    () => (compare ? selectOverviewGeneralKpis(compareFilters) : EMPTY_RESPONSE),
    EMPTY_RESPONSE
  );
  const videoKpisRes = useAsyncResource(
    `ov-kpi-video-${keyBase}`,
    () => selectOverviewVideoKpis(filters),
    EMPTY_RESPONSE
  );
  const videoAvailabilityRes = useAsyncResource(
    `ov-video-availability-${keyBase}`,
    () => selectVideoAvailability(filters),
    EMPTY_RESPONSE
  );
  const impressionsRes = useAsyncResource(
    `ov-imp-${keyBase}`,
    () => selectSeries(filters, "impressions"),
    EMPTY_RESPONSE
  );
  const clicksRes = useAsyncResource(`ov-clicks-${keyBase}`, () => selectSeries(filters, "clicks"), EMPTY_RESPONSE);
  const viewabilityRes = useAsyncResource(
    `ov-viewability-${keyBase}`,
    () => selectSeries(filters, "viewabilityRate"),
    EMPTY_RESPONSE
  );
  const ivtRes = useAsyncResource(`ov-ivt-${keyBase}`, () => selectSeries(filters, "ivtRate"), EMPTY_RESPONSE);
  const givtRes = useAsyncResource(`ov-givt-${keyBase}`, () => selectSeries(filters, "givtRate"), EMPTY_RESPONSE);
  const sivtRes = useAsyncResource(`ov-sivt-${keyBase}`, () => selectSeries(filters, "sivtRate"), EMPTY_RESPONSE);
  const impressionsPrevRes = useAsyncResource(
    `ov-imp-prev-${compare ? compareKey : "off"}`,
    () => (compare ? selectSeries(compareFilters, "impressions") : EMPTY_RESPONSE),
    EMPTY_RESPONSE
  );
  const clicksPrevRes = useAsyncResource(
    `ov-clicks-prev-${compare ? compareKey : "off"}`,
    () => (compare ? selectSeries(compareFilters, "clicks") : EMPTY_RESPONSE),
    EMPTY_RESPONSE
  );
  const viewabilityPrevRes = useAsyncResource(
    `ov-viewability-prev-${compare ? compareKey : "off"}`,
    () => (compare ? selectSeries(compareFilters, "viewabilityRate") : EMPTY_RESPONSE),
    EMPTY_RESPONSE
  );
  const ivtPrevRes = useAsyncResource(
    `ov-ivt-prev-${compare ? compareKey : "off"}`,
    () => (compare ? selectSeries(compareFilters, "ivtRate") : EMPTY_RESPONSE),
    EMPTY_RESPONSE
  );
  const givtPrevRes = useAsyncResource(
    `ov-givt-prev-${compare ? compareKey : "off"}`,
    () => (compare ? selectSeries(compareFilters, "givtRate") : EMPTY_RESPONSE),
    EMPTY_RESPONSE
  );
  const sivtPrevRes = useAsyncResource(
    `ov-sivt-prev-${compare ? compareKey : "off"}`,
    () => (compare ? selectSeries(compareFilters, "sivtRate") : EMPTY_RESPONSE),
    EMPTY_RESPONSE
  );
  const spendSeriesRes = useAsyncResource(
    `ov-spend-series-${keyBase}`,
    () => selectSpendTimeseries(filters),
    EMPTY_RESPONSE
  );
  const spendSeriesPrevRes = useAsyncResource(
    `ov-spend-series-prev-${compare ? compareKey : "off"}`,
    () => (compare ? selectSpendTimeseries(compareFilters) : EMPTY_RESPONSE),
    EMPTY_RESPONSE
  );
  const impressionsBreakdownRes = useAsyncResource(
    `ov-imp-breakdown-${impressionsSlice || "base"}-${keyBase}`,
    () =>
      impressionsSlice
        ? selectSeriesBreakdown(filters, "impressions", OVERVIEW_SLICE_CONFIG[impressionsSlice].dimensions)
        : EMPTY_RESPONSE,
    EMPTY_RESPONSE
  );
  const clicksBreakdownRes = useAsyncResource(
    `ov-clicks-breakdown-${clicksSlice || "base"}-${keyBase}`,
    () =>
      clicksSlice
        ? selectSeriesBreakdown(filters, "clicks", OVERVIEW_SLICE_CONFIG[clicksSlice].dimensions)
        : EMPTY_RESPONSE,
    EMPTY_RESPONSE
  );
  const viewabilityBreakdownRes = useAsyncResource(
    `ov-viewability-breakdown-${viewabilitySlice || "base"}-${keyBase}`,
    () =>
      viewabilitySlice
        ? selectSeriesBreakdown(filters, "viewabilityRate", OVERVIEW_SLICE_CONFIG[viewabilitySlice].dimensions)
        : EMPTY_RESPONSE,
    EMPTY_RESPONSE
  );
  const spendBreakdownRes = useAsyncResource(
    `ov-spend-breakdown-${spendSlice || "base"}-${keyBase}`,
    () =>
      spendSlice
        ? selectSeriesBreakdown(filters, "spend", OVERVIEW_SLICE_CONFIG[spendSlice].dimensions)
        : EMPTY_RESPONSE,
    EMPTY_RESPONSE
  );
  const conversionsSeriesRes = useAsyncResource(
    `ov-conv-series-${keyBase}`,
    () => selectConversionsTimeseries(filters),
    EMPTY_RESPONSE
  );
  const conversionsBreakdownRes = useAsyncResource(
    `ov-conv-breakdown-${conversionsMetricMode}-${conversionsSlice || "base"}-${keyBase}`,
    () =>
      conversionsSlice
        ? selectSeriesBreakdown(filters, conversionsMetricMode, OVERVIEW_SLICE_CONFIG[conversionsSlice].dimensions)
        : EMPTY_RESPONSE,
    EMPTY_RESPONSE
  );
  const conversionsSeriesPrevRes = useAsyncResource(
    `ov-conv-series-prev-${compare ? compareKey : "off"}`,
    () => (compare ? selectConversionsTimeseries(compareFilters) : EMPTY_RESPONSE),
    EMPTY_RESPONSE
  );
  const ivtBreakdownRes = useAsyncResource(
    `ov-ivt-breakdown-${ivtSlice || "base"}-${keyBase}`,
    () =>
      ivtSlice && ivtSlice !== "qualitySplit"
        ? selectSeriesBreakdown(filters, "ivtRate", OVERVIEW_SLICE_CONFIG[ivtSlice].dimensions)
        : EMPTY_RESPONSE,
    EMPTY_RESPONSE
  );
  const topDomainsRes = useAsyncResource(
    `ov-domains-${keyBase}`,
    () => selectOverviewTopDomains(filters),
    EMPTY_RESPONSE
  );
  const topGeosRes = useAsyncResource(`ov-geos-${keyBase}`, () => selectOverviewTopGeos(filters), EMPTY_RESPONSE);
  const frequencyDistributionRes = useAsyncResource(
    `ov-frequency-distribution-${keyBase}`,
    () => ({ rows: selectAudienceFrequencyDistribution(filters), meta: EMPTY_RESPONSE.meta }),
    { rows: selectAudienceFrequencyDistribution(filters), meta: EMPTY_RESPONSE.meta }
  );
  const heatmapMetricConfig = {
    ivt: {
      title: "Тепловая карта: день × час (IVT)",
      metrics: ["impressions", "validImpressions"] as Metric[],
      getValue: (row: Record<string, unknown>) => Math.max(0, safeNumber(row.impressions) - safeNumber(row.validImpressions)),
      formatValue: (value: number) => fmtInt(value),
    },
    impressions: {
      title: "Тепловая карта: день × час (показы)",
      metrics: ["impressions"] as Metric[],
      getValue: (row: Record<string, unknown>) => safeNumber(row.impressions),
      formatValue: (value: number) => fmtInt(value),
    },
    clicks: {
      title: "Тепловая карта: день × час (клики)",
      metrics: ["clicks"] as Metric[],
      getValue: (row: Record<string, unknown>) => safeNumber(row.clicks),
      formatValue: (value: number) => fmtInt(value),
    },
    conversions: {
      title: "Тепловая карта: день × час (конверсии)",
      metrics: ["totalConversions"] as Metric[],
      getValue: (row: Record<string, unknown>) => safeNumber(row.totalConversions),
      formatValue: (value: number) => fmtInt(value),
    },
  } satisfies Record<
    HeatmapMetricId,
    {
      title: string;
      metrics: Metric[];
      getValue: (row: Record<string, unknown>) => number;
      formatValue: (value: number) => string;
    }
  >;
  const heatmapRes = useAsyncResource(
    `ov-heatmap-${heatmapMetric}-${keyBase}`,
    () =>
      query({
        filters,
        dimensions: ["date", "hour"],
        metrics: heatmapMetricConfig[heatmapMetric].metrics,
        sort: [
          { field: "date", dir: "asc" },
          { field: "hour", dir: "asc" },
        ],
      }),
    EMPTY_RESPONSE
  );
  const selectedHeatmapMetric = heatmapMetricConfig[heatmapMetric];

  const generalKpiRow = (generalKpisRes.data.rows[0] ?? {}) as Record<string, unknown>;
  const prevGeneralKpiRow = (compareGeneralRes.data.rows[0] ?? {}) as Record<string, unknown>;
  const videoKpiRow = (videoKpisRes.data.rows[0] ?? {}) as Record<string, unknown>;

  const videoAvailableByFormat = (videoAvailabilityRes.data.rows as Record<string, unknown>[]).some((row) => {
    return String(row.format ?? "") === "video" && safeNumber(row.impressions) > 0;
  });
  const videoAvailableByStart = safeNumber(videoKpiRow.vastStart) > 0;
  const videoAvailable = videoAvailableByFormat || videoAvailableByStart;

  const hasConversionData =
    safeNumber(generalKpiRow.postViewConv) + safeNumber(generalKpiRow.postClickConv) > 0;

  const timeline = useMemo(() => {
    type Point = {
      label: string;
      impressions: number;
      impressionsPrev: number;
      clicks: number;
      clicksPrev: number;
      ctr: number;
      ctrPrev: number;
      viewabilityRate: number;
      viewabilityRatePrev: number;
      ivtRate: number;
      givtRate: number;
      sivtRate: number;
      ivtRatePrev: number;
      givtRatePrev: number;
      sivtRatePrev: number;
    };

    const map = new Map<string, Point>();

    const touch = (row: Record<string, unknown>) => {
      const label = buildTimelineLabel(row, grain);
      const existing = map.get(label);
      if (existing) return existing;
      const created: Point = {
        label,
        impressions: 0,
        impressionsPrev: 0,
        clicks: 0,
        clicksPrev: 0,
        ctr: 0,
        ctrPrev: 0,
        viewabilityRate: 0,
        viewabilityRatePrev: 0,
        ivtRate: 0,
        givtRate: 0,
        sivtRate: 0,
        ivtRatePrev: 0,
        givtRatePrev: 0,
        sivtRatePrev: 0,
      };
      map.set(label, created);
      return created;
    };

    (impressionsRes.data.rows as Record<string, unknown>[]).forEach((row) => {
      touch(row).impressions = safeNumber(row.impressions);
    });
    (impressionsPrevRes.data.rows as Record<string, unknown>[]).forEach((row) => {
      touch(row).impressionsPrev = safeNumber(row.impressions);
    });
    (clicksRes.data.rows as Record<string, unknown>[]).forEach((row) => {
      touch(row).clicks = safeNumber(row.clicks);
    });
    (clicksPrevRes.data.rows as Record<string, unknown>[]).forEach((row) => {
      touch(row).clicksPrev = safeNumber(row.clicks);
    });
    (viewabilityRes.data.rows as Record<string, unknown>[]).forEach((row) => {
      touch(row).viewabilityRate = safeNumber(row.viewabilityRate);
    });
    (viewabilityPrevRes.data.rows as Record<string, unknown>[]).forEach((row) => {
      touch(row).viewabilityRatePrev = safeNumber(row.viewabilityRate);
    });
    (ivtRes.data.rows as Record<string, unknown>[]).forEach((row) => {
      touch(row).ivtRate = safeNumber(row.ivtRate);
    });
    (givtRes.data.rows as Record<string, unknown>[]).forEach((row) => {
      touch(row).givtRate = safeNumber(row.givtRate);
    });
    (sivtRes.data.rows as Record<string, unknown>[]).forEach((row) => {
      touch(row).sivtRate = safeNumber(row.sivtRate);
    });
    (ivtPrevRes.data.rows as Record<string, unknown>[]).forEach((row) => {
      touch(row).ivtRatePrev = safeNumber(row.ivtRate);
    });
    (givtPrevRes.data.rows as Record<string, unknown>[]).forEach((row) => {
      touch(row).givtRatePrev = safeNumber(row.givtRate);
    });
    (sivtPrevRes.data.rows as Record<string, unknown>[]).forEach((row) => {
      touch(row).sivtRatePrev = safeNumber(row.sivtRate);
    });

    map.forEach((point) => {
      point.ctr = point.impressions > 0 ? point.clicks / point.impressions : 0;
      point.ctrPrev = point.impressionsPrev > 0 ? point.clicksPrev / point.impressionsPrev : 0;
    });

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [
    impressionsRes.data.rows,
    impressionsPrevRes.data.rows,
    clicksRes.data.rows,
    clicksPrevRes.data.rows,
    viewabilityRes.data.rows,
    viewabilityPrevRes.data.rows,
    ivtRes.data.rows,
    givtRes.data.rows,
    sivtRes.data.rows,
    ivtPrevRes.data.rows,
    givtPrevRes.data.rows,
    sivtPrevRes.data.rows,
    grain,
  ]);

  const topDomains = useMemo(() => {
    return (topDomainsRes.data.rows as Record<string, unknown>[]).map((row) => ({
      domain: String(row.domain ?? "—"),
      impressions: safeNumber(row.impressions),
      reach: safeNumber(row.reach),
      clicks: safeNumber(row.clicks),
      ctr: safeNumber(row.ctr),
      ivtRate: safeNumber(row.ivtRate),
      brandSafetyRate: safeNumber(row.brandSafetyRate),
    }));
  }, [topDomainsRes.data.rows]);

  const topGeos = useMemo(() => {
    return (topGeosRes.data.rows as Record<string, unknown>[]).map((row) => ({
      geo: String(row.geo ?? "—"),
      impressions: safeNumber(row.impressions),
      reach: safeNumber(row.reach),
      clicks: safeNumber(row.clicks),
      ctr: safeNumber(row.ctr),
    }));
  }, [topGeosRes.data.rows]);

  const frequencyDistribution = useMemo(
    () =>
      (frequencyDistributionRes.data.rows as Record<string, unknown>[]).map((row) => ({
        bucket: String(row.bucket ?? "—"),
        reach: safeNumber(row.reach),
        reachShare: safeNumber(row.reachShare),
      })),
    [frequencyDistributionRes.data.rows]
  );

  const heatmapRows = useMemo(() => {
    return (heatmapRes.data.rows as Record<string, unknown>[]).map((row) => ({
      date: String(row.date ?? ""),
      hour: safeNumber(row.hour),
      value: selectedHeatmapMetric.getValue(row),
    }));
  }, [heatmapRes.data.rows, selectedHeatmapMetric]);

  const heatmapDays = useMemo(() => Array.from(new Set(heatmapRows.map((r) => r.date))), [heatmapRows]);
  const maxHeatmapValue = useMemo(() => Math.max(1, ...heatmapRows.map((r) => r.value)), [heatmapRows]);

  const showHeatmap = grain === "hour" && periodDays <= 7;

  const spendTimeline = useMemo(() => {
    const currentRows = spendSeriesRes.data.rows as Record<string, unknown>[];
    const prevRows = spendSeriesPrevRes.data.rows as Record<string, unknown>[];

    return currentRows.map((row, idx) => ({
      label: buildTimelineLabel(row, grain),
      current: safeNumber(row.spend),
      prev: compare ? safeNumber(prevRows[idx]?.spend) : 0,
    }));
  }, [spendSeriesRes.data.rows, spendSeriesPrevRes.data.rows, grain, compare]);

  const impressionsBreakdown = useMemo(
    () =>
      impressionsSlice
        ? buildOverviewBreakdownTimeline(
            impressionsBreakdownRes.data.rows as Record<string, unknown>[],
            grain,
            "impressions",
            impressionsSlice
          )
        : { data: [], series: [], hasOthers: false, hiddenSummary: null },
    [grain, impressionsBreakdownRes.data.rows, impressionsSlice]
  );
  const clicksBreakdown = useMemo(
    () =>
      clicksSlice
        ? buildOverviewBreakdownTimeline(
            clicksBreakdownRes.data.rows as Record<string, unknown>[],
            grain,
            "clicks",
            clicksSlice
          )
        : { data: [], series: [], hasOthers: false, hiddenSummary: null },
    [grain, clicksBreakdownRes.data.rows, clicksSlice]
  );
  const viewabilityBreakdown = useMemo(
    () =>
      viewabilitySlice
        ? buildOverviewBreakdownTimeline(
            viewabilityBreakdownRes.data.rows as Record<string, unknown>[],
            grain,
            "viewabilityRate",
            viewabilitySlice
          )
        : { data: [], series: [], hasOthers: false, hiddenSummary: null },
    [grain, viewabilityBreakdownRes.data.rows, viewabilitySlice]
  );
  const spendBreakdown = useMemo(
    () =>
      spendSlice
        ? buildOverviewBreakdownTimeline(
            spendBreakdownRes.data.rows as Record<string, unknown>[],
            grain,
            "spend",
            spendSlice
          )
        : { data: [], series: [], hasOthers: false, hiddenSummary: null },
    [grain, spendBreakdownRes.data.rows, spendSlice]
  );
  const conversionsBreakdown = useMemo(
    () =>
      conversionsSlice
        ? buildOverviewBreakdownTimeline(
            conversionsBreakdownRes.data.rows as Record<string, unknown>[],
            grain,
            conversionsMetricMode,
            conversionsSlice
          )
        : { data: [], series: [], hasOthers: false, hiddenSummary: null },
    [conversionsBreakdownRes.data.rows, conversionsSlice, conversionsMetricMode, grain]
  );
  const ivtBreakdown = useMemo(
    () =>
      ivtSlice && ivtSlice !== "qualitySplit"
        ? buildOverviewBreakdownTimeline(
            ivtBreakdownRes.data.rows as Record<string, unknown>[],
            grain,
            "ivtRate",
            ivtSlice
          )
        : { data: [], series: [], hasOthers: false, hiddenSummary: null },
    [grain, ivtBreakdownRes.data.rows, ivtSlice]
  );

  const conversionsTimeline = useMemo(() => {
    const currentRows = conversionsSeriesRes.data.rows as Record<string, unknown>[];
    const prevRows = conversionsSeriesPrevRes.data.rows as Record<string, unknown>[];

    return currentRows.map((row, idx) => ({
      label: buildTimelineLabel(row, grain),
      current: safeNumber(row[conversionsMetricMode]),
      prev: compare ? safeNumber(prevRows[idx]?.[conversionsMetricMode]) : 0,
    }));
  }, [conversionsSeriesRes.data.rows, conversionsSeriesPrevRes.data.rows, grain, compare, conversionsMetricMode]);

  const selectedConversionsMetricMeta = useMemo(() => {
    if (conversionsMetricMode === "postViewConv") {
      return { title: "Конверсии post-view", empty: "Нет данных по post-view конверсиям" };
    }
    if (conversionsMetricMode === "postClickConv") {
      return { title: "Конверсии post-click", empty: "Нет данных по post-click конверсиям" };
    }
    return { title: "Всего конверсий", empty: "Нет данных по конверсиям" };
  }, [conversionsMetricMode]);

  const allLoading =
    generalKpisRes.loading ||
    videoKpisRes.loading ||
    videoAvailabilityRes.loading ||
    impressionsRes.loading ||
    clicksRes.loading ||
    viewabilityRes.loading ||
    ivtRes.loading ||
    givtRes.loading ||
    sivtRes.loading ||
    impressionsPrevRes.loading ||
    clicksPrevRes.loading ||
    viewabilityPrevRes.loading ||
    ivtPrevRes.loading ||
    givtPrevRes.loading ||
    sivtPrevRes.loading ||
    spendSeriesRes.loading ||
    conversionsSeriesRes.loading ||
    topDomainsRes.loading ||
    topGeosRes.loading;

  type OverviewMetricId =
    | "impressions"
    | "validImpressions"
    | "cookieImpressions"
    | "measurableIab"
    | "viewableImpressions"
    | "viewabilityRate"
    | "reach"
    | "frequency"
    | "clicks"
    | "validClicks"
    | "cookieClicks"
    | "ivtImpressions"
    | "ivtClicks"
    | "ivtClickRate"
    | "ctr"
    | "ivtRate"
    | "brandSafetyRate"
    | "vastStart"
    | "vcr100"
    | "totalConversions"
    | "postViewConv"
    | "postClickConv"
    | "associatedConversions"
    | "incrementalConversions"
    | "spend"
    | "cpm"
    | "cpc"
    | "cpa";

  const renderMetricCard = (id: OverviewMetricId) => {
    if (id === "impressions") {
      return (
        <MetricCard
          key={id}
          title="Показы"
          value={fmtInt(safeNumber(generalKpiRow.impressions))}
          metricKey="impressions"
          delta={
            compare
              ? calcDelta(safeNumber(generalKpiRow.impressions), safeNumber(prevGeneralKpiRow.impressions))
              : null
          }
        />
      );
    }
    if (id === "validImpressions") {
      return (
        <MetricCard
          key={id}
          title="Засчитанные показы"
          value={fmtInt(safeNumber(generalKpiRow.validImpressions))}
          metricKey="validImpressions"
          delta={
            compare
              ? calcDelta(
                  safeNumber(generalKpiRow.validImpressions),
                  safeNumber(prevGeneralKpiRow.validImpressions)
                )
              : null
          }
        />
      );
    }
    if (id === "cookieImpressions") {
      return (
        <MetricCard
          key={id}
          title="Показы с кукой"
          value={fmtInt(safeNumber(generalKpiRow.cookieImpressions))}
          metricKey="cookieImpressions"
          delta={
            compare
              ? calcDelta(
                  safeNumber(generalKpiRow.cookieImpressions),
                  safeNumber(prevGeneralKpiRow.cookieImpressions)
                )
              : null
          }
        />
      );
    }
    if (id === "measurableIab") {
      return (
        <MetricCard
          key={id}
          title="Измеримые показы"
          value={fmtInt(safeNumber(generalKpiRow.measurableIab))}
          metricKey="measurableIab"
          delta={
            compare
              ? calcDelta(safeNumber(generalKpiRow.measurableIab), safeNumber(prevGeneralKpiRow.measurableIab))
              : null
          }
        />
      );
    }
    if (id === "viewableImpressions") {
      return (
        <MetricCard
          key={id}
          title="Видимые показы"
          value={fmtInt(safeNumber(generalKpiRow.viewableImpressions))}
          metricKey="viewableImpressions"
        />
      );
    }
    if (id === "viewabilityRate") {
      return (
        <MetricCard
          key={id}
          title="Видимость, %"
          value={fmtPercent(safeNumber(generalKpiRow.viewabilityRate))}
          metricKey="viewabilityRate"
          delta={
            compare
              ? calcDelta(
                  safeNumber(generalKpiRow.viewabilityRate),
                  safeNumber(prevGeneralKpiRow.viewabilityRate)
                )
              : null
          }
        />
      );
    }
    if (id === "reach") {
      return (
        <MetricCard
          key={id}
          title="Охват"
          value={fmtInt(safeNumber(generalKpiRow.reach))}
          metricKey="reach"
          delta={compare ? calcDelta(safeNumber(generalKpiRow.reach), safeNumber(prevGeneralKpiRow.reach)) : null}
        />
      );
    }
    if (id === "frequency") {
      return (
        <MetricCard
          key={id}
          title="Частота"
          value={fmtFloat(safeNumber(generalKpiRow.frequency))}
          metricKey="frequency"
        />
      );
    }
    if (id === "spend") {
      return (
        <MetricCard
          key={id}
          title="Затраты"
          value={fmtCurrency(safeNumber(generalKpiRow.spend))}
          metricKey="spend"
          delta={compare ? calcDelta(safeNumber(generalKpiRow.spend), safeNumber(prevGeneralKpiRow.spend)) : null}
        />
      );
    }
    if (id === "clicks") {
      return (
        <MetricCard
          key={id}
          title="Клики"
          value={fmtInt(safeNumber(generalKpiRow.clicks))}
          metricKey="clicks"
          delta={compare ? calcDelta(safeNumber(generalKpiRow.clicks), safeNumber(prevGeneralKpiRow.clicks)) : null}
        />
      );
    }
    if (id === "validClicks") {
      return (
        <MetricCard
          key={id}
          title="Засчитанные клики"
          value={fmtInt(safeNumber(generalKpiRow.validClicks))}
          metricKey="validClicks"
        />
      );
    }
    if (id === "cookieClicks") {
      return (
        <MetricCard
          key={id}
          title="Клики с кукой"
          value={fmtInt(safeNumber(generalKpiRow.cookieClicks))}
          metricKey="cookieClicks"
          delta={
            compare
              ? calcDelta(safeNumber(generalKpiRow.cookieClicks), safeNumber(prevGeneralKpiRow.cookieClicks))
              : null
          }
        />
      );
    }
    if (id === "ivtImpressions") {
      const currentIvtImpressions = Math.max(
        0,
        safeNumber(generalKpiRow.impressions) - safeNumber(generalKpiRow.validImpressions)
      );
      const prevIvtImpressions = Math.max(
        0,
        safeNumber(prevGeneralKpiRow.impressions) - safeNumber(prevGeneralKpiRow.validImpressions)
      );
      return (
        <MetricCard
          key={id}
          title="IVT показы"
          value={fmtInt(currentIvtImpressions)}
          metricKey="ivtImpressions"
          delta={compare ? calcDelta(currentIvtImpressions, prevIvtImpressions) : null}
        />
      );
    }
    if (id === "ivtClicks") {
      return (
        <MetricCard
          key={id}
          title="IVT клики"
          value={fmtInt(safeNumber(generalKpiRow.ivtClicks))}
          metricKey="ivtClicks"
        />
      );
    }
    if (id === "ivtClickRate") {
      return (
        <MetricCard
          key={id}
          title="IVT клики, %"
          value={fmtPercent(safeNumber(generalKpiRow.ivtClickRate))}
          metricKey="ivtClickRate"
        />
      );
    }
    if (id === "ctr") {
      return (
        <MetricCard key={id} title="CTR" value={fmtPercent(safeNumber(generalKpiRow.ctr))} metricKey="ctr" />
      );
    }
    if (id === "cpm") {
      return (
        <MetricCard
          key={id}
          title="CPM"
          value={safeNumber(generalKpiRow.impressions) > 0 ? fmtCurrency(safeNumber(generalKpiRow.cpm)) : "—"}
          metricKey="cpm"
          delta={
            compare && safeNumber(prevGeneralKpiRow.impressions) > 0
              ? calcDelta(safeNumber(generalKpiRow.cpm), safeNumber(prevGeneralKpiRow.cpm))
              : null
          }
        />
      );
    }
    if (id === "cpc") {
      return (
        <MetricCard
          key={id}
          title="CPC"
          value={safeNumber(generalKpiRow.clicks) > 0 ? fmtCurrency(safeNumber(generalKpiRow.cpc)) : "—"}
          metricKey="cpc"
          delta={
            compare && safeNumber(prevGeneralKpiRow.clicks) > 0
              ? calcDelta(safeNumber(generalKpiRow.cpc), safeNumber(prevGeneralKpiRow.cpc))
              : null
          }
        />
      );
    }
    if (id === "ivtRate") {
      return (
        <MetricCard
          key={id}
          title="IVT показы, %"
          value={fmtPercent(safeNumber(generalKpiRow.ivtRate))}
          metricKey="ivtRate"
          delta={
            compare ? calcDelta(safeNumber(generalKpiRow.ivtRate), safeNumber(prevGeneralKpiRow.ivtRate)) : null
          }
        />
      );
    }
    if (id === "brandSafetyRate") {
      return (
        <MetricCard
          key={id}
          title="Brand Safety, %"
          value={fmtPercent(safeNumber(generalKpiRow.brandSafetyRate))}
          metricKey="brandSafetyRate"
        />
      );
    }
    if (id === "vastStart") {
      return (
        <MetricCard
          key={id}
          title="Старты видео"
          value={fmtInt(safeNumber(videoKpiRow.vastStart))}
          metricKey="vastStart"
        />
      );
    }
    if (id === "vcr100") {
      return (
        <MetricCard
          key={id}
          title="VCR100 / досмотры до 100%"
          value={fmtPercent(safeNumber(videoKpiRow.vcr100))}
          metricKey="vcr100"
        />
      );
    }
    if (id === "totalConversions") {
      return (
        <MetricCard
          key={id}
          title="Всего конверсий"
          value={fmtInt(safeNumber(generalKpiRow.totalConversions))}
          metricKey="totalConversions"
          delta={
            compare
              ? calcDelta(safeNumber(generalKpiRow.totalConversions), safeNumber(prevGeneralKpiRow.totalConversions))
              : null
          }
          disabled={!hasConversionData}
          disabledHint="Нет данных в прототипе"
        />
      );
    }
    if (id === "cpa") {
      return (
        <MetricCard
          key={id}
          title="CPA"
          value={safeNumber(generalKpiRow.totalConversions) > 0 ? fmtCurrency(safeNumber(generalKpiRow.cpa)) : "—"}
          metricKey="cpa"
          delta={
            compare && safeNumber(prevGeneralKpiRow.totalConversions) > 0
              ? calcDelta(safeNumber(generalKpiRow.cpa), safeNumber(prevGeneralKpiRow.cpa))
              : null
          }
          disabled={!hasConversionData}
          disabledHint="Нет данных в прототипе"
        />
      );
    }
    if (id === "postViewConv") {
      return (
        <MetricCard
          key={id}
          title="Конверсии post-view"
          value={fmtInt(safeNumber(generalKpiRow.postViewConv))}
          metricKey="postViewConv"
          highlighted={attributionMode === "post-view"}
          disabled={!hasConversionData}
          disabledHint="Нет данных в прототипе"
        />
      );
    }
    if (id === "postClickConv") {
      return (
        <MetricCard
          key={id}
          title="Конверсии post-click"
          value={fmtInt(safeNumber(generalKpiRow.postClickConv))}
          metricKey="postClickConv"
          highlighted={attributionMode === "post-click"}
          disabled={!hasConversionData}
          disabledHint="Нет данных в прототипе"
        />
      );
    }
    if (id === "associatedConversions") {
      return (
        <MetricCard
          key={id}
          title="Ассоциированные конверсии"
          value={fmtInt(safeNumber(generalKpiRow.associatedConversions))}
          metricKey="associatedConversions"
          disabled={!hasConversionData}
          disabledHint="Нет данных в прототипе"
        />
      );
    }
    return (
      <MetricCard
        key={id}
        title="Инкрементальные конверсии"
        value={fmtInt(safeNumber(generalKpiRow.incrementalConversions))}
        metricKey="incrementalConversions"
        delta={
          compare
            ? calcDelta(
                safeNumber(generalKpiRow.incrementalConversions),
                safeNumber(prevGeneralKpiRow.incrementalConversions)
              )
            : null
        }
        disabled={!hasConversionData}
        disabledHint="Нет данных в прототипе"
      />
    );
  };

  const generalMetricIds: OverviewMetricId[] = [
    "validImpressions",
    "cookieImpressions",
    "reach",
    "frequency",
    "validClicks",
    "cookieClicks",
    "ctr",
    "ivtImpressions",
    "ivtRate",
    "ivtClicks",
    "ivtClickRate",
    "measurableIab",
    "viewableImpressions",
    "viewabilityRate",
    "brandSafetyRate",
  ];
  const videoMetricIds: OverviewMetricId[] = videoAvailable ? ["vastStart", "vcr100"] : [];
  const conversionMetricIds: OverviewMetricId[] = [
    "totalConversions",
    "postViewConv",
    "postClickConv",
    "associatedConversions",
    "incrementalConversions",
  ];
  const budgetMetricIds: OverviewMetricId[] = ["spend", "cpm", "cpc", "cpa"];

  const compactMetricIds: OverviewMetricId[] = [
    "validImpressions",
    "reach",
    "frequency",
    "validClicks",
    "totalConversions",
    "ctr",
  ];

  const totalMetrics =
    generalMetricIds.length + videoMetricIds.length + conversionMetricIds.length + budgetMetricIds.length;
  const shownMetrics = kpiMode === "compact" ? compactMetricIds.length : totalMetrics;

  const renderSliceSelector = <T extends string>(
    activeSlice: T | "",
    onChange: (slice: T | "") => void,
    options: SliceOption<T>[]
  ) => (
    <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max items-center gap-2">
        {options.map((option) => {
          const isActive = activeSlice === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(isActive ? "" : option.value)}
              className={
                isActive
                  ? "h-7 shrink-0 whitespace-nowrap rounded-full border border-sky-600 bg-sky-600 px-2.5 text-[11px] font-medium text-white shadow-sm transition"
                  : "h-7 shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-700 transition hover:border-sky-200 hover:bg-sky-50"
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-xs text-slate-500">Показано {shownMetrics} из {totalMetrics} метрик</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportDashboardDataXlsx(filters)}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Скачать Excel
            </button>
            <button
              type="button"
              onClick={() => onKpiModeChange(kpiMode === "compact" ? "expanded" : "compact")}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {kpiMode === "compact" ? "Развернуть все метрики" : "Свернуть"}
            </button>
          </div>
        </div>

        <div
          className={
            kpiMode === "compact"
              ? "max-h-[360px] overflow-hidden md:max-h-[320px] xl:max-h-[280px]"
              : "max-h-[560px] overflow-auto"
          }
        >
          {allLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {Array.from({ length: 12 }).map((_, idx) => (
                <CardSkeleton key={idx} />
              ))}
            </div>
          ) : kpiMode === "compact" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {compactMetricIds.map((id) => renderMetricCard(id))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              <SectionChip title="Общие метрики" />
              {generalMetricIds.map((id) => renderMetricCard(id))}
              {videoAvailable && (
                <>
                  <SectionChip title="Видео" withTopGap />
                  {videoMetricIds.map((id) => renderMetricCard(id))}
                </>
              )}
              <SectionChip title="Конверсии" subtitle="Учитывает выбранную модель атрибуции" withTopGap />
              {conversionMetricIds.map((id) => renderMetricCard(id))}
              <SectionChip title="Бюджет" withTopGap />
              {budgetMetricIds.map((id) => renderMetricCard(id))}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-slate-900">Показы</h3>
                <p className="text-[11px] text-slate-500">
                  {impressionsSlice ? "Динамика показов по выбранному срезу" : "Динамика показов за период"}
                </p>
              </div>
            </div>
            {renderSliceSelector(impressionsSlice, setImpressionsSlice, impressionsSliceOptions)}
            {impressionsSlice ? (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500">
                {impressionsBreakdown.series.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onApplySliceFilter(impressionsSlice, item)}
                    className="inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 hover:bg-slate-100"
                  >
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color, opacity: 0.9 }} />
                    <span>{item.label}</span>
                  </button>
                ))}
                {!!impressionsBreakdown.hiddenSummary?.count && (
                  <span
                    title={impressionsBreakdown.hiddenSummary.labels.join("\n")}
                    className="inline-flex cursor-help items-center gap-1.5 text-slate-400"
                  >
                    <span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />
                    <span>+ {impressionsBreakdown.hiddenSummary.count}</span>
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#4a90e2]" />
                  <span>Текущий период</span>
                </span>
                {compare && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-4 rounded-full bg-[#b8c1ce]" />
                    <span>Предыдущий период</span>
                  </span>
                )}
              </div>
            )}
          </div>
          {(impressionsSlice ? impressionsBreakdownRes.loading : impressionsRes.loading) ? (
            <div className="p-3">
              <ChartSkeleton />
            </div>
          ) : !impressionsSlice && timeline.length ? (
            <div className="h-80 px-2 pb-2 pt-3">
              <ResponsiveContainer>
                <ComposedChart data={timeline} barCategoryGap={6}>
                  <CartesianGrid vertical={true} horizontal={true} stroke="#e8eef5" />
                  <XAxis
                    dataKey="label"
                    minTickGap={10}
                    tick={{ ...CHART_TICK_STYLE, fontSize: 10 }}
                    angle={-28}
                    textAnchor="end"
                    height={54}
                  />
                  <YAxis tick={{ ...CHART_TICK_STYLE, fontSize: 10 }} tickFormatter={(v) => fmtInt(Number(v))} />
                  <Tooltip
                    formatter={(v) => fmtInt(Number(v))}
                    contentStyle={{
                      ...CHART_TOOLTIP_CONTENT_STYLE,
                      borderRadius: 14,
                      borderColor: "#dbe7f3",
                      boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
                    }}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  />
                  <Bar
                    name="Текущий период"
                    dataKey="impressions"
                    fill="#4a90e2"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={26}
                  />
                  {compare && (
                    <Line
                      name="Предыдущий период"
                      dataKey="impressionsPrev"
                      stroke="#b8c1ce"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      dot={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : impressionsSlice && impressionsBreakdown.data.length ? (
            <div className="h-80 px-2 pb-2 pt-3">
              <ResponsiveContainer>
                <BarChart data={impressionsBreakdown.data} barCategoryGap={6}>
                  <CartesianGrid vertical={true} horizontal={true} stroke="#e8eef5" />
                  <XAxis
                    dataKey="label"
                    minTickGap={10}
                    tick={{ ...CHART_TICK_STYLE, fontSize: 10 }}
                    angle={-28}
                    textAnchor="end"
                    height={54}
                  />
                  <YAxis tick={{ ...CHART_TICK_STYLE, fontSize: 10 }} tickFormatter={(v) => fmtInt(Number(v))} />
                  <Tooltip
                    formatter={(v) => fmtInt(Number(v))}
                    contentStyle={{
                      ...CHART_TOOLTIP_CONTENT_STYLE,
                      borderRadius: 14,
                      borderColor: "#dbe7f3",
                      boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
                    }}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  />
                  {impressionsBreakdown.series.map((series) => (
                    <Bar
                      key={series.key}
                      dataKey={series.key}
                      name={series.label}
                      stackId="impressions"
                      fill={series.color}
                      fillOpacity={0.8}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={30}
                      className="cursor-pointer"
                      onClick={() => onApplySliceFilter(impressionsSlice, series)}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="p-3">
              <EmptyState text="Нет данных по показам" />
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-slate-900">Клики и CTR</h3>
                <p className="text-[11px] text-slate-500">
                  {clicksSlice ? "Динамика кликов с разбивкой и общим CTR" : "Динамика кликов и CTR за период"}
                </p>
              </div>
            </div>
            {renderSliceSelector(clicksSlice, setClicksSlice, clicksSliceOptions)}
            {clicksSlice ? (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded-full bg-[#3da5ff]" />
                  <span>CTR</span>
                </span>
                {clicksBreakdown.series.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onApplySliceFilter(clicksSlice, item)}
                    className="inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 hover:bg-slate-100"
                  >
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color, opacity: 0.9 }} />
                    <span>{item.label}</span>
                  </button>
                ))}
                {!!clicksBreakdown.hiddenSummary?.count && (
                  <span
                    title={clicksBreakdown.hiddenSummary.labels.join("\n")}
                    className="inline-flex cursor-help items-center gap-1.5 text-slate-400"
                  >
                    <span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />
                    <span>+ {clicksBreakdown.hiddenSummary.count}</span>
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#627b80]" />
                  <span>Клики</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded-full bg-[#3da5ff]" />
                  <span>CTR</span>
                </span>
                {compare && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-4 rounded-full bg-[#b8c1ce]" />
                    <span>Предыдущий период</span>
                  </span>
                )}
              </div>
            )}
          </div>
          {(clicksSlice ? clicksBreakdownRes.loading : clicksRes.loading) ? (
            <div className="p-3">
              <ChartSkeleton />
            </div>
          ) : !clicksSlice && timeline.length ? (
            <div className="h-80 px-2 pb-2 pt-3">
              <ResponsiveContainer>
                <ComposedChart data={timeline} barCategoryGap={6}>
                  <CartesianGrid vertical={true} horizontal={true} stroke="#e8eef5" />
                  <XAxis
                    dataKey="label"
                    minTickGap={10}
                    tick={{ ...CHART_TICK_STYLE, fontSize: 10 }}
                    angle={-28}
                    textAnchor="end"
                    height={54}
                  />
                  <YAxis yAxisId="left" tick={{ ...CHART_TICK_STYLE, fontSize: 10 }} tickFormatter={(v) => fmtInt(Number(v))} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ ...CHART_TICK_STYLE, fontSize: 10 }}
                    tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
                  />
                  <Tooltip
                    formatter={(value, name) =>
                      String(name).includes("CTR")
                        ? `${(Number(value) * 100).toFixed(2)}%`
                        : fmtInt(Number(value))
                    }
                    contentStyle={{
                      ...CHART_TOOLTIP_CONTENT_STYLE,
                      borderRadius: 14,
                      borderColor: "#dbe7f3",
                      boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
                    }}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  />
                  <Bar
                    yAxisId="left"
                    name="Клики"
                    dataKey="clicks"
                    fill="#627b80"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={24}
                  />
                  <Line
                    yAxisId="right"
                    name="CTR"
                    dataKey="ctr"
                    type="monotone"
                    stroke="#3da5ff"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#3da5ff", strokeWidth: 0 }}
                    activeDot={{ r: 4 }}
                  />
                  {compare && (
                    <Line
                      yAxisId="left"
                      name="Предыдущий период"
                      dataKey="clicksPrev"
                      stroke="#b8c1ce"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      dot={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : clicksSlice && clicksBreakdown.data.length ? (
            <div className="h-80 px-2 pb-2 pt-3">
              <ResponsiveContainer>
                <ComposedChart data={clicksBreakdown.data} barCategoryGap={6}>
                  <CartesianGrid vertical={true} horizontal={true} stroke="#e8eef5" />
                  <XAxis
                    dataKey="label"
                    minTickGap={10}
                    tick={{ ...CHART_TICK_STYLE, fontSize: 10 }}
                    angle={-28}
                    textAnchor="end"
                    height={54}
                  />
                  <YAxis yAxisId="left" tick={{ ...CHART_TICK_STYLE, fontSize: 10 }} tickFormatter={(v) => fmtInt(Number(v))} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ ...CHART_TICK_STYLE, fontSize: 10 }}
                    tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
                  />
                  <Tooltip
                    formatter={(value, name) =>
                      String(name).includes("CTR")
                        ? `${(Number(value) * 100).toFixed(2)}%`
                        : fmtInt(Number(value))
                    }
                    contentStyle={{
                      ...CHART_TOOLTIP_CONTENT_STYLE,
                      borderRadius: 14,
                      borderColor: "#dbe7f3",
                      boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
                    }}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  />
                  {clicksBreakdown.series.map((series) => (
                    <Bar
                      yAxisId="left"
                      key={series.key}
                      dataKey={series.key}
                      name={series.label}
                      stackId="clicks"
                      fill={series.color}
                      fillOpacity={0.8}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                      className="cursor-pointer"
                      onClick={() => onApplySliceFilter(clicksSlice, series)}
                    />
                  ))}
                  <Line
                    yAxisId="right"
                    name="CTR"
                    dataKey={(entry: Record<string, unknown>) => {
                      const label = String(entry.label ?? "");
                      const point = timeline.find((item) => item.label === label);
                      return point?.ctr ?? 0;
                    }}
                    type="monotone"
                    stroke="#3da5ff"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#3da5ff", strokeWidth: 0 }}
                    activeDot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="p-3">
              <EmptyState text="Нет данных по кликам" />
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-slate-900">Видимость (IAB), %</h3>
              </div>
            </div>
            {renderSliceSelector(viewabilitySlice, setViewabilitySlice, viewabilitySliceOptions)}
            {viewabilitySlice ? (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500">
                {viewabilityBreakdown.series.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onApplySliceFilter(viewabilitySlice, item)}
                    className="inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 hover:bg-slate-100"
                  >
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color, opacity: 0.9 }} />
                    <span>{item.label}</span>
                  </button>
                ))}
                {!!viewabilityBreakdown.hiddenSummary?.count && (
                  <span
                    title={viewabilityBreakdown.hiddenSummary.labels.join("\n")}
                    className="inline-flex cursor-help items-center gap-1.5 text-slate-400"
                  >
                    <span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />
                    <span>+ {viewabilityBreakdown.hiddenSummary.count}</span>
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#35a8e0]" />
                  <span>Текущий период</span>
                </span>
                {compare && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-4 rounded-full bg-[#b8c1ce]" />
                    <span>Предыдущий период</span>
                  </span>
                )}
              </div>
            )}
          </div>
          {(viewabilitySlice ? viewabilityBreakdownRes.loading : viewabilityRes.loading) ? (
            <div className="p-3">
              <ChartSkeleton />
            </div>
          ) : !viewabilitySlice && timeline.length ? (
            <div className="h-80 px-2 pb-2 pt-3">
              <ResponsiveContainer>
                <LineChart data={timeline}>
                  <CartesianGrid vertical={true} horizontal={true} stroke="#e8eef5" />
                  <XAxis
                    dataKey="label"
                    minTickGap={10}
                    tick={{ ...CHART_TICK_STYLE, fontSize: 10 }}
                    angle={-28}
                    textAnchor="end"
                    height={54}
                  />
                  <YAxis tick={{ ...CHART_TICK_STYLE, fontSize: 10 }} tickFormatter={(v) => `${(Number(v) * 100).toFixed(1)}%`} />
                  <Tooltip
                    formatter={(v) => `${(Number(v) * 100).toFixed(2)}%`}
                    contentStyle={{
                      ...CHART_TOOLTIP_CONTENT_STYLE,
                      borderRadius: 14,
                      borderColor: "#dbe7f3",
                      boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
                    }}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  />
                  <Line
                    dataKey="viewabilityRate"
                    name="Текущий период"
                    type="monotone"
                    stroke="#35a8e0"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  {compare && (
                    <Line
                      dataKey="viewabilityRatePrev"
                      name="Предыдущий период"
                      stroke="#b8c1ce"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      dot={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : viewabilitySlice && viewabilityBreakdown.data.length ? (
            <div className="h-80 px-2 pb-2 pt-3">
              <ResponsiveContainer>
                <LineChart data={viewabilityBreakdown.data}>
                  <CartesianGrid vertical={true} horizontal={true} stroke="#e8eef5" />
                  <XAxis
                    dataKey="label"
                    minTickGap={10}
                    tick={{ ...CHART_TICK_STYLE, fontSize: 10 }}
                    angle={-28}
                    textAnchor="end"
                    height={54}
                  />
                  <YAxis tick={{ ...CHART_TICK_STYLE, fontSize: 10 }} tickFormatter={(v) => `${(Number(v) * 100).toFixed(1)}%`} />
                  <Tooltip
                    formatter={(v) => `${(Number(v) * 100).toFixed(2)}%`}
                    contentStyle={{
                      ...CHART_TOOLTIP_CONTENT_STYLE,
                      borderRadius: 14,
                      borderColor: "#dbe7f3",
                      boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
                    }}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  />
                  {viewabilityBreakdown.series.map((series) => (
                    <Line
                      key={series.key}
                      dataKey={series.key}
                      name={series.label}
                      type="monotone"
                      stroke={series.color}
                      strokeWidth={2.2}
                      dot={false}
                      activeDot={{ r: 3 }}
                      className="cursor-pointer"
                      onClick={() => onApplySliceFilter(viewabilitySlice, series)}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="p-3">
              <EmptyState text="Нет данных по видимости" />
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-slate-900">Затраты</h3>
              </div>
            </div>
            {renderSliceSelector(spendSlice, setSpendSlice, spendSliceOptions)}
            {spendSlice ? (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500">
                {spendBreakdown.series.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onApplySliceFilter(spendSlice, item)}
                    className="inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 hover:bg-slate-100"
                  >
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color, opacity: 0.9 }} />
                    <span>{item.label}</span>
                  </button>
                ))}
                {!!spendBreakdown.hiddenSummary?.count && (
                  <span
                    title={spendBreakdown.hiddenSummary.labels.join("\n")}
                    className="inline-flex cursor-help items-center gap-1.5 text-slate-400"
                  >
                    <span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />
                    <span>+ {spendBreakdown.hiddenSummary.count}</span>
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#35a8e0]" />
                  <span>Текущий период</span>
                </span>
                {compare && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-4 rounded-full bg-[#b8c1ce]" />
                    <span>Предыдущий период</span>
                  </span>
                )}
              </div>
            )}
          </div>
          {(spendSlice ? spendBreakdownRes.loading : spendSeriesRes.loading) ? (
            <div className="p-3">
              <ChartSkeleton />
            </div>
          ) : !spendSlice && spendTimeline.length ? (
            <div className="h-80 px-2 pb-2 pt-3">
              <ResponsiveContainer>
                <ComposedChart data={spendTimeline} barCategoryGap={6}>
                  <CartesianGrid vertical={true} horizontal={true} stroke="#e8eef5" />
                  <XAxis
                    dataKey="label"
                    minTickGap={10}
                    tick={{ ...CHART_TICK_STYLE, fontSize: 10 }}
                    angle={-28}
                    textAnchor="end"
                    height={54}
                  />
                  <YAxis tick={{ ...CHART_TICK_STYLE, fontSize: 10 }} tickFormatter={(v) => fmtCurrency(Number(v))} />
                  <Tooltip
                    formatter={(v) => fmtCurrency(Number(v))}
                    contentStyle={{
                      ...CHART_TOOLTIP_CONTENT_STYLE,
                      borderRadius: 14,
                      borderColor: "#dbe7f3",
                      boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
                    }}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  />
                  <Bar
                    name="Текущий период"
                    dataKey="current"
                    fill="#35a8e0"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={24}
                  />
                  {compare && (
                    <Line
                      name="Предыдущий период"
                      dataKey="prev"
                      stroke="#b8c1ce"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      dot={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : spendSlice && spendBreakdown.data.length ? (
            <div className="h-80 px-2 pb-2 pt-3">
              <ResponsiveContainer>
                <BarChart data={spendBreakdown.data} barCategoryGap={6}>
                  <CartesianGrid vertical={true} horizontal={true} stroke="#e8eef5" />
                  <XAxis
                    dataKey="label"
                    minTickGap={10}
                    tick={{ ...CHART_TICK_STYLE, fontSize: 10 }}
                    angle={-28}
                    textAnchor="end"
                    height={54}
                  />
                  <YAxis tick={{ ...CHART_TICK_STYLE, fontSize: 10 }} tickFormatter={(v) => fmtCurrency(Number(v))} />
                  <Tooltip
                    formatter={(v) => fmtCurrency(Number(v))}
                    contentStyle={{
                      ...CHART_TOOLTIP_CONTENT_STYLE,
                      borderRadius: 14,
                      borderColor: "#dbe7f3",
                      boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
                    }}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  />
                  {spendBreakdown.series.map((series) => (
                    <Bar
                      key={series.key}
                      dataKey={series.key}
                      name={series.label}
                      stackId="spend"
                      fill={series.color}
                      fillOpacity={0.82}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={30}
                      className="cursor-pointer"
                      onClick={() => onApplySliceFilter(spendSlice, series)}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="p-3">
              <EmptyState text="Нет данных по расходу" />
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-slate-900">{selectedConversionsMetricMeta.title}</h3>
              </div>
            </div>
            <div className="mb-2">
              {renderSliceSelector(
                conversionsMetricMode,
                (slice) => setConversionsMetricMode(slice || "totalConversions"),
                conversionsMetricOptions
              )}
            </div>
            {renderSliceSelector(conversionsSlice, setConversionsSlice, conversionsSliceOptions)}
            {conversionsSlice ? (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500">
                {conversionsBreakdown.series.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onApplySliceFilter(conversionsSlice, item)}
                    className="inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 hover:bg-slate-100"
                  >
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color, opacity: 0.9 }} />
                    <span>{item.label}</span>
                  </button>
                ))}
                {!!conversionsBreakdown.hiddenSummary?.count && (
                  <span
                    title={conversionsBreakdown.hiddenSummary.labels.join("\n")}
                    className="inline-flex cursor-help items-center gap-1.5 text-slate-400"
                  >
                    <span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />
                    <span>+ {conversionsBreakdown.hiddenSummary.count}</span>
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#93c01f]" />
                  <span>Текущий период</span>
                </span>
                {compare && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-4 rounded-full bg-[#b8c1ce]" />
                    <span>Предыдущий период</span>
                  </span>
                )}
              </div>
            )}
          </div>
          {(conversionsSlice ? conversionsBreakdownRes.loading : conversionsSeriesRes.loading) ? (
            <div className="p-3">
              <ChartSkeleton />
            </div>
          ) : !conversionsSlice && conversionsTimeline.length ? (
            <div className="h-80 px-2 pb-2 pt-3">
              <ResponsiveContainer>
                <ComposedChart data={conversionsTimeline} barCategoryGap={6}>
                  <CartesianGrid vertical={true} horizontal={true} stroke="#e8eef5" />
                  <XAxis
                    dataKey="label"
                    minTickGap={10}
                    tick={{ ...CHART_TICK_STYLE, fontSize: 10 }}
                    angle={-28}
                    textAnchor="end"
                    height={54}
                  />
                  <YAxis tick={{ ...CHART_TICK_STYLE, fontSize: 10 }} tickFormatter={(v) => fmtInt(Number(v))} />
                  <Tooltip
                    formatter={(v) => fmtInt(Number(v))}
                    contentStyle={{
                      ...CHART_TOOLTIP_CONTENT_STYLE,
                      borderRadius: 14,
                      borderColor: "#dbe7f3",
                      boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
                    }}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  />
                  <Bar
                    name="Текущий период"
                    dataKey="current"
                    fill="#93c01f"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={24}
                  />
                  {compare && (
                    <Line
                      name="Предыдущий период"
                      dataKey="prev"
                      stroke="#b8c1ce"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      dot={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : conversionsSlice && conversionsBreakdown.data.length ? (
            <div className="h-80 px-2 pb-2 pt-3">
              <ResponsiveContainer>
                <BarChart data={conversionsBreakdown.data} barCategoryGap={6}>
                  <CartesianGrid vertical={true} horizontal={true} stroke="#e8eef5" />
                  <XAxis
                    dataKey="label"
                    minTickGap={10}
                    tick={{ ...CHART_TICK_STYLE, fontSize: 10 }}
                    angle={-28}
                    textAnchor="end"
                    height={54}
                  />
                  <YAxis tick={{ ...CHART_TICK_STYLE, fontSize: 10 }} tickFormatter={(v) => fmtInt(Number(v))} />
                  <Tooltip
                    formatter={(v) => fmtInt(Number(v))}
                    contentStyle={{
                      ...CHART_TOOLTIP_CONTENT_STYLE,
                      borderRadius: 14,
                      borderColor: "#dbe7f3",
                      boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
                    }}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  />
                  {conversionsBreakdown.series.map((series) => (
                    <Bar
                      key={series.key}
                      dataKey={series.key}
                      name={series.label}
                      stackId="conversions"
                      fill={series.color}
                      fillOpacity={0.82}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={30}
                      className="cursor-pointer"
                      onClick={() => onApplySliceFilter(conversionsSlice, series)}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="p-3">
              <EmptyState text={selectedConversionsMetricMeta.empty} />
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-slate-900">
                  {ivtSlice === "qualitySplit" ? "IVT / GIVT / SIVT" : "IVT"}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {ivtSlice === "qualitySplit"
                    ? "Структура невалидного трафика по типам"
                    : ivtSlice
                      ? "Динамика IVT по выбранному срезу"
                      : "Динамика IVT за период"}
                </p>
              </div>
            </div>
            {renderSliceSelector(ivtSlice, setIvtSlice, ivtSliceOptions)}
            {ivtSlice === "qualitySplit" ? (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded-full bg-[#e20613]" />
                  <span>IVT%</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#f29100]" />
                  <span>GIVT%</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#1d70b7]" />
                  <span>SIVT%</span>
                </span>
              </div>
            ) : ivtSlice ? (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500">
                {ivtBreakdown.series.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onApplySliceFilter(ivtSlice as OverviewSliceId, item)}
                    className="inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 hover:bg-slate-100"
                  >
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color, opacity: 0.9 }} />
                    <span>{item.label}</span>
                  </button>
                ))}
                {!!ivtBreakdown.hiddenSummary?.count && (
                  <span
                    title={ivtBreakdown.hiddenSummary.labels.join("\n")}
                    className="inline-flex cursor-help items-center gap-1.5 text-slate-400"
                  >
                    <span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />
                    <span>+ {ivtBreakdown.hiddenSummary.count}</span>
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#e20613]" />
                  <span>IVT%</span>
                </span>
                {compare && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-4 rounded-full bg-[#b8c1ce]" />
                    <span>Предыдущий период</span>
                  </span>
                )}
              </div>
            )}
          </div>
          {(ivtSlice === ""
            ? ivtRes.loading
            : ivtSlice === "qualitySplit"
              ? ivtRes.loading || givtRes.loading || sivtRes.loading
              : ivtBreakdownRes.loading) ? (
            <div className="p-3">
              <ChartSkeleton />
            </div>
          ) : ivtSlice === "" && timeline.length ? (
            <div className="h-80 px-2 pb-2 pt-3">
              <ResponsiveContainer>
                <ComposedChart data={timeline} barCategoryGap={6}>
                  <CartesianGrid vertical={true} horizontal={true} stroke="#e8eef5" />
                  <XAxis
                    dataKey="label"
                    minTickGap={10}
                    tick={{ ...CHART_TICK_STYLE, fontSize: 10 }}
                    angle={-28}
                    textAnchor="end"
                    height={54}
                  />
                  <YAxis tick={{ ...CHART_TICK_STYLE, fontSize: 10 }} tickFormatter={(v) => `${(Number(v) * 100).toFixed(1)}%`} />
                  <Tooltip
                    formatter={(v) => `${(Number(v) * 100).toFixed(2)}%`}
                    contentStyle={{
                      ...CHART_TOOLTIP_CONTENT_STYLE,
                      borderRadius: 14,
                      borderColor: "#dbe7f3",
                      boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
                    }}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  />
                  <Bar
                    name="IVT%"
                    dataKey="ivtRate"
                    fill="#e20613"
                    fillOpacity={0.85}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={24}
                  />
                  {compare && (
                    <Line
                      name="IVT% (пред. период)"
                      dataKey="ivtRatePrev"
                      stroke="#b8c1ce"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      dot={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : ivtSlice === "qualitySplit" && timeline.length ? (
            <div className="h-80 px-2 pb-2 pt-3">
              <ResponsiveContainer>
                <ComposedChart data={timeline} barCategoryGap={6}>
                  <CartesianGrid vertical={true} horizontal={true} stroke="#e8eef5" />
                  <XAxis
                    dataKey="label"
                    minTickGap={10}
                    tick={{ ...CHART_TICK_STYLE, fontSize: 10 }}
                    angle={-28}
                    textAnchor="end"
                    height={54}
                  />
                  <YAxis tick={{ ...CHART_TICK_STYLE, fontSize: 10 }} tickFormatter={(v) => `${(Number(v) * 100).toFixed(1)}%`} />
                  <Tooltip
                    formatter={(v) => `${(Number(v) * 100).toFixed(2)}%`}
                    contentStyle={{
                      ...CHART_TOOLTIP_CONTENT_STYLE,
                      borderRadius: 14,
                      borderColor: "#dbe7f3",
                      boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
                    }}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  />
                  <Bar
                    name="GIVT%"
                    dataKey="givtRate"
                    stackId="ivt"
                    fill="#f29100"
                    fillOpacity={0.88}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    name="SIVT%"
                    dataKey="sivtRate"
                    stackId="ivt"
                    fill="#1d70b7"
                    fillOpacity={0.82}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Line
                    name="IVT%"
                    dataKey="ivtRate"
                    stroke="#e20613"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#e20613", strokeWidth: 0 }}
                    activeDot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : ivtSlice && ivtSlice !== "qualitySplit" && ivtBreakdown.data.length ? (
            <div className="h-80 px-2 pb-2 pt-3">
              <ResponsiveContainer>
                <BarChart data={ivtBreakdown.data} barCategoryGap={6}>
                  <CartesianGrid vertical={true} horizontal={true} stroke="#e8eef5" />
                  <XAxis
                    dataKey="label"
                    minTickGap={10}
                    tick={{ ...CHART_TICK_STYLE, fontSize: 10 }}
                    angle={-28}
                    textAnchor="end"
                    height={54}
                  />
                  <YAxis tick={{ ...CHART_TICK_STYLE, fontSize: 10 }} tickFormatter={(v) => `${(Number(v) * 100).toFixed(1)}%`} />
                  <Tooltip
                    formatter={(v) => `${(Number(v) * 100).toFixed(2)}%`}
                    contentStyle={{
                      ...CHART_TOOLTIP_CONTENT_STYLE,
                      borderRadius: 14,
                      borderColor: "#dbe7f3",
                      boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
                    }}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  />
                  {ivtBreakdown.series.map((series) => (
                    <Bar
                      key={series.key}
                      dataKey={series.key}
                      name={series.label}
                      stackId="ivt-breakdown"
                      fill={series.color}
                      fillOpacity={0.82}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={30}
                      className="cursor-pointer"
                      onClick={() => onApplySliceFilter(ivtSlice as OverviewSliceId, series)}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="p-3">
              <EmptyState text="Нет данных по качеству трафика" />
            </div>
          )}
        </div>

      </section>

      <section className="rounded-xl border bg-white p-3">
        <div className="mb-3 flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{selectedHeatmapMetric.title}</h3>
          {renderSliceSelector(heatmapMetric, (slice) => setHeatmapMetric((slice || "impressions") as HeatmapMetricId), heatmapMetricOptions)}
        </div>
        {!showHeatmap ? (
          <EmptyState text="Доступно только для grain=hour и периода не более 7 дней" />
        ) : heatmapRes.loading ? (
          <ChartSkeleton />
        ) : heatmapRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white p-2 text-left">День</th>
                  {Array.from({ length: 24 }, (_, h) => (
                    <th key={h} className="p-2 text-right font-normal text-gray-500">
                      {String(h).padStart(2, "0")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapDays.map((day) => {
                  const byHour = new Map(
                    heatmapRows
                      .filter((r) => r.date === day)
                      .map((r) => [r.hour, r.value])
                  );

                  return (
                    <tr key={day}>
                      <td className="sticky left-0 z-10 bg-white p-2 font-medium">{day}</td>
                      {Array.from({ length: 24 }, (_, h) => {
                        const value = byHour.get(h) ?? 0;
                        const alpha = Math.min(1, value / maxHeatmapValue);
                        const bg = `rgba(2, 132, 199, ${0.1 + alpha * 0.76})`;
                        return (
                          <td
                            key={h}
                            className="p-2 text-right"
                            style={{ background: bg }}
                            title={selectedHeatmapMetric.formatValue(value)}
                          >
                            {value ? selectedHeatmapMetric.formatValue(value) : ""}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="Нет данных для heatmap" />
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-slate-900">Frequency distribution по охвату</h3>
              <MetricHelpTooltip metricKey="frequencyDistributionReach" />
            </div>
            <p className="text-[11px] text-slate-500">
              Распределение охвата по бакетам частоты контакта.
            </p>
          </div>
        </div>
        {frequencyDistributionRes.loading ? (
          <div className="p-3">
            <ChartSkeleton />
          </div>
        ) : frequencyDistribution.length ? (
          <div className="h-80 px-2 pb-2 pt-3">
            <ResponsiveContainer>
              <ComposedChart data={frequencyDistribution} barCategoryGap={10}>
                <CartesianGrid vertical={true} horizontal={true} stroke="#e8eef5" />
                <XAxis
                  dataKey="bucket"
                  tick={{ ...CHART_TICK_STYLE, fontSize: 10 }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ ...CHART_TICK_STYLE, fontSize: 10 }}
                  tickFormatter={(v) => fmtInt(Number(v))}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ ...CHART_TICK_STYLE, fontSize: 10 }}
                  tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
                />
                <Tooltip
                  formatter={(value, name) =>
                    name === "Доля охвата"
                      ? `${(Number(value) * 100).toFixed(2)}%`
                      : fmtInt(Number(value))
                  }
                  contentStyle={{
                    ...CHART_TOOLTIP_CONTENT_STYLE,
                    borderRadius: 14,
                    borderColor: "#dbe7f3",
                    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
                  }}
                  labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                  itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                />
                <Bar
                  yAxisId="left"
                  dataKey="reach"
                  name="Охват"
                  fill="#7fd0d3"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={44}
                />
                <Line
                  yAxisId="right"
                  dataKey="reachShare"
                  name="Доля охвата"
                  stroke="#1d70b7"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#1d70b7", strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="p-3">
            <EmptyState text="Нет данных по frequency distribution" />
          </div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border bg-white p-3">
          <h3 className="mb-3 text-sm font-semibold">Топ домены</h3>
          {topDomainsRes.loading ? (
            <ChartSkeleton />
          ) : topDomains.length ? (
            <div className="max-h-96 overflow-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 text-left">Домен</th>
                    <th className="p-2 text-right">Показы</th>
                    <th className="p-2 text-right">Охват</th>
                    <th className="p-2 text-right">Клики</th>
                    <th className="p-2 text-right">CTR</th>
                    <th className="p-2 text-right">IVT%</th>
                    <th className="p-2 text-right">Brand safety, %</th>
                  </tr>
                </thead>
                <tbody>
                  {topDomains.map((row) => (
                    <tr key={row.domain} className="odd:bg-white even:bg-gray-50">
                      <td className="border-t p-2">{row.domain}</td>
                      <td className="border-t p-2 text-right">{fmtInt(row.impressions)}</td>
                      <td className="border-t p-2 text-right">{fmtInt(row.reach)}</td>
                      <td className="border-t p-2 text-right">{fmtInt(row.clicks)}</td>
                      <td className="border-t p-2 text-right">{fmtPercent(row.ctr)}</td>
                      <td className="border-t p-2 text-right">{fmtPercent(row.ivtRate)}</td>
                      <td className="border-t p-2 text-right">{fmtPercent(row.brandSafetyRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState text="Нет данных по доменам" />
          )}
        </div>

        <div className="rounded-xl border bg-white p-3">
          <h3 className="mb-3 text-sm font-semibold">Топ гео</h3>
          {topGeosRes.loading ? (
            <ChartSkeleton />
          ) : topGeos.length ? (
            <div className="max-h-96 overflow-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 text-left">Гео</th>
                    <th className="p-2 text-right">Показы</th>
                    <th className="p-2 text-right">Охват</th>
                    <th className="p-2 text-right">Клики</th>
                    <th className="p-2 text-right">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {topGeos.map((row) => (
                    <tr key={row.geo} className="odd:bg-white even:bg-gray-50">
                      <td className="border-t p-2">{row.geo}</td>
                      <td className="border-t p-2 text-right">{fmtInt(row.impressions)}</td>
                      <td className="border-t p-2 text-right">{fmtInt(row.reach)}</td>
                      <td className="border-t p-2 text-right">{fmtInt(row.clicks)}</td>
                      <td className="border-t p-2 text-right">{fmtPercent(row.ctr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState text="Нет данных по гео" />
          )}
        </div>
      </section>
    </div>
  );
}

type PerformanceRow = {
  id: number | string;
  name: string;
  parent: string;
  impressions: number;
  validImpressions: number;
  ivtImpressions: number;
  givtImpressions: number;
  sivtImpressions: number;
  validImpressionsRate: number;
  viewableImpressions: number;
  viewabilityRate: number;
  reach: number;
  frequency: number;
  clicks: number;
  validClicks: number;
  ivtClicks: number;
  givtClicks: number;
  sivtClicks: number;
  ivtClickRate: number;
  givtClickRate: number;
  sivtClickRate: number;
  ctr: number;
  ivtRate: number;
  givtRate: number;
  sivtRate: number;
  spend: number;
  cpm: number;
  cpr: number;
  cpc: number;
  cpa: number;
  plannedBudget: number;
  totalConversions: number;
  incrementalConversions: number;
  vcr100: number;
};

type PerformanceChartMetric = "spend" | "cpa" | "cpc" | "cpm";

type DashboardSortingState = Array<{ id: string; desc: boolean }>;
type DashboardPaginationState = { pageIndex: number; pageSize: number };

type PerformanceDependencyRow = {
  id: number | string;
  name: string;
  shortName: string;
  metricValue: number;
  ctr: number;
  ivtRate: number;
  impressions: number;
  clicks: number;
  totalConversions: number;
};

const PERFORMANCE_CHART_METRIC_META: Record<
  PerformanceChartMetric,
  {
    label: string;
    valueFormatter: (value: number) => string;
    isEligible: (row: PerformanceRow) => boolean;
  }
> = {
  spend: {
    label: "Затраты",
    valueFormatter: fmtCurrency,
    isEligible: (row) => row.spend > 0,
  },
  cpa: {
    label: "CPA",
    valueFormatter: fmtCurrency,
    isEligible: (row) => row.totalConversions > 0 && row.cpa > 0,
  },
  cpc: {
    label: "CPC",
    valueFormatter: fmtCurrency,
    isEligible: (row) => row.clicks > 0 && row.cpc > 0,
  },
  cpm: {
    label: "CPM",
    valueFormatter: fmtCurrency,
    isEligible: (row) => row.impressions > 0 && row.cpm > 0,
  },
};

function PerformanceSection(props: {
  filters: Filters;
  tableDimension: TableDimension;
  budgetsByPlacementId: Record<string, number>;
}) {
  const pageSize = 12;
  const wideClientFilterLimit = 800;
  const { filters, tableDimension, budgetsByPlacementId } = props;
  const [search, setSearch] = useState("");
  const [preset, setPreset] = useState<"none" | "impressions" | "ctr" | "reach">("none");
  const [sorting, setSorting] = useState<DashboardSortingState>([{ id: "impressions", desc: true }]);
  const [pagination, setPagination] = useState<DashboardPaginationState>({ pageIndex: 0, pageSize });
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    validImpressions: false,
    ivtImpressions: false,
    givtImpressions: false,
    sivtImpressions: false,
    validImpressionsRate: false,
    viewableImpressions: false,
    viewabilityRate: false,
    reach: false,
    frequency: false,
    validClicks: false,
    ivtClicks: false,
    givtClicks: false,
    sivtClicks: false,
    ivtClickRate: false,
    givtClickRate: false,
    sivtClickRate: false,
    ivtRate: false,
    givtRate: false,
    sivtRate: false,
    cpr: false,
    cpm: false,
    cpc: false,
    vcr100: false,
    postViewConv: false,
    postClickConv: false,
  });
  const [barMetric, setBarMetric] = useState<PerformanceChartMetric>("spend");

  const tableSort = useMemo<QuerySort[]>(
    () =>
      sorting.length
        ? sorting.map((item) => ({ field: item.id, dir: item.desc ? "desc" : "asc" }))
        : [{ field: "impressions", dir: "desc" }],
    [sorting]
  );
  const needsClientWideFilter = search.trim().length > 0 || preset === "ctr" || preset === "reach";
  const queryLimit = needsClientWideFilter ? wideClientFilterLimit : pagination.pageSize;
  const queryOffset = needsClientWideFilter ? 0 : pagination.pageIndex * pagination.pageSize;

  const perfRes = useAsyncResource(
    `perf-${tableDimension}-${JSON.stringify(filters)}-${JSON.stringify(tableSort)}-${queryLimit}-${queryOffset}-${preset}-${search}`,
    () =>
      selectPerformanceTable({
        filters,
        level: tableDimension as PerformanceLevel,
        sort: tableSort,
        limit: queryLimit,
        offset: queryOffset,
      }),
    EMPTY_RESPONSE
  );

  const placementScope = useMemo(
    () => getBudgetPlacementScope(filters, MOCK_DATASET),
    [filters]
  );

  const plannedBudgetByPlacement = useMemo(() => {
    const map: Record<number, number> = {};
    placementScope.forEach((item) => {
      const value = budgetsByPlacementId[String(item.placementId)];
      map[item.placementId] = Number.isFinite(value) && value >= 0 ? value : 0;
    });
    return map;
  }, [placementScope, budgetsByPlacementId]);

  const plannedBudgetByCampaign = useMemo(() => {
    const map: Record<number, number> = {};
    placementScope.forEach((item) => {
      map[item.campaignId] = (map[item.campaignId] ?? 0) + (plannedBudgetByPlacement[item.placementId] ?? 0);
    });
    return map;
  }, [placementScope, plannedBudgetByPlacement]);

  const rows = useMemo<PerformanceRow[]>(() => {
    return (perfRes.data.rows as Record<string, unknown>[]).map((row) => {
      if (tableDimension === "campaign") {
        const campaignId = safeNumber(row.campaignId);
        return {
          id: campaignId,
          name: String(row.campaignName ?? "—"),
          parent: "",
          impressions: safeNumber(row.impressions),
          validImpressions: safeNumber(row.validImpressions),
          ivtImpressions: Math.max(0, safeNumber(row.impressions) - safeNumber(row.validImpressions)),
          givtImpressions: safeNumber(row.givtImpressions),
          sivtImpressions: safeNumber(row.sivtImpressions),
          validImpressionsRate:
            safeNumber(row.impressions) > 0 ? safeNumber(row.validImpressions) / safeNumber(row.impressions) : 0,
          viewableImpressions: safeNumber(row.viewableImpressions),
          viewabilityRate: safeNumber(row.viewabilityRate),
          reach: safeNumber(row.reach),
          frequency: safeNumber(row.frequency),
          clicks: safeNumber(row.clicks),
          validClicks: safeNumber(row.validClicks),
          ivtClicks: safeNumber(row.ivtClicks),
          givtClicks: safeNumber(row.givtClicks),
          sivtClicks: safeNumber(row.sivtClicks),
          ivtClickRate: safeNumber(row.ivtClickRate),
          givtClickRate: safeNumber(row.givtClickRate),
          sivtClickRate: safeNumber(row.sivtClickRate),
          ctr: safeNumber(row.ctr),
          ivtRate: safeNumber(row.ivtRate),
          givtRate: safeNumber(row.givtRate),
          sivtRate: safeNumber(row.sivtRate),
          spend: safeNumber(row.spend),
          cpm: safeNumber(row.cpm),
          cpr: safeNumber(row.cpr),
          cpc: safeNumber(row.cpc),
          cpa: safeNumber(row.cpa),
          plannedBudget: plannedBudgetByCampaign[campaignId] ?? 0,
          totalConversions: safeNumber(row.totalConversions),
          incrementalConversions: safeNumber(row.incrementalConversions),
          vcr100: safeNumber(row.vcr100),
        };
      }

      if (tableDimension === "placement") {
        const placementId = safeNumber(row.placementId);
        return {
          id: placementId,
          name: String(row.placementName ?? "—"),
          parent: String(row.campaignName ?? "—"),
          impressions: safeNumber(row.impressions),
          validImpressions: safeNumber(row.validImpressions),
          ivtImpressions: Math.max(0, safeNumber(row.impressions) - safeNumber(row.validImpressions)),
          givtImpressions: safeNumber(row.givtImpressions),
          sivtImpressions: safeNumber(row.sivtImpressions),
          validImpressionsRate:
            safeNumber(row.impressions) > 0 ? safeNumber(row.validImpressions) / safeNumber(row.impressions) : 0,
          viewableImpressions: safeNumber(row.viewableImpressions),
          viewabilityRate: safeNumber(row.viewabilityRate),
          reach: safeNumber(row.reach),
          frequency: safeNumber(row.frequency),
          clicks: safeNumber(row.clicks),
          validClicks: safeNumber(row.validClicks),
          ivtClicks: safeNumber(row.ivtClicks),
          givtClicks: safeNumber(row.givtClicks),
          sivtClicks: safeNumber(row.sivtClicks),
          ivtClickRate: safeNumber(row.ivtClickRate),
          givtClickRate: safeNumber(row.givtClickRate),
          sivtClickRate: safeNumber(row.sivtClickRate),
          ctr: safeNumber(row.ctr),
          ivtRate: safeNumber(row.ivtRate),
          givtRate: safeNumber(row.givtRate),
          sivtRate: safeNumber(row.sivtRate),
          spend: safeNumber(row.spend),
          cpm: safeNumber(row.cpm),
          cpr: safeNumber(row.cpr),
          cpc: safeNumber(row.cpc),
          cpa: safeNumber(row.cpa),
          plannedBudget: plannedBudgetByPlacement[placementId] ?? 0,
          totalConversions: safeNumber(row.totalConversions),
          incrementalConversions: safeNumber(row.incrementalConversions),
          vcr100: safeNumber(row.vcr100),
        };
      }

      const keyMap: Record<TableDimension, string> = {
        campaign: "campaignName",
        placement: "placementName",
        supplier: "supplier",
        client: "client",
        advertiser: "advertiser",
        date: "date",
      };
      const idKeyMap: Record<TableDimension, string> = {
        campaign: "campaignId",
        placement: "placementId",
        supplier: "supplier",
        client: "client",
        advertiser: "advertiser",
        date: "date",
      };
      const nameKey = keyMap[tableDimension];
      const idKey = idKeyMap[tableDimension];
      const idValue = row[idKey];

      return {
        id: typeof idValue === "number" ? idValue : String(idValue ?? "—"),
        name: String(row[nameKey] ?? "—"),
        parent: "",
        impressions: safeNumber(row.impressions),
        validImpressions: safeNumber(row.validImpressions),
        ivtImpressions: Math.max(0, safeNumber(row.impressions) - safeNumber(row.validImpressions)),
        givtImpressions: safeNumber(row.givtImpressions),
        sivtImpressions: safeNumber(row.sivtImpressions),
        validImpressionsRate:
          safeNumber(row.impressions) > 0 ? safeNumber(row.validImpressions) / safeNumber(row.impressions) : 0,
        viewableImpressions: safeNumber(row.viewableImpressions),
        viewabilityRate: safeNumber(row.viewabilityRate),
        reach: safeNumber(row.reach),
        frequency: safeNumber(row.frequency),
        clicks: safeNumber(row.clicks),
        validClicks: safeNumber(row.validClicks),
        ivtClicks: safeNumber(row.ivtClicks),
        givtClicks: safeNumber(row.givtClicks),
        sivtClicks: safeNumber(row.sivtClicks),
        ivtClickRate: safeNumber(row.ivtClickRate),
        givtClickRate: safeNumber(row.givtClickRate),
        sivtClickRate: safeNumber(row.sivtClickRate),
        ctr: safeNumber(row.ctr),
        ivtRate: safeNumber(row.ivtRate),
        givtRate: safeNumber(row.givtRate),
        sivtRate: safeNumber(row.sivtRate),
        spend: safeNumber(row.spend),
        cpm: safeNumber(row.cpm),
        cpr: safeNumber(row.cpr),
        cpc: safeNumber(row.cpc),
        cpa: safeNumber(row.cpa),
        plannedBudget: 0,
        totalConversions: safeNumber(row.totalConversions),
        incrementalConversions: safeNumber(row.incrementalConversions),
        vcr100: safeNumber(row.vcr100),
      };
    });
  }, [perfRes.data.rows, tableDimension, plannedBudgetByPlacement, plannedBudgetByCampaign]);

  const filteredRows = useMemo(() => {
    let next = rows;

    if (preset === "ctr") {
      next = next.filter((row) => row.impressions > 10_000);
    }
    if (preset === "reach") {
      next = next.filter((row) => row.impressions > 10_000);
    }

    const needle = search.trim().toLowerCase();
    if (needle) {
      next = next.filter(
        (row) => row.name.toLowerCase().includes(needle) || String(row.id).includes(needle)
      );
    }

    return next;
  }, [rows, preset, search]);

  const tableRows = useMemo(() => {
    if (!needsClientWideFilter) return filteredRows;
    const start = pagination.pageIndex * pagination.pageSize;
    return filteredRows.slice(start, start + pagination.pageSize);
  }, [filteredRows, needsClientWideFilter, pagination.pageIndex, pagination.pageSize]);

  const totalRows = needsClientWideFilter
    ? filteredRows.length
    : (perfRes.data.meta.totalRows ?? filteredRows.length);
  const pageCount = Math.max(1, Math.ceil(totalRows / pagination.pageSize));

  useEffect(() => {
    setPagination((current) => (current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }));
  }, [filters, tableDimension, search, preset, sorting]);

  useEffect(() => {
    setPagination((current) => {
      if (current.pageIndex < pageCount) return current;
      return { ...current, pageIndex: Math.max(0, pageCount - 1) };
    });
  }, [pageCount]);

  const selectedMetricMeta = PERFORMANCE_CHART_METRIC_META[barMetric];

  const dependencyRows = useMemo<PerformanceDependencyRow[]>(() => {
    return filteredRows
      .filter((row) => selectedMetricMeta.isEligible(row))
      .filter((row) => Number.isFinite(row[barMetric]))
      .sort((a, b) => Number(b[barMetric]) - Number(a[barMetric]))
      .slice(0, 10)
      .map((row) => ({
        id: row.id,
        name: row.name,
        shortName: row.name.length > 24 ? `${row.name.slice(0, 24)}…` : row.name,
        metricValue: Number(row[barMetric]),
        ctr: row.ctr,
        ivtRate: row.ivtRate,
        impressions: row.impressions,
        clicks: row.clicks,
        totalConversions: row.totalConversions,
      }));
  }, [filteredRows, barMetric, selectedMetricMeta]);

  const ctrMedian = useMemo(() => calcMedian(dependencyRows.map((row) => row.ctr)), [dependencyRows]);

  const dependencyInsights = useMemo(() => {
    type InsightTone = "neutral" | "positive" | "warning";
    type InsightItem = { title: string; text: string; tone: InsightTone };

    if (!dependencyRows.length) {
      return [
        {
          title: "Нет данных для анализа",
          text: "По текущим фильтрам нет строк, где можно корректно считать выбранную метрику.",
          tone: "neutral" as InsightTone,
        },
      ];
    }

    if (dependencyRows.length < 2) {
      return [
        {
          title: "Недостаточно точек",
          text: "Для зависимости нужно минимум 2 кампании. Расширьте фильтры или снимите пресет.",
          tone: "neutral" as InsightTone,
        },
      ];
    }

    const insights: InsightItem[] = [];
    const metricValues = dependencyRows.map((row) => row.metricValue);
    const ctrValues = dependencyRows.map((row) => row.ctr);
    const correlation = calcPearsonCorrelation(metricValues, ctrValues);

    if (correlation !== null) {
      if (correlation >= 0.35) {
        insights.push({
          title: "Связь метрик",
          text: `Есть заметная прямая связь: при росте ${selectedMetricMeta.label} обычно растёт и CTR.`,
          tone: "warning",
        });
      } else if (correlation <= -0.35) {
        insights.push({
          title: "Связь метрик",
          text: `Есть обратная связь: при росте ${selectedMetricMeta.label} CTR в среднем снижается.`,
          tone: "positive",
        });
      } else {
        insights.push({
          title: "Связь метрик",
          text: `Линейная зависимость между CTR и метрикой «${selectedMetricMeta.label}» слабая.`,
          tone: "neutral",
        });
      }
    }

    if (barMetric === "spend") {
      const leaderBySpend = dependencyRows[0];
      const leaderByCtr = dependencyRows.reduce((best, row) => (row.ctr > best.ctr ? row : best), dependencyRows[0]);
      insights.push({
        title: "Лидер по объёму",
        text: `${leaderBySpend.name}: ${fmtCurrency(leaderBySpend.metricValue)} при CTR ${fmtPercent(leaderBySpend.ctr)}.`,
        tone: "neutral",
      });
      if (leaderByCtr.name !== leaderBySpend.name) {
        insights.push({
          title: "Резерв роста",
          text: `Лучший CTR у «${leaderByCtr.name}» (${fmtPercent(leaderByCtr.ctr)}). Рассмотрите перераспределение бюджета.`,
          tone: "positive",
        });
      }
    } else {
      const metricMedian = calcMedian(metricValues);
      const ctrMedianLocal = calcMedian(ctrValues);
      if (metricMedian !== null && ctrMedianLocal !== null) {
        const efficient = dependencyRows
          .filter((row) => row.metricValue <= metricMedian && row.ctr >= ctrMedianLocal)
          .sort((a, b) => b.ctr - a.ctr || a.metricValue - b.metricValue)[0];

        if (efficient) {
          insights.push({
            title: "Кандидат на масштабирование",
            text: `${efficient.name}: ${selectedMetricMeta.label} ${selectedMetricMeta.valueFormatter(efficient.metricValue)} и CTR ${fmtPercent(efficient.ctr)}.`,
            tone: "positive",
          });
        } else {
          const optimizationTarget = dependencyRows
            .filter((row) => row.metricValue >= metricMedian && row.ctr <= ctrMedianLocal)
            .sort((a, b) => b.metricValue - a.metricValue)[0];
          if (optimizationTarget) {
            insights.push({
              title: "Зона оптимизации",
              text: `${optimizationTarget.name}: высокий ${selectedMetricMeta.label} при CTR ${fmtPercent(optimizationTarget.ctr)}.`,
              tone: "warning",
            });
          }
        }
      }
    }

    const ivtRisk = dependencyRows.reduce((worst, row) => (row.ivtRate > worst.ivtRate ? row : worst), dependencyRows[0]);
    insights.push({
      title: ivtRisk.ivtRate >= 0.03 ? "Риск качества трафика" : "Качество трафика",
      text:
        ivtRisk.ivtRate >= 0.03
          ? `Максимальный IVT у «${ivtRisk.name}»: ${fmtPercent(ivtRisk.ivtRate, 1)}. Проверьте площадки и таргетинг.`
          : `В топе по метрике максимальный IVT: ${fmtPercent(ivtRisk.ivtRate, 1)} — критичных отклонений нет.`,
      tone: ivtRisk.ivtRate >= 0.03 ? "warning" : "neutral",
    });

    return insights.slice(0, 3);
  }, [dependencyRows, barMetric, selectedMetricMeta]);

  const applyPreset = (nextPreset: "none" | "impressions" | "ctr" | "reach") => {
    setPreset(nextPreset);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
    if (nextPreset === "impressions") {
      setSorting([{ id: "impressions", desc: true }]);
    }
    if (nextPreset === "ctr") {
      setSorting([{ id: "ctr", desc: true }]);
    }
    if (nextPreset === "reach") {
      setSorting([{ id: "reach", desc: false }]);
    }
  };

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Эффективность"
        subtitle="Таблица эффективности с переключаемым измерением и расширенными метриками качества трафика."
      />

      <section className="rounded-xl border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => applyPreset("impressions")}
            className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50"
          >
            Топ по показам
          </button>
          <button
            onClick={() => applyPreset("ctr")}
            className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50"
          >
            Топ по CTR
          </button>
          <button
            onClick={() => applyPreset("reach")}
            className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50"
          >
            Провалы по охвату
          </button>
          <button
            onClick={() => applyPreset("none")}
            className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50"
          >
            Сброс пресета
          </button>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию или ID"
            className="ml-auto rounded-md border px-3 py-1.5 text-xs"
          />
        </div>

        <div className="mb-3 rounded-xl border bg-white p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">
              Зависимость CTR и метрики «{selectedMetricMeta.label}»
            </h3>
            <div className="ml-auto flex flex-wrap gap-2">
              {(["spend", "cpa", "cpc", "cpm"] as PerformanceChartMetric[]).map((metric) => (
                <button
                  key={metric}
                  onClick={() => setBarMetric(metric)}
                  className={`rounded-full px-3 py-1 text-xs ring-1 ${
                    barMetric === metric
                      ? "bg-sky-600 text-white ring-sky-600"
                      : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {PERFORMANCE_CHART_METRIC_META[metric].label}
                </button>
              ))}
            </div>
          </div>
          <p className="mb-2 text-[11px] text-slate-500">
            Столбцы: {selectedMetricMeta.label}. Линия: CTR. Так проще увидеть, где рост стоимости не даёт роста
            кликабельности.
          </p>

          {perfRes.loading ? (
            <ChartSkeleton />
          ) : !dependencyRows.length ? (
            <EmptyState text={`Нет данных для метрики «${selectedMetricMeta.label}» по текущим фильтрам`} />
          ) : (
            <>
              <div className="h-72">
                <ResponsiveContainer>
                  <ComposedChart data={dependencyRows} margin={{ top: 8, right: 18, left: 8, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="shortName"
                      interval={0}
                      angle={-12}
                      textAnchor="end"
                      height={52}
                      tick={CHART_TICK_STYLE}
                      tickMargin={8}
                    />
                    <YAxis
                      yAxisId="metric"
                      tick={CHART_TICK_STYLE}
                      width={96}
                      tickFormatter={(value) => selectedMetricMeta.valueFormatter(Number(value))}
                    />
                    <YAxis
                      yAxisId="ctr"
                      orientation="right"
                      tick={CHART_TICK_STYLE}
                      width={56}
                      domain={[0, "auto"]}
                      tickFormatter={(value) => fmtPercent(Number(value), 1)}
                    />
                    {ctrMedian !== null && (
                      <ReferenceLine yAxisId="ctr" y={ctrMedian} stroke="#94a3b8" strokeDasharray="4 4" />
                    )}
                    <Tooltip
                      labelFormatter={(_, payload) =>
                        Array.isArray(payload) && payload[0]?.payload?.name
                          ? String(payload[0].payload.name)
                          : ""
                      }
                      formatter={(value, key) =>
                        key === "ctr"
                          ? [fmtPercent(Number(value), 2), "CTR"]
                          : [selectedMetricMeta.valueFormatter(Number(value)), selectedMetricMeta.label]
                      }
                      contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                    />
                    <Bar
                      yAxisId="metric"
                      dataKey="metricValue"
                      name={selectedMetricMeta.label}
                      maxBarSize={38}
                      fill="#35a8e0"
                      radius={[6, 6, 0, 0]}
                    />
                    <Line
                      yAxisId="ctr"
                      type="monotone"
                      dataKey="ctr"
                      name="CTR"
                      stroke="#84bc00"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {dependencyInsights.map((insight) => (
                  <div
                    key={`${insight.title}-${insight.text}`}
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      insight.tone === "positive"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : insight.tone === "warning"
                          ? "border-amber-200 bg-amber-50 text-amber-900"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="mb-1 font-semibold">{insight.title}</div>
                    <div>{insight.text}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {perfRes.loading ? (
          <ChartSkeleton />
        ) : !filteredRows.length ? (
          <EmptyState text="Нет данных по текущим условиям" />
        ) : (
          <PerformanceDataTable
            rows={tableRows}
            tableDimension={tableDimension}
            pageCount={pageCount}
            sorting={sorting}
            columnVisibility={columnVisibility}
            pagination={pagination}
            onSortingChange={setSorting}
            onColumnVisibilityChange={setColumnVisibility}
            onPaginationChange={setPagination}
          />
        )}
      </section>
    </div>
  );
}

function VerificationSection(props: {
  filters: Filters;
  grain: "day" | "hour";
  excludedDomains: string[];
  onAddExclusion: (domain: string) => void;
  onRemoveExclusion: (domain: string) => void;
}) {
  const { filters, grain, excludedDomains, onAddExclusion, onRemoveExclusion } = props;
  type MonitoringDimension = "campaign" | "placement" | "supplier";
  type VerificationTableLevel = "campaign" | "placement" | "creative";
  type VerificationMainTableRow = {
    key: string;
    campaignId: number;
    campaignName: string;
    placementId: number;
    placementName: string;
    creativeId: number;
    creativeName: string;
    name: string;
    impressions: number;
    validImpressions: number;
    ivtImpressions: number;
    givtImpressions: number;
    sivtImpressions: number;
    ivtRate: number;
    givtRate: number;
    sivtRate: number;
    measurableIab: number;
    viewableImpressions: number;
    viewabilityRate: number;
    clicks: number;
    validClicks: number;
    ivtClicks: number;
    givtClicks: number;
    sivtClicks: number;
    ctr: number;
    ivtClickRate: number;
    givtClickRate: number;
    sivtClickRate: number;
    validImpressionsRate: number;
    validClicksRate: number;
  };
  const [environmentFormatFilter, setEnvironmentFormatFilter] = useState<"all" | "display" | "video">("all");
  const [tableViewMode, setTableViewMode] = useState<"short" | "extended" | "full">("extended");
  const [tableValueMode, setTableValueMode] = useState<"absolute" | "percent">("absolute");
  const [tableLevel, setTableLevel] = useState<VerificationTableLevel>("campaign");
  const [tableScopeCampaignId, setTableScopeCampaignId] = useState<number | null>(null);
  const [tableScopeCampaignName, setTableScopeCampaignName] = useState<string>("");
  const [tableScopePlacementId, setTableScopePlacementId] = useState<number | null>(null);
  const [tableScopePlacementName, setTableScopePlacementName] = useState<string>("");
  const [benchmarkPreset, setBenchmarkPreset] = useState<"adriver" | "arir">("adriver");
  const [monitoringDimension, setMonitoringDimension] = useState<MonitoringDimension>(
    filters.tableDimension === "placement"
      ? "placement"
      : filters.tableDimension === "supplier"
        ? "supplier"
        : "campaign"
  );
  const [monitoringWorseFilters, setMonitoringWorseFilters] = useState({
    givt: false,
    sivt: false,
    viewability: false,
  });

  const keyBase = JSON.stringify(filters);
  const tableScopeKey = `${tableLevel}:${tableScopeCampaignId ?? "all"}:${tableScopePlacementId ?? "all"}`;
  const activeBenchmarkSet = VERIFICATION_BENCHMARKS[benchmarkPreset].values;

  const tableFilters = useMemo(() => {
    const next: Filters = {
      ...filters,
      campaignIds: [...filters.campaignIds],
      placementIds: [...filters.placementIds],
    };
    if (tableScopeCampaignId !== null) {
      next.campaignIds = [tableScopeCampaignId];
    }
    if (tableScopePlacementId !== null) {
      next.placementIds = [tableScopePlacementId];
    }
    return next;
  }, [filters, tableScopeCampaignId, tableScopePlacementId]);

  const tableDimensions = useMemo(() => {
    if (tableLevel === "campaign") return ["campaignId", "campaignName"] as const;
    if (tableLevel === "placement") return ["placementId", "placementName", "campaignId", "campaignName"] as const;
    return ["creativeId", "creativeName", "placementId", "placementName", "campaignId", "campaignName"] as const;
  }, [tableLevel]);

  const kpiRes = useAsyncResource(`ver-kpi-${keyBase}`, () => selectVerificationKpis(filters), EMPTY_RESPONSE);
  const ivtSeriesRes = useAsyncResource(
    `ver-series-${keyBase}`,
    () => selectVerificationTimeseries(filters),
    EMPTY_RESPONSE
  );
  const worstDomainsRes = useAsyncResource(
    `ver-worst-${keyBase}`,
    () => selectWorstDomains(filters),
    EMPTY_RESPONSE
  );
  const benchDeviceRes = useAsyncResource(
    `ver-bench-device-${keyBase}`,
    () => selectVerificationByDevice(filters),
    EMPTY_RESPONSE
  );
  const environmentRes = useAsyncResource(
    `ver-env-breakdown-${keyBase}`,
    () =>
      query({
        filters,
        dimensions: ["deviceType", "cookiesFlag", "format"],
        metrics: ["impressions", "givtRate", "sivtRate"],
        sort: [{ field: "impressions", dir: "desc" }],
      }),
    EMPTY_RESPONSE
  );
  const monitoringRes = useAsyncResource(
    `ver-monitoring-${monitoringDimension}-${keyBase}`,
    () => selectMonitoringRows(filters, monitoringDimension),
    EMPTY_RESPONSE
  );
  const mainTableRes = useAsyncResource(
    `ver-main-table-${tableScopeKey}-${keyBase}`,
    () =>
      query({
        filters: tableFilters,
        dimensions: [...tableDimensions],
        metrics: [
          "impressions",
          "validImpressions",
          "givtImpressions",
          "sivtImpressions",
          "viewableImpressions",
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
        ],
        sort: [{ field: "impressions", dir: "desc" }],
        limit: 500,
      }),
    EMPTY_RESPONSE
  );
  const placementEnvironmentDistRes = useAsyncResource(
    `ver-placement-environment-dist-${keyBase}`,
    () =>
      query({
        filters,
        dimensions: ["placementEnvironment"],
        metrics: ["impressions"],
        sort: [{ field: "impressions", dir: "desc" }],
      }),
    EMPTY_RESPONSE
  );
  const impressionsByTimeRes = useAsyncResource(
    `ver-impressions-by-time-${keyBase}`,
    () =>
      query({
        filters,
        dimensions: filters.grain === "hour" ? ["date", "hour"] : ["date"],
        metrics: ["impressions", "validImpressions"],
        sort: [
          { field: "date", dir: "asc" },
          { field: "hour", dir: "asc" },
        ],
      }),
    EMPTY_RESPONSE
  );
  const clicksByTimeRes = useAsyncResource(
    `ver-clicks-by-time-${keyBase}`,
    () =>
      query({
        filters,
        dimensions: filters.grain === "hour" ? ["date", "hour"] : ["date"],
        metrics: ["clicks", "validClicks"],
        sort: [
          { field: "date", dir: "asc" },
          { field: "hour", dir: "asc" },
        ],
      }),
    EMPTY_RESPONSE
  );

  const row = (kpiRes.data.rows[0] ?? {}) as Record<string, unknown>;
  const impressions = safeNumber(row.impressions);
  const ivt = safeNumber(row.ivtRate);
  const givt = safeNumber(row.givtRate);
  const sivt = safeNumber(row.sivtRate);
  const safety = safeNumber(row.brandSafetyRate);
  const givtImpr = safeNumber(row.givtImpressions);
  const sivtImpr = safeNumber(row.sivtImpressions);
  const validImpressions = safeNumber(row.validImpressions);
  const validClicks = safeNumber(row.validClicks);
  const ivtClicks = safeNumber(row.ivtClicks);
  const givtClicks = safeNumber(row.givtClicks);
  const sivtClicks = safeNumber(row.sivtClicks);
  const viewabilityRate = safeNumber(row.viewabilityRate);
  const viewableImpressions = safeNumber(row.viewableImpressions);
  const invalidImpressions = Math.max(0, impressions - validImpressions);
  const validImpressionsShare = impressions > 0 ? validImpressions / impressions : 0;
  const viewableShare = impressions > 0 ? viewableImpressions / impressions : 0;

  const ivtSeries = useMemo(() => {
    return (ivtSeriesRes.data.rows as Record<string, unknown>[]).map((r) => ({
      label: buildTimelineLabel(r, grain),
      ivtRate: safeNumber(r.ivtRate),
      givtRate: safeNumber(r.givtRate),
      sivtRate: safeNumber(r.sivtRate),
    }));
  }, [ivtSeriesRes.data.rows, grain]);

  const worstDomains = useMemo(() => {
    return (worstDomainsRes.data.rows as Record<string, unknown>[]).map((r) => ({
      domain: String(r.domain ?? "—"),
      impressions: safeNumber(r.impressions),
      invalidImpressions: Math.max(0, safeNumber(r.impressions) - safeNumber(r.validImpressions)),
      ivtRate: safeNumber(r.ivtRate),
      givtRate: safeNumber(r.givtRate),
      sivtRate: safeNumber(r.sivtRate),
      brandSafetyRate: safeNumber(r.brandSafetyRate),
      viewabilityRate: safeNumber(r.viewabilityRate),
    }));
  }, [worstDomainsRes.data.rows]);

  const byDevice = useMemo(
    () =>
      (benchDeviceRes.data.rows as Record<string, unknown>[]).map((r) => ({
        name: String(r.deviceType ?? "—"),
        impressions: safeNumber(r.impressions),
        ivtRate: safeNumber(r.ivtRate),
        givtRate: safeNumber(r.givtRate),
        sivtRate: safeNumber(r.sivtRate),
        viewabilityRate: safeNumber(r.viewabilityRate),
      })),
    [benchDeviceRes.data.rows]
  );

  const deviceSummaryRows = useMemo(() => {
    const order = ["ПК и ноутбуки", "Смартфоны", "Планшеты", "Смарт ТВ", "Прочее"] as const;
    const grouped = new Map<string, number>(order.map((item) => [item, 0]));

    byDevice.forEach((item) => {
      const normalized = item.name.trim().toLowerCase();
      let label = "Прочее";
      if (normalized.includes("desktop")) label = "ПК и ноутбуки";
      else if (normalized.includes("mobile")) label = "Смартфоны";
      else if (normalized.includes("tablet")) label = "Планшеты";
      else if (normalized.includes("ctv") || normalized.includes("tv")) label = "Смарт ТВ";
      grouped.set(label, (grouped.get(label) ?? 0) + item.impressions);
    });

    const total = Array.from(grouped.values()).reduce((acc, value) => acc + value, 0);
    return order
      .map((label) => {
        const impressions = grouped.get(label) ?? 0;
        return {
          label,
          impressions,
          share: total > 0 ? impressions / total : 0,
        };
      })
      .filter((row) => row.impressions > 0);
  }, [byDevice]);

  const byEnvironment = useMemo(() => {
    type Bucket = { name: string; impressions: number; givtWeighted: number; sivtWeighted: number };
    const buckets: Record<string, Bucket> = {
      mobileWeb: { name: "Мобильный веб", impressions: 0, givtWeighted: 0, sivtWeighted: 0 },
      desktopWeb: { name: "Десктопный веб", impressions: 0, givtWeighted: 0, sivtWeighted: 0 },
      mobileApps: { name: "Мобильные приложения", impressions: 0, givtWeighted: 0, sivtWeighted: 0 },
      ctv: { name: "CTV", impressions: 0, givtWeighted: 0, sivtWeighted: 0 },
    };

    const append = (key: keyof typeof buckets, impressions: number, givtRate: number, sivtRate: number) => {
      const bucket = buckets[key];
      bucket.impressions += impressions;
      bucket.givtWeighted += givtRate * impressions;
      bucket.sivtWeighted += sivtRate * impressions;
    };

    (environmentRes.data.rows as Record<string, unknown>[]).forEach((row) => {
      const deviceType = String(row.deviceType ?? "");
      const format = String(row.format ?? "").toLowerCase();
      const cookiesFlag = Boolean(row.cookiesFlag);
      const impressions = safeNumber(row.impressions);
      const givtRate = safeNumber(row.givtRate);
      const sivtRate = safeNumber(row.sivtRate);
      if (impressions <= 0) return;
      if (environmentFormatFilter !== "all" && format !== environmentFormatFilter) return;

      if (deviceType === "CTV") {
        append("ctv", impressions, givtRate, sivtRate);
        return;
      }

      if (deviceType === "Desktop") {
        append("desktopWeb", impressions, givtRate, sivtRate);
        return;
      }

      if (deviceType === "Mobile" || deviceType === "Tablet") {
        if (cookiesFlag) append("mobileWeb", impressions, givtRate, sivtRate);
        else append("mobileApps", impressions, givtRate, sivtRate);
      }
    });

    return [buckets.mobileWeb, buckets.desktopWeb, buckets.mobileApps, buckets.ctv]
      .filter((item) => item.impressions > 0)
      .map((item) => ({
        name: item.name,
        givtRate: item.givtWeighted / Math.max(1, item.impressions),
        sivtRate: item.sivtWeighted / Math.max(1, item.impressions),
      }));
  }, [environmentRes.data.rows, environmentFormatFilter]);

  const webtypeSummaryRows = useMemo(() => {
    const order = ["In-app", "Web Mobile", "Web Webview", "Web Прочее"] as const;
    const grouped = new Map<string, number>(order.map((item) => [item, 0]));

    (placementEnvironmentDistRes.data.rows as Record<string, unknown>[]).forEach((row) => {
      const label = String(row.placementEnvironment ?? "") as (typeof order)[number];
      if (!order.includes(label)) return;
      grouped.set(label, (grouped.get(label) ?? 0) + safeNumber(row.impressions));
    });

    const total = Array.from(grouped.values()).reduce((acc, value) => acc + value, 0);
    return order
      .map((label) => {
        const impressions = grouped.get(label) ?? 0;
        return {
          label,
          impressions,
          share: total > 0 ? impressions / total : 0,
        };
      })
      .filter((row) => row.impressions > 0);
  }, [placementEnvironmentDistRes.data.rows]);

  const mainTableRows = useMemo<VerificationMainTableRow[]>(
    () =>
      (mainTableRes.data.rows as Record<string, unknown>[]).map((r) => {
        const rowImpressions = safeNumber(r.impressions);
        const rowValidImpressions = safeNumber(r.validImpressions);
        const rowClicks = safeNumber(r.clicks);
        const rowViewable = safeNumber(r.viewableImpressions);
        const rowValidClicks = safeNumber(r.validClicks);
        const rowIvtClicks = safeNumber(r.ivtClicks);
        const rowCampaignId = safeNumber(r.campaignId);
        const rowPlacementId = safeNumber(r.placementId);
        const rowCreativeId = safeNumber(r.creativeId);
        const rowCampaignName = String(r.campaignName ?? "—");
        const rowPlacementName = String(r.placementName ?? "—");
        const rowCreativeName = String(r.creativeName ?? "—");

        let rowName = "—";
        if (tableLevel === "campaign") {
          rowName = `${rowCampaignId} ${rowCampaignName}`;
        } else if (tableLevel === "placement") {
          rowName = `${rowPlacementId} ${rowPlacementName}`;
        } else {
          rowName = `${rowCreativeId} ${rowCreativeName}`;
        }

        return {
          key: `${tableLevel}:${rowName}`,
          campaignId: rowCampaignId,
          campaignName: rowCampaignName,
          placementId: rowPlacementId,
          placementName: rowPlacementName,
          creativeId: rowCreativeId,
          creativeName: rowCreativeName,
          name: rowName,
          impressions: rowImpressions,
          validImpressions: rowValidImpressions,
          ivtImpressions: Math.max(0, rowImpressions - rowValidImpressions),
          givtImpressions: safeNumber(r.givtImpressions),
          sivtImpressions: safeNumber(r.sivtImpressions),
          ivtRate: safeNumber(r.ivtRate),
          givtRate: safeNumber(r.givtRate),
          sivtRate: safeNumber(r.sivtRate),
          measurableIab: rowImpressions,
          viewableImpressions: rowViewable,
          viewabilityRate: safeNumber(r.viewabilityRate),
          clicks: rowClicks,
          validClicks: rowValidClicks,
          ivtClicks: rowIvtClicks,
          givtClicks: safeNumber(r.givtClicks),
          sivtClicks: safeNumber(r.sivtClicks),
          ctr: safeNumber(r.ctr),
          ivtClickRate: safeNumber(r.ivtClickRate),
          givtClickRate: safeNumber(r.givtClickRate),
          sivtClickRate: safeNumber(r.sivtClickRate),
          validImpressionsRate: rowImpressions > 0 ? rowValidImpressions / rowImpressions : 0,
          validClicksRate: rowClicks > 0 ? rowValidClicks / rowClicks : 0,
        };
      }),
    [mainTableRes.data.rows, tableLevel]
  );

  const dimensionLabel = useMemo(() => {
    if (tableLevel === "campaign") return "Кампания";
    if (tableLevel === "placement") return "Размещение";
    return "Креатив";
  }, [tableLevel]);

  const impressionsByTime = useMemo(
    () =>
      (impressionsByTimeRes.data.rows as Record<string, unknown>[]).map((r) => {
        const total = safeNumber(r.impressions);
        const valid = safeNumber(r.validImpressions);
        return {
          label: buildTimelineLabel(r, grain),
          valid,
          invalid: Math.max(0, total - valid),
        };
      }),
    [impressionsByTimeRes.data.rows, grain]
  );

  const clicksByTime = useMemo(
    () =>
      (clicksByTimeRes.data.rows as Record<string, unknown>[]).map((r) => {
        const total = safeNumber(r.clicks);
        const valid = safeNumber(r.validClicks);
        return {
          label: buildTimelineLabel(r, grain),
          valid,
          invalid: Math.max(0, total - valid),
        };
      }),
    [clicksByTimeRes.data.rows, grain]
  );

  const compactFormatter = useMemo(
    () => new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 }),
    []
  );

  const monitoringRows = useMemo(() => {
    type Cell = {
      givtRate: number;
      sivtRate: number;
      viewabilityRate: number;
      impressions: number;
    };
    type MonitoringRow = {
      id: string;
      name: string;
      cells: Record<string, Cell>;
    };

    const out = new Map<string, MonitoringRow>();
    (monitoringRes.data.rows as Record<string, unknown>[]).forEach((rowItem) => {
      const format = String(rowItem.format ?? "").toLowerCase();
      const deviceType = String(rowItem.deviceType ?? "");
      if (!(format === "display" || format === "video")) return;
      if (!(deviceType === "Desktop" || deviceType === "Mobile")) return;

      const idValue =
        monitoringDimension === "placement"
          ? safeNumber(rowItem.placementId)
          : monitoringDimension === "supplier"
            ? String(rowItem.supplier ?? "—")
            : safeNumber(rowItem.campaignId);
      const nameValue =
        monitoringDimension === "placement"
          ? String(rowItem.placementName ?? "—")
          : monitoringDimension === "supplier"
            ? String(rowItem.supplier ?? "—")
            : String(rowItem.campaignName ?? "—");
      const key = `${String(idValue)}:${nameValue}`;
      const cellKey = `${deviceType}:${format}`;
      const current = out.get(key) ?? { id: key, name: nameValue, cells: {} };
      current.cells[cellKey] = {
        givtRate: safeNumber(rowItem.givtRate),
        sivtRate: safeNumber(rowItem.sivtRate),
        viewabilityRate: safeNumber(rowItem.viewabilityRate),
        impressions: safeNumber(rowItem.impressions),
      };
      out.set(key, current);
    });

    return Array.from(out.values());
  }, [monitoringRes.data.rows, monitoringDimension]);

  const benchmarkRows = useMemo(
    () =>
      (Object.entries(activeBenchmarkSet) as Array<
        [keyof typeof activeBenchmarkSet, (typeof activeBenchmarkSet)[keyof typeof activeBenchmarkSet]]
      >).flatMap(([format, byDevice]) =>
        (Object.entries(byDevice) as Array<[keyof typeof byDevice, (typeof byDevice)[keyof typeof byDevice]]>).map(
          ([device, values]) => ({
            key: `${String(format)}-${String(device)}`,
            format: format === "display" ? "Баннер" : "Видео",
            device: device === "Desktop" ? "Desktop" : "Mobile",
            givtRate: values.givtRate,
            sivtRate: values.sivtRate,
            viewabilityRate: values.viewabilityRate,
          })
        )
      ),
    [activeBenchmarkSet]
  );

  const severityFromBenchmark = (
    value: number,
    benchmark: number,
    mode: "higher-is-worse" | "lower-is-worse"
  ): 0 | 1 | 2 | 3 => {
    if (!Number.isFinite(value) || !Number.isFinite(benchmark) || benchmark <= 0) return 0;
    if (mode === "higher-is-worse") {
      if (value <= benchmark) return 0;
      const ratio = value / benchmark;
      if (ratio >= 2) return 3;
      if (ratio >= 1.5) return 2;
      return 1;
    }
    if (value >= benchmark) return 0;
    const ratio = benchmark / Math.max(value, 1e-9);
    if (ratio >= 2) return 3;
    if (ratio >= 1.5) return 2;
    return 1;
  };

  const cellToneBySeverity: Record<number, string> = {
    0: "border-slate-200 bg-white",
    1: "border-amber-200 bg-white",
    2: "border-rose-200 bg-white",
    3: "border-rose-300 bg-white",
  };

  const statusBySeverity: Record<number, { label: string; className: string }> = {
    0: { label: "OK", className: "border border-emerald-200 bg-emerald-50 text-emerald-700" },
    1: { label: "Внимание", className: "border border-amber-200 bg-amber-50 text-amber-700" },
    2: { label: "Риск", className: "border border-rose-200 bg-rose-50 text-rose-700" },
    3: { label: "Критично", className: "border border-rose-300 bg-rose-100 text-rose-800" },
  };

  const deltaVsBenchmark = (
    value: number,
    benchmark: number,
    mode: "higher-is-worse" | "lower-is-worse"
  ): { label: string; className: string } => {
    if (!Number.isFinite(value) || !Number.isFinite(benchmark)) {
      return { label: "—", className: "text-slate-400" };
    }
    const delta = value - benchmark;
    if (Math.abs(delta) < 1e-9) {
      return { label: "0.0 п.п.", className: "text-slate-500" };
    }
    const isBad = mode === "higher-is-worse" ? delta > 0 : delta < 0;
    return {
      label: `${delta > 0 ? "+" : ""}${(delta * 100).toFixed(1)} п.п.`,
      className: isBad ? "text-rose-600" : "text-emerald-600",
    };
  };

  const hierarchyLevelLabel =
    tableLevel === "campaign" ? "Кампании" : tableLevel === "placement" ? "Размещения" : "Креативы";
  const canGoNextLevel = tableLevel !== "creative";
  const canGoBackLevel = tableLevel !== "campaign";

  const moveToNextLevel = () => {
    if (tableLevel === "campaign") {
      setTableLevel("placement");
      return;
    }
    if (tableLevel === "placement") {
      setTableLevel("creative");
    }
  };

  const moveBackLevel = () => {
    if (tableLevel === "creative") {
      setTableLevel("placement");
      setTableScopePlacementId(null);
      setTableScopePlacementName("");
      return;
    }
    if (tableLevel === "placement") {
      setTableLevel("campaign");
      setTableScopeCampaignId(null);
      setTableScopeCampaignName("");
      setTableScopePlacementId(null);
      setTableScopePlacementName("");
    }
  };

  const resetDetailing = () => {
    setTableLevel("campaign");
    setTableScopeCampaignId(null);
    setTableScopeCampaignName("");
    setTableScopePlacementId(null);
    setTableScopePlacementName("");
  };

  const canDrillIntoRow = (item: VerificationMainTableRow): boolean => {
    if (tableLevel === "campaign") return item.campaignId > 0;
    if (tableLevel === "placement") return item.placementId > 0;
    return false;
  };

  const drillIntoRow = (item: VerificationMainTableRow) => {
    if (tableLevel === "campaign" && item.campaignId > 0) {
      setTableLevel("placement");
      setTableScopeCampaignId(item.campaignId);
      setTableScopeCampaignName(item.campaignName);
      setTableScopePlacementId(null);
      setTableScopePlacementName("");
      return;
    }
    if (tableLevel === "placement" && item.placementId > 0) {
      setTableLevel("creative");
      setTableScopeCampaignId(item.campaignId);
      setTableScopeCampaignName(item.campaignName);
      setTableScopePlacementId(item.placementId);
      setTableScopePlacementName(item.placementName);
    }
  };

  const tableScopeLabel = [
    tableScopeCampaignId !== null ? `Кампания: ${tableScopeCampaignId} ${tableScopeCampaignName}` : "",
    tableScopePlacementId !== null ? `Размещение: ${tableScopePlacementId} ${tableScopePlacementName}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const hasDetailing = tableLevel !== "campaign" || tableScopeCampaignId !== null || tableScopePlacementId !== null;

  const tableTotals = useMemo(() => {
    const totals = mainTableRows.reduce(
      (acc, rowItem) => {
        acc.impressions += rowItem.impressions;
        acc.validImpressions += rowItem.validImpressions;
        acc.ivtImpressions += rowItem.ivtImpressions;
        acc.givtImpressions += rowItem.givtImpressions;
        acc.sivtImpressions += rowItem.sivtImpressions;
        acc.viewableImpressions += rowItem.viewableImpressions;
        acc.clicks += rowItem.clicks;
        acc.validClicks += rowItem.validClicks;
        acc.ivtClicks += rowItem.ivtClicks;
        acc.givtClicks += rowItem.givtClicks;
        acc.sivtClicks += rowItem.sivtClicks;
        acc.givtWeighted += rowItem.givtRate * rowItem.impressions;
        acc.sivtWeighted += rowItem.sivtRate * rowItem.impressions;
        return acc;
      },
      {
        impressions: 0,
        validImpressions: 0,
        ivtImpressions: 0,
        givtImpressions: 0,
        sivtImpressions: 0,
        viewableImpressions: 0,
        clicks: 0,
        validClicks: 0,
        ivtClicks: 0,
        givtClicks: 0,
        sivtClicks: 0,
        givtWeighted: 0,
        sivtWeighted: 0,
      }
    );

    const baseImpressions = totals.impressions;
    const baseClicks = totals.clicks;
    const ivtRateTotal = baseImpressions > 0 ? totals.ivtImpressions / baseImpressions : 0;
    const givtRateTotal = baseImpressions > 0 ? totals.givtWeighted / baseImpressions : 0;
    const sivtRateTotal = baseImpressions > 0 ? totals.sivtWeighted / baseImpressions : 0;
    const viewabilityRateTotal = baseImpressions > 0 ? totals.viewableImpressions / baseImpressions : 0;
    const ctrTotal = baseImpressions > 0 ? totals.clicks / baseImpressions : 0;
    const ivtClickRateTotal = baseClicks > 0 ? totals.ivtClicks / baseClicks : 0;
    const givtClickRateTotal = baseClicks > 0 ? totals.givtClicks / baseClicks : 0;
    const sivtClickRateTotal = baseClicks > 0 ? totals.sivtClicks / baseClicks : 0;
    const validImpressionsRateTotal = baseImpressions > 0 ? totals.validImpressions / baseImpressions : 0;
    const validClicksRateTotal = baseClicks > 0 ? totals.validClicks / baseClicks : 0;

    return {
      impressions: totals.impressions,
      validImpressions: totals.validImpressions,
      ivtImpressions: totals.ivtImpressions,
      givtImpressions: totals.givtImpressions,
      sivtImpressions: totals.sivtImpressions,
      viewableImpressions: totals.viewableImpressions,
      measurableIab: totals.impressions,
      clicks: totals.clicks,
      validClicks: totals.validClicks,
      ivtClicks: totals.ivtClicks,
      givtClicks: totals.givtClicks,
      sivtClicks: totals.sivtClicks,
      ivtRate: ivtRateTotal,
      givtRate: givtRateTotal,
      sivtRate: sivtRateTotal,
      viewabilityRate: viewabilityRateTotal,
      ctr: ctrTotal,
      ivtClickRate: ivtClickRateTotal,
      givtClickRate: givtClickRateTotal,
      sivtClickRate: sivtClickRateTotal,
      validImpressionsRate: validImpressionsRateTotal,
      validClicksRate: validClicksRateTotal,
    };
  }, [mainTableRows]);

  const absoluteMetricColumnsByMode = {
    short: ["impressions", "validImpressions", "clicks"],
    extended: [
      "impressions",
      "validImpressions",
      "clicks",
      "validClicks",
      "ivtImpressions",
      "givtImpressions",
      "sivtImpressions",
      "ivtClicks",
      "givtClicks",
      "sivtClicks",
      "viewableImpressions",
    ],
    full: [
      "impressions",
      "validImpressions",
      "clicks",
      "validClicks",
      "ivtImpressions",
      "givtImpressions",
      "sivtImpressions",
      "ivtClicks",
      "givtClicks",
      "sivtClicks",
      "measurableIab",
      "viewableImpressions",
    ],
  } as const;
  const percentMetricColumnsByMode = {
    short: ["ctr", "ivtRate", "viewabilityRate"],
    extended: [
      "validImpressionsRate",
      "ctr",
      "ivtRate",
      "givtRate",
      "sivtRate",
      "ivtClickRate",
      "givtClickRate",
      "sivtClickRate",
      "viewabilityRate",
    ],
    full: [
      "validImpressionsRate",
      "validClicksRate",
      "ctr",
      "ivtRate",
      "givtRate",
      "sivtRate",
      "ivtClickRate",
      "givtClickRate",
      "sivtClickRate",
      "viewabilityRate",
    ],
  } as const;
  type TableMetricId =
    | (typeof absoluteMetricColumnsByMode)["full"][number]
    | (typeof percentMetricColumnsByMode)["full"][number];

  const metricColumnLabels: Record<TableMetricId, string> = {
    impressions: "Показы",
    validImpressions: "Засчитано показов",
    ivtImpressions: "IVT показы",
    givtImpressions: "Показы GIVT",
    sivtImpressions: "Показы SIVT",
    measurableIab: "Измеримо IAB",
    viewableImpressions: "Видимые IAB",
    clicks: "Клики",
    validClicks: "Засчитано кликов",
    ivtClicks: "IVT клики",
    givtClicks: "Клики GIVT",
    sivtClicks: "Клики SIVT",
    ivtRate: "IVT показы, %",
    givtRate: "Показы GIVT %",
    sivtRate: "Показы SIVT %",
    ivtClickRate: "IVT клики, %",
    givtClickRate: "Клики GIVT %",
    sivtClickRate: "Клики SIVT %",
    viewabilityRate: "Видимость%",
    ctr: "CTR%",
    validImpressionsRate: "Засчитано показов, %",
    validClicksRate: "Засчитано кликов, %",
  };
  const percentMetricIds = new Set<TableMetricId>([
    "ivtRate",
    "givtRate",
    "sivtRate",
    "ivtClickRate",
    "givtClickRate",
    "sivtClickRate",
    "viewabilityRate",
    "ctr",
    "validImpressionsRate",
    "validClicksRate",
  ]);
  const highlightedMetricIds = new Set<TableMetricId>(["validImpressions", "validClicks"]);

  const visibleMetricColumns: TableMetricId[] =
    tableValueMode === "absolute"
      ? [...absoluteMetricColumnsByMode[tableViewMode]]
      : [...percentMetricColumnsByMode[tableViewMode]];

  const formatTableMetricValue = (value: number, metric: TableMetricId): string => {
    if (percentMetricIds.has(metric)) return fmtPercent(value, 1);
    return fmtInt(value);
  };

  const monitoringRowsWithFlags = useMemo(() => {
    return monitoringRows.map((item) => {
      const flags = {
        givt: false,
        sivt: false,
        viewability: false,
      };
      Object.entries(item.cells).forEach(([cellKey, cell]) => {
        const [deviceRaw, formatRaw] = cellKey.split(":");
        if (!(deviceRaw === "Desktop" || deviceRaw === "Mobile")) return;
        if (!(formatRaw === "display" || formatRaw === "video")) return;
        const benchmark = activeBenchmarkSet[formatRaw][deviceRaw];
        if (cell.givtRate > benchmark.givtRate) flags.givt = true;
        if (cell.sivtRate > benchmark.sivtRate) flags.sivt = true;
        if (cell.viewabilityRate < benchmark.viewabilityRate) flags.viewability = true;
      });
      return { item, flags };
    });
  }, [monitoringRows, activeBenchmarkSet]);

  const monitoringWorseCounts = useMemo(
    () =>
      monitoringRowsWithFlags.reduce(
        (acc, entry) => {
          if (entry.flags.givt) acc.givt += 1;
          if (entry.flags.sivt) acc.sivt += 1;
          if (entry.flags.viewability) acc.viewability += 1;
          return acc;
        },
        { givt: 0, sivt: 0, viewability: 0 }
      ),
    [monitoringRowsWithFlags]
  );

  const visibleMonitoringRows = useMemo(() => {
    return monitoringRowsWithFlags
      .filter((entry) => {
        if (monitoringWorseFilters.givt && !entry.flags.givt) return false;
        if (monitoringWorseFilters.sivt && !entry.flags.sivt) return false;
        if (monitoringWorseFilters.viewability && !entry.flags.viewability) return false;
        return true;
      })
      .map((entry) => entry.item);
  }, [monitoringRowsWithFlags, monitoringWorseFilters]);

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Верификация"
        subtitle="Контроль качества инвентаря: засчитанные/видимые показы, IVT-структура и отклонения по площадкам."
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Засчитанные показы" value={fmtInt(validImpressions)} metricKey="validImpressions" />
        <MetricCard title="Засчитано показов, %" value={fmtPercent(validImpressionsShare)} metricKey="validImpressionsRate" />
        <MetricCard title="Засчитанные клики" value={fmtInt(validClicks)} metricKey="validClicks" />
        <MetricCard title="IVT показы" value={fmtInt(invalidImpressions)} metricKey="ivtImpressions" />
        <MetricCard title="IVT показы, %" value={fmtPercent(ivt)} metricKey="ivtRate" />
        <MetricCard title="Показы GIVT" value={fmtInt(givtImpr)} metricKey="givtImpressions" />
        <MetricCard title="Показы GIVT %" value={fmtPercent(givt)} metricKey="givtRate" />
        <MetricCard title="Показы SIVT" value={fmtInt(sivtImpr)} metricKey="sivtImpressions" />
        <MetricCard title="Показы SIVT %" value={fmtPercent(sivt)} metricKey="sivtRate" />
        <MetricCard title="IVT клики" value={fmtInt(ivtClicks)} metricKey="ivtClicks" />
        <MetricCard title="IVT клики, %" value={fmtPercent(safeNumber(row.ivtClickRate))} metricKey="ivtClickRate" />
        <MetricCard title="Клики GIVT" value={fmtInt(givtClicks)} metricKey="givtClicks" />
        <MetricCard title="Клики GIVT %" value={fmtPercent(safeNumber(row.givtClickRate))} metricKey="givtClickRate" />
        <MetricCard title="Клики SIVT" value={fmtInt(sivtClicks)} metricKey="sivtClicks" />
        <MetricCard title="Клики SIVT %" value={fmtPercent(safeNumber(row.sivtClickRate))} metricKey="sivtClickRate" />
        <MetricCard title="Видимые показы (IAB)" value={fmtInt(viewableImpressions)} metricKey="viewableImpressions" />
        <MetricCard title="Видимость (IAB), %" value={fmtPercent(viewabilityRate)} metricKey="viewabilityRate" />
        <MetricCard title="Brand safety, %" value={fmtPercent(safety)} metricKey="brandSafetyRate" />
      </section>

      <section className="rounded-xl border border-sky-200 bg-white p-4">
        <div className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-stretch">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-sky-100 bg-sky-50/40 p-3">
                  <div className="text-[42px] font-semibold leading-none text-sky-600">
                    {compactFormatter.format(validImpressions)}
                  </div>
                  <div className="mt-1 text-sm text-sky-700">Засчитано показов</div>
                </div>
                <div className="rounded-lg border border-rose-100 bg-rose-50/40 p-3">
                  <div className="text-[42px] font-semibold leading-none text-rose-500">{fmtPercent(ivt, 1)}</div>
                  <div className="mt-1 text-sm text-rose-600">IVT</div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <div className="space-y-2">
                  <div className="flex h-8 overflow-hidden rounded-sm bg-slate-100">
                    <div
                      className="bg-sky-600"
                      style={{ width: `${Math.max(0, Math.min(100, Math.max(2, (1 - ivt) * 100 * 0.06)))}%` }}
                    />
                    <div className="bg-sky-300" style={{ width: `${Math.max(0, Math.min(100, (1 - ivt) * 100))}%` }} />
                    <div className="bg-rose-500" style={{ width: `${Math.max(0, Math.min(100, ivt * 100))}%` }} />
                  </div>

                  <div className="flex h-4 overflow-hidden rounded-sm bg-slate-100">
                    <div className="bg-sky-300" style={{ width: `${Math.max(0, Math.min(100, viewableShare * 100))}%` }} />
                    <div
                      className="bg-slate-300"
                      style={{ width: `${Math.max(0, Math.min(100, (1 - viewableShare) * 100))}%` }}
                    />
                    <div className="bg-rose-500" style={{ width: `${Math.max(0, Math.min(100, ivt * 100 * 0.35))}%` }} />
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-[20px] font-medium text-slate-800">Измеримых IAB</div>
                    <div className="text-[22px] leading-tight text-sky-500 underline decoration-sky-300 underline-offset-4">
                      {fmtInt(impressions)} ({fmtPercent(validImpressionsShare, 1)})
                    </div>
                    <div className="mt-1 text-[22px] leading-tight text-slate-800">
                      Видимых показов{" "}
                      <span className="font-semibold text-sky-600 underline decoration-sky-300 underline-offset-4">
                        {fmtInt(viewableImpressions)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-start justify-end sm:items-end">
                    <div className="text-[62px] font-semibold leading-none text-sky-500">
                      {(viewabilityRate * 100).toFixed(1).replace(".", ",")}%
                    </div>
                    <div className="mt-2 text-[42px] font-medium leading-none text-sky-600">Видимость</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 xl:auto-rows-fr">
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-sky-100/60 text-slate-700">
                      <th className="px-3 py-2 text-left font-medium">Устройства</th>
                      <th className="px-3 py-2 text-right font-medium">Показы</th>
                      <th className="px-3 py-2 text-right font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deviceSummaryRows.map((row) => (
                      <tr key={row.label} className="odd:bg-white even:bg-slate-50/50">
                        <td className="border-t px-3 py-1.5 text-slate-800">{row.label}</td>
                        <td className="border-t px-3 py-1.5 text-right tabular-nums">{fmtInt(row.impressions)}</td>
                        <td className="border-t px-3 py-1.5 text-right tabular-nums">{fmtPercent(row.share, 2)}</td>
                      </tr>
                    ))}
                    {!deviceSummaryRows.length && (
                      <tr>
                        <td colSpan={3} className="border-t px-3 py-2 text-center text-slate-500">
                          Нет данных
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-sky-100/60 text-slate-700">
                      <th className="px-3 py-2 text-left font-medium">Тип среды</th>
                      <th className="px-3 py-2 text-right font-medium">Показы</th>
                      <th className="px-3 py-2 text-right font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {webtypeSummaryRows.map((row) => (
                      <tr key={row.label} className="odd:bg-white even:bg-slate-50/50">
                        <td className="border-t px-3 py-1.5 text-slate-800">{row.label}</td>
                        <td className="border-t px-3 py-1.5 text-right tabular-nums">{fmtInt(row.impressions)}</td>
                        <td className="border-t px-3 py-1.5 text-right tabular-nums">{fmtPercent(row.share, 2)}</td>
                      </tr>
                    ))}
                    {!webtypeSummaryRows.length && (
                      <tr>
                        <td colSpan={3} className="border-t px-3 py-2 text-center text-slate-500">
                          Нет данных
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200">
            <div className="border-b bg-slate-50 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-800">Основная таблица</div>
                <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 text-xs">
                  {(
                    [
                      ["short", "Краткий"],
                      ["extended", "Расширенный"],
                      ["full", "Полный"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTableViewMode(value)}
                      className={`rounded-full px-2.5 py-1 transition ${
                        tableViewMode === value
                          ? "bg-sky-600 text-white"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 text-xs">
                  {(
                    [
                      ["absolute", "Абсолютные"],
                      ["percent", "Процентные"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTableValueMode(value)}
                      className={`rounded-full px-2.5 py-1 transition ${
                        tableValueMode === value
                          ? "bg-sky-600 text-white"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={moveBackLevel}
                  disabled={!canGoBackLevel}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Вернуться
                </button>
                <button
                  type="button"
                  onClick={moveToNextLevel}
                  disabled={!canGoNextLevel}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Перейти на следующий уровень в иерархии"
                >
                  Следующий уровень
                </button>
                <button
                  type="button"
                  onClick={resetDetailing}
                  disabled={!hasDetailing}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Сброс детализации
                </button>
                <span className="text-xs text-slate-500">
                  Текущий уровень: <span className="font-semibold text-slate-700">{hierarchyLevelLabel}</span>
                </span>
                {tableScopeLabel && (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] text-sky-700">
                    {tableScopeLabel}
                  </span>
                )}
              </div>
            </div>
            {mainTableRes.loading ? (
              <div className="p-4">
                <ChartSkeleton />
              </div>
            ) : (
              <div className="max-h-[540px] overflow-auto">
                <table className="w-full border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-100">
                    <tr>
                      <th className="w-10 p-2 text-center">+</th>
                      <th className="p-2 text-left">{dimensionLabel}</th>
                      {visibleMetricColumns.map((metricId) => (
                        <th
                          key={`head-${metricId}`}
                          className={`p-2 text-right ${
                            highlightedMetricIds.has(metricId) ? "bg-sky-100/70" : ""
                          }`}
                        >
                          {metricColumnLabels[metricId]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mainTableRows.map((item) => (
                      <tr key={item.key} className="odd:bg-white even:bg-slate-50/50">
                        <td className="border-t p-2 text-center">
                          {canDrillIntoRow(item) ? (
                            <button
                              type="button"
                              onClick={() => drillIntoRow(item)}
                              className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-300 text-[12px] text-slate-700 hover:bg-slate-100"
                              aria-label="Детализация"
                              title="Детализация"
                            >
                              +
                            </button>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td
                          className="border-t p-2"
                          onContextMenu={(event) => {
                            if (!canDrillIntoRow(item)) return;
                            event.preventDefault();
                            drillIntoRow(item);
                          }}
                        >
                          <div className="line-clamp-1" title={item.name}>
                            {item.name}
                          </div>
                        </td>
                        {visibleMetricColumns.map((metricId) => (
                          <td
                            key={`${item.key}-${metricId}`}
                            className={`border-t p-2 text-right tabular-nums ${
                              highlightedMetricIds.has(metricId) ? "bg-sky-100/70" : ""
                            }`}
                          >
                            {formatTableMetricValue(item[metricId], metricId)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {!mainTableRows.length && (
                      <tr>
                        <td colSpan={visibleMetricColumns.length + 2} className="border-t p-4 text-center text-slate-500">
                          Нет данных для таблицы
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-slate-200/80 backdrop-blur">
                    <tr className="font-semibold text-slate-900">
                      <td className="border-t p-2 text-center">Σ</td>
                      <td className="border-t p-2">Всего</td>
                      {visibleMetricColumns.map((metricId) => (
                        <td
                          key={`total-${metricId}`}
                          className={`border-t p-2 text-right tabular-nums ${
                            highlightedMetricIds.has(metricId) ? "bg-sky-100/70" : ""
                          }`}
                        >
                          {formatTableMetricValue(tableTotals[metricId], metricId)}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border bg-white p-3">
          <h3 className="mb-2 text-sm font-semibold">Показы {grain === "hour" ? "по часам" : "по дням"}</h3>
          {impressionsByTimeRes.loading ? (
            <ChartSkeleton />
          ) : impressionsByTime.length ? (
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={impressionsByTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" minTickGap={22} tick={CHART_TICK_STYLE} />
                  <YAxis tick={CHART_TICK_STYLE} tickFormatter={(v) => fmtInt(Number(v))} />
                  <Tooltip
                    formatter={(v) => fmtInt(Number(v))}
                    contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  />
                  <Bar name="Засчитанные" dataKey="valid" stackId="imp-stack" fill="#8ccff0" />
                  <Bar name="Невалидные" dataKey="invalid" stackId="imp-stack" fill="#e20613" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState text="Нет данных по показам" />
          )}
        </div>

        <div className="rounded-xl border bg-white p-3">
          <h3 className="mb-2 text-sm font-semibold">Клики {grain === "hour" ? "по часам" : "по дням"}</h3>
          {clicksByTimeRes.loading ? (
            <ChartSkeleton />
          ) : clicksByTime.length ? (
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={clicksByTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" minTickGap={22} tick={CHART_TICK_STYLE} />
                  <YAxis tick={CHART_TICK_STYLE} tickFormatter={(v) => fmtInt(Number(v))} />
                  <Tooltip
                    formatter={(v) => fmtInt(Number(v))}
                    contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  />
                  <Bar name="Засчитанные" dataKey="valid" stackId="clk-stack" fill="#8ccff0" />
                  <Bar name="Невалидные" dataKey="invalid" stackId="clk-stack" fill="#e20613" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState text="Нет данных по кликам" />
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border bg-white p-3">
          <h3 className="mb-2 text-sm font-semibold">Динамика IVT / GIVT / SIVT</h3>
          {ivtSeriesRes.loading ? (
            <ChartSkeleton />
          ) : ivtSeries.length ? (
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={ivtSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" minTickGap={22} tick={CHART_TICK_STYLE} />
                  <YAxis tick={CHART_TICK_STYLE} tickFormatter={(v) => `${(Number(v) * 100).toFixed(1)}%`} />
                  <Tooltip
                    formatter={(v) => `${(Number(v) * 100).toFixed(2)}%`}
                    contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  />
                  <Line name="IVT%" dataKey="ivtRate" stroke="#e20613" strokeWidth={2} dot={false} />
                  <Line name="GIVT%" dataKey="givtRate" stroke="#f29100" strokeWidth={2} dot={false} />
                  <Line name="SIVT%" dataKey="sivtRate" stroke="#35a8e0" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState text="Нет данных по IVT" />
          )}
        </div>

        <div className="rounded-xl border bg-white p-3">
          <h3 className="mb-2 text-sm font-semibold">Исключенные домены</h3>
          <div className="flex flex-wrap gap-2">
            {excludedDomains.length ? (
              excludedDomains.map((domain) => (
                <button
                  key={domain}
                  onClick={() => onRemoveExclusion(domain)}
                  className="rounded-full border border-amber-400 bg-amber-50 px-3 py-1 text-xs text-amber-700"
                >
                  {domain} ×
                </button>
              ))
            ) : (
              <span className="text-xs text-gray-500">Список исключений пуст</span>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-3">
        <h3 className="mb-3 text-sm font-semibold">Худшие домены по IVT показы, %</h3>
        {worstDomainsRes.loading ? (
          <ChartSkeleton />
        ) : worstDomains.length ? (
          <div className="max-h-96 overflow-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left">Домен</th>
                  <th className="p-2 text-right">Показы</th>
                  <th className="p-2 text-right">IVT показы, %</th>
                  <th className="p-2 text-right">GIVT%</th>
                  <th className="p-2 text-right">SIVT%</th>
                  <th className="p-2 text-right">Brand safety, %</th>
                  <th className="p-2 text-right">Видимость, %</th>
                  <th className="p-2 text-right">IVT показы</th>
                  <th className="p-2 text-right">Действие</th>
                </tr>
              </thead>
              <tbody>
                {worstDomains.map((row) => (
                  <tr key={row.domain} className="odd:bg-white even:bg-gray-50">
                    <td className="border-t p-2">{row.domain}</td>
                    <td className="border-t p-2 text-right">{fmtInt(row.impressions)}</td>
                    <td className="border-t p-2 text-right">{fmtPercent(row.ivtRate)}</td>
                    <td className="border-t p-2 text-right">{fmtPercent(row.givtRate)}</td>
                    <td className="border-t p-2 text-right">{fmtPercent(row.sivtRate)}</td>
                    <td className="border-t p-2 text-right">{fmtPercent(row.brandSafetyRate)}</td>
                    <td className="border-t p-2 text-right">{fmtPercent(row.viewabilityRate)}</td>
                    <td className="border-t p-2 text-right">{fmtInt(row.invalidImpressions)}</td>
                    <td className="border-t p-2 text-right">
                      <button
                        onClick={() => onAddExclusion(row.domain)}
                        className="rounded border px-2 py-1 text-[11px] hover:bg-gray-50"
                      >
                        Добавить в исключения
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="Нет данных по доменам" />
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="rounded-xl border bg-white p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Доля GIVT vs SIVT по средам размещения</h3>
            <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs">
              {([
                ["all", "Все"],
                ["display", "Баннер"],
                ["video", "Видео"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEnvironmentFormatFilter(value)}
                  className={`rounded-full px-2.5 py-1 transition ${
                    environmentFormatFilter === value
                      ? "bg-sky-600 text-white"
                      : "text-slate-700 hover:bg-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={byEnvironment}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={CHART_TICK_STYLE} />
                <YAxis tick={CHART_TICK_STYLE} tickFormatter={(v) => `${(Number(v) * 100).toFixed(1)}%`} />
                <Tooltip
                  formatter={(v) => `${(Number(v) * 100).toFixed(2)}%`}
                  contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                  itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                />
                <Bar name="GIVT%" dataKey="givtRate" fill="#f29100" stackId="ivt-stack" />
                <Bar name="SIVT%" dataKey="sivtRate" fill="#35a8e0" stackId="ivt-stack" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Бенчмарки</h3>
            <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs">
              {(
                [
                  ["adriver", "AdRiver"],
                  ["arir", "ARIR"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setBenchmarkPreset(value)}
                  className={`rounded-full px-2.5 py-1 transition ${
                    benchmarkPreset === value
                      ? "bg-sky-600 text-white"
                      : "text-slate-700 hover:bg-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-slate-200" />
              В пределах
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-amber-200" />
              Отклонение
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-orange-300" />
              1.5x
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-rose-400" />
              2x+
            </span>
          </div>
          <div className="max-h-72 overflow-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100">
                  <th className="p-2 text-left">Формат</th>
                  <th className="p-2 text-left">Устройство</th>
                  <th className="p-2 text-right">GIVT%</th>
                  <th className="p-2 text-right">SIVT%</th>
                  <th className="p-2 text-right">Видимость, %</th>
                </tr>
              </thead>
              <tbody>
                {benchmarkRows.map((item) => (
                  <tr key={item.key} className="odd:bg-white even:bg-slate-50">
                    <td className="border-t p-2">{item.format}</td>
                    <td className="border-t p-2">{item.device}</td>
                    <td className="border-t p-2 text-right tabular-nums">{fmtPercent(item.givtRate, 1)}</td>
                    <td className="border-t p-2 text-right tabular-nums">{fmtPercent(item.sivtRate, 1)}</td>
                    <td className="border-t p-2 text-right tabular-nums">{fmtPercent(item.viewabilityRate, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Набор: {VERIFICATION_BENCHMARKS[benchmarkPreset].label}. Для GIVT/SIVT плохой сигнал — выше бенчмарка, для
            видимости — ниже бенчмарка.
          </p>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-3">
        <h3 className="mb-2 text-sm font-semibold">Мониторинг относительно бенчмарков</h3>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs">
            {(
              [
                ["campaign", "Кампании"],
                ["placement", "Размещения"],
                ["supplier", "Поставщики"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMonitoringDimension(value)}
                className={`rounded-full px-2.5 py-1 transition ${
                  monitoringDimension === value
                    ? "bg-sky-600 text-white"
                    : "text-slate-700 hover:bg-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${statusBySeverity[0].className}`}
          >
            {statusBySeverity[0].label}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${statusBySeverity[1].className}`}
          >
            {statusBySeverity[1].label}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${statusBySeverity[2].className}`}
          >
            {statusBySeverity[2].label}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${statusBySeverity[3].className}`}
          >
            {statusBySeverity[3].label}
          </span>
          <span className="text-slate-500">
            GIVT/SIVT: выше бенчмарка хуже, видимость: ниже бенчмарка хуже.
          </span>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() =>
              setMonitoringWorseFilters((prev) => ({
                ...prev,
                givt: !prev.givt,
              }))
            }
            className={`rounded-full border px-3 py-1 transition ${
              monitoringWorseFilters.givt
                ? "border-rose-300 bg-rose-50 text-rose-700"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            GIVT выше бенчмарка ({monitoringWorseCounts.givt})
          </button>
          <button
            type="button"
            onClick={() =>
              setMonitoringWorseFilters((prev) => ({
                ...prev,
                sivt: !prev.sivt,
              }))
            }
            className={`rounded-full border px-3 py-1 transition ${
              monitoringWorseFilters.sivt
                ? "border-rose-300 bg-rose-50 text-rose-700"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            SIVT выше бенчмарка ({monitoringWorseCounts.sivt})
          </button>
          <button
            type="button"
            onClick={() =>
              setMonitoringWorseFilters((prev) => ({
                ...prev,
                viewability: !prev.viewability,
              }))
            }
            className={`rounded-full border px-3 py-1 transition ${
              monitoringWorseFilters.viewability
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            Видимость ниже бенчмарка ({monitoringWorseCounts.viewability})
          </button>
          <button
            type="button"
            onClick={() =>
              setMonitoringWorseFilters({
                givt: false,
                sivt: false,
                viewability: false,
              })
            }
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 hover:bg-slate-100"
          >
            Сбросить фильтры
          </button>
        </div>
        <div className="mb-3 text-xs text-slate-500">
          Разрез:{" "}
          {monitoringDimension === "placement"
            ? "Размещения"
            : monitoringDimension === "supplier"
              ? "Поставщики"
              : "Кампании"}
          . Набор бенчмарков: {VERIFICATION_BENCHMARKS[benchmarkPreset].label}. В ячейке: факт / бенч / Δ.
        </div>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left">
                  {monitoringDimension === "placement"
                    ? "Размещение"
                    : monitoringDimension === "supplier"
                      ? "Поставщик"
                      : "Кампания"}
                </th>
                <th className="p-2 text-left">Desktop · Баннер</th>
                <th className="p-2 text-left">Desktop · Видео</th>
                <th className="p-2 text-left">Mobile · Баннер</th>
                <th className="p-2 text-left">Mobile · Видео</th>
              </tr>
            </thead>
            <tbody>
              {visibleMonitoringRows.map((item) => {
                const renderMetricRow = (
                  label: string,
                  value: number,
                  benchmark: number,
                  mode: "higher-is-worse" | "lower-is-worse",
                  severity: 0 | 1 | 2 | 3
                ) => {
                  const delta = deltaVsBenchmark(value, benchmark, mode);
                  const emphasis =
                    severity >= 2 ? "font-semibold text-slate-900" : severity === 1 ? "font-medium text-slate-800" : "text-slate-800";

                  return (
                    <div className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-2 rounded px-1 py-0.5">
                      <span className="text-[11px] text-slate-600">{label}</span>
                      <div className="min-w-0 tabular-nums text-[11px]">
                        <span className={emphasis}>{fmtPercent(value, 1)}</span>
                        <span className="ml-1 text-slate-400">/ {fmtPercent(benchmark, 1)}</span>
                      </div>
                      <span className={`text-[11px] tabular-nums ${delta.className}`}>{delta.label}</span>
                    </div>
                  );
                };

                const renderCell = (device: "Desktop" | "Mobile", format: "display" | "video") => {
                  const key = `${device}:${format}`;
                  const cell = item.cells[key];
                  if (!cell) return <span className="text-slate-400">—</span>;
                  const benchmark = activeBenchmarkSet[format][device];

                  const givtSeverity = severityFromBenchmark(
                    cell.givtRate,
                    benchmark.givtRate,
                    "higher-is-worse"
                  );
                  const sivtSeverity = severityFromBenchmark(
                    cell.sivtRate,
                    benchmark.sivtRate,
                    "higher-is-worse"
                  );
                  const viewSeverity = severityFromBenchmark(
                    cell.viewabilityRate,
                    benchmark.viewabilityRate,
                    "lower-is-worse"
                  );
                  const cellSeverity = Math.max(givtSeverity, sivtSeverity, viewSeverity) as 0 | 1 | 2 | 3;
                  const status = statusBySeverity[cellSeverity];

                  return (
                    <div className={`rounded-md border p-2.5 ${cellToneBySeverity[cellSeverity]}`}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>
                          {status.label}
                        </span>
                        <span className="text-[10px] text-slate-500">{fmtInt(cell.impressions)} пок.</span>
                      </div>
                      <div className="space-y-0.5">
                        {renderMetricRow("GIVT", cell.givtRate, benchmark.givtRate, "higher-is-worse", givtSeverity)}
                        {renderMetricRow("SIVT", cell.sivtRate, benchmark.sivtRate, "higher-is-worse", sivtSeverity)}
                        {renderMetricRow(
                          "Видимость",
                          cell.viewabilityRate,
                          benchmark.viewabilityRate,
                          "lower-is-worse",
                          viewSeverity
                        )}
                      </div>
                    </div>
                  );
                };
                return (
                  <tr key={item.id} className="odd:bg-white even:bg-gray-50">
                    <td className="border-t p-2 font-medium">{item.name}</td>
                    <td className="border-t p-2">{renderCell("Desktop", "display")}</td>
                    <td className="border-t p-2">{renderCell("Desktop", "video")}</td>
                    <td className="border-t p-2">{renderCell("Mobile", "display")}</td>
                    <td className="border-t p-2">{renderCell("Mobile", "video")}</td>
                  </tr>
                );
              })}
              {!visibleMonitoringRows.length && (
                <tr>
                  <td colSpan={5} className="border-t p-4 text-center text-slate-500">
                    Нет данных для мониторинга по текущим фильтрам.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
type VideoSheetId = "campaigns" | "domains" | "dates" | "suppliers" | "playerSizes" | "timelines";
type VideoValueMode = "absolute" | "percent";
type VideoViewabilityMode = "all" | "viewable" | "viewableAudible";

type VideoTableRow = {
  key: string;
  label: string;
  secondaryLabel?: string;
  level: 0 | 1 | 2;
  campaignId?: number;
  placementId?: number;
  creativeId?: number;
  supplier?: string;
  domain?: string;
  date?: string;
  playerSize?: string;
  impressions: number;
  viewableImpressions: number;
  clicks: number;
  vastStart: number;
  vastQ1: number;
  vastMid: number;
  vastQ3: number;
  vastComplete: number;
};

type VideoAdjustedRow = VideoTableRow & {
  visibleImpressions: number;
  audibleImpressions: number;
  adjustedImpressions: number;
  adjustedClicks: number;
  adjustedVastStart: number;
  adjustedVastQ1: number;
  adjustedVastMid: number;
  adjustedVastQ3: number;
  adjustedVastComplete: number;
  vtrByImpressions: number;
  vtrByStarts: number;
};

type VideoTimelineRow = {
  second: number;
  impressions: number;
  viewableImpressions: number;
  audibleImpressions: number;
  clicks: number;
  mute: number;
  unmute: number;
};

type VideoCampaignHierarchyState = {
  level: 0 | 1 | 2;
  campaignId: number | null;
  placementId: number | null;
};

type VideoSupplierHierarchyState = {
  level: 0 | 1 | 2;
  supplier: string | null;
  campaignId: number | null;
};

type VideoDetailSnapshot = {
  activeSheet: VideoSheetId;
  campaignHierarchy: VideoCampaignHierarchyState;
  supplierHierarchy: VideoSupplierHierarchyState;
  focusedDomain: string | null;
  focusedDate: string | null;
  focusedPlayerSize: string | null;
  timelineCampaignId: number | null;
};

type VideoContextMenuState = {
  x: number;
  y: number;
  row: VideoTableRow;
};

const VIDEO_SHEET_OPTIONS: Array<{ id: VideoSheetId; label: string }> = [
  { id: "campaigns", label: "Кампании" },
  { id: "domains", label: "Домены" },
  { id: "dates", label: "Дата" },
  { id: "suppliers", label: "Поставщики" },
  { id: "playerSizes", label: "Размеры плеера" },
  { id: "timelines", label: "Timelines" },
];

const VIDEO_DETAIL_OPTIONS: Array<{ id: VideoSheetId; label: string }> = [
  { id: "campaigns", label: "Детализация: кампании" },
  { id: "domains", label: "Детализация: домены" },
  { id: "dates", label: "Детализация: дата" },
  { id: "suppliers", label: "Детализация: поставщики" },
  { id: "playerSizes", label: "Детализация: размеры плеера" },
  { id: "timelines", label: "Детализация: Timelines" },
];

const VIDEO_TABLE_METRICS: Metric[] = [
  "impressions",
  "viewableImpressions",
  "clicks",
  "vastStart",
  "vastQ1",
  "vastMid",
  "vastQ3",
  "vastComplete",
];

const VIDEO_KPI_METRICS: Metric[] = [
  "impressions",
  "viewableImpressions",
  "clicks",
  "spend",
  "cpm",
  "vastStart",
  "vastQ1",
  "vastMid",
  "vastQ3",
  "vastComplete",
  "vcr100",
];

const VIDEO_TIMELINE_METRICS: Metric[] = ["impressions", "viewableImpressions", "clicks", "vastStart", "vastComplete"];

const VIDEO_PLAYER_SIZES = [
  "300×250",
  "320×480",
  "640×360",
  "728×90",
  "1080×1920",
  "1920×1080",
] as const;

function getVideoPlayerSizeLabel(placementId: number): string {
  const index = Math.abs(placementId) % VIDEO_PLAYER_SIZES.length;
  return VIDEO_PLAYER_SIZES[index];
}

function hashTextToUnit(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function getVideoAudibleShare(seed: string): number {
  return 0.58 + hashTextToUnit(seed) * 0.24;
}

function toVideoTableRow(raw: Record<string, unknown>, meta: Omit<VideoTableRow, keyof Pick<
  VideoTableRow,
  "impressions" | "viewableImpressions" | "clicks" | "vastStart" | "vastQ1" | "vastMid" | "vastQ3" | "vastComplete"
>>): VideoTableRow {
  return {
    ...meta,
    impressions: safeNumber(raw.impressions),
    viewableImpressions: safeNumber(raw.viewableImpressions),
    clicks: safeNumber(raw.clicks),
    vastStart: safeNumber(raw.vastStart),
    vastQ1: safeNumber(raw.vastQ1),
    vastMid: safeNumber(raw.vastMid),
    vastQ3: safeNumber(raw.vastQ3),
    vastComplete: safeNumber(raw.vastComplete),
  };
}

function toAdjustedVideoRow(row: VideoTableRow, mode: VideoViewabilityMode): VideoAdjustedRow {
  const audibleShare = getVideoAudibleShare(row.key);
  const visibleImpressions = row.viewableImpressions;
  const audibleImpressions = Math.round(visibleImpressions * audibleShare);
  const viewabilityRate = ratio(visibleImpressions, row.impressions);

  const projectionFactor =
    mode === "all" ? 1 : mode === "viewable" ? viewabilityRate : viewabilityRate * audibleShare;

  const adjustedImpressions =
    mode === "all" ? row.impressions : mode === "viewable" ? visibleImpressions : audibleImpressions;

  const adjustedVastStart = Math.round(row.vastStart * projectionFactor);
  const adjustedVastQ1 = Math.round(row.vastQ1 * projectionFactor);
  const adjustedVastMid = Math.round(row.vastMid * projectionFactor);
  const adjustedVastQ3 = Math.round(row.vastQ3 * projectionFactor);
  const adjustedVastComplete = Math.round(row.vastComplete * projectionFactor);
  const adjustedClicks = Math.round(row.clicks * projectionFactor);

  return {
    ...row,
    visibleImpressions,
    audibleImpressions,
    adjustedImpressions,
    adjustedClicks,
    adjustedVastStart,
    adjustedVastQ1,
    adjustedVastMid,
    adjustedVastQ3,
    adjustedVastComplete,
    vtrByImpressions: ratio(adjustedVastComplete, adjustedImpressions),
    vtrByStarts: ratio(adjustedVastComplete, adjustedVastStart),
  };
}

function formatVideoEventCell(value: number, base: number, valueMode: VideoValueMode): string {
  if (valueMode === "absolute") return fmtInt(value);
  return fmtPercent(ratio(value, base), 1);
}

function VideoSection(props: { filters: Filters; grain: "day" | "hour"; onResetFilters: () => void }) {
  const { filters, onResetFilters } = props;

  const [activeSheet, setActiveSheet] = useState<VideoSheetId>("campaigns");
  const [valueMode, setValueMode] = useState<VideoValueMode>("absolute");
  const [viewabilityMode, setViewabilityMode] = useState<VideoViewabilityMode>("all");
  const [campaignHierarchy, setCampaignHierarchy] = useState<VideoCampaignHierarchyState>({
    level: 0,
    campaignId: null,
    placementId: null,
  });
  const [supplierHierarchy, setSupplierHierarchy] = useState<VideoSupplierHierarchyState>({
    level: 0,
    supplier: null,
    campaignId: null,
  });
  const [focusedDomain, setFocusedDomain] = useState<string | null>(null);
  const [focusedDate, setFocusedDate] = useState<string | null>(null);
  const [focusedPlayerSize, setFocusedPlayerSize] = useState<string | null>(null);
  const [timelineCampaignId, setTimelineCampaignId] = useState<number | null>(null);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<VideoContextMenuState | null>(null);
  const [history, setHistory] = useState<VideoDetailSnapshot[]>([]);

  const clearDetailState = () => {
    setCampaignHierarchy({ level: 0, campaignId: null, placementId: null });
    setSupplierHierarchy({ level: 0, supplier: null, campaignId: null });
    setFocusedDomain(null);
    setFocusedDate(null);
    setFocusedPlayerSize(null);
    setTimelineCampaignId(null);
    setSelectedRowKey(null);
    setContextMenu(null);
  };

  const pushCurrentSnapshot = () => {
    setHistory((prev) => [
      ...prev,
      {
        activeSheet,
        campaignHierarchy,
        supplierHierarchy,
        focusedDomain,
        focusedDate,
        focusedPlayerSize,
        timelineCampaignId,
      },
    ]);
  };

  const restoreSnapshot = (snapshot: VideoDetailSnapshot) => {
    setActiveSheet(snapshot.activeSheet);
    setCampaignHierarchy(snapshot.campaignHierarchy);
    setSupplierHierarchy(snapshot.supplierHierarchy);
    setFocusedDomain(snapshot.focusedDomain);
    setFocusedDate(snapshot.focusedDate);
    setFocusedPlayerSize(snapshot.focusedPlayerSize);
    setTimelineCampaignId(snapshot.timelineCampaignId);
    setSelectedRowKey(null);
    setContextMenu(null);
  };

  const goBack = () => {
    setHistory((prev) => {
      if (!prev.length) return prev;
      const snapshot = prev[prev.length - 1];
      restoreSnapshot(snapshot);
      return prev.slice(0, -1);
    });
  };

  const resetDetailing = () => {
    clearDetailState();
    setHistory([]);
  };

  const handleSheetChange = (sheetId: VideoSheetId) => {
    if (sheetId === activeSheet) return;
    clearDetailState();
    setHistory([]);
    setActiveSheet(sheetId);
  };

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onEsc);
    };
  }, [contextMenu]);

  const baseVideoFilters = useMemo<Filters>(
    () => ({
      ...filters,
      formats: ["video"],
    }),
    [filters]
  );

  const scopedVideoFilters = useMemo<Filters>(() => {
    let next: Filters = { ...baseVideoFilters };

    if (focusedDomain) {
      next = { ...next, domains: [focusedDomain] };
    }
    if (focusedDate) {
      next = { ...next, dateFrom: focusedDate, dateTo: focusedDate };
    }
    if (activeSheet === "timelines" && timelineCampaignId) {
      next = { ...next, campaignIds: [timelineCampaignId], placementIds: [], creativeIds: [] };
    }
    if (activeSheet === "campaigns") {
      if (campaignHierarchy.level === 1 && campaignHierarchy.campaignId) {
        next = {
          ...next,
          campaignIds: [campaignHierarchy.campaignId],
          placementIds: [],
          creativeIds: [],
        };
      }
      if (campaignHierarchy.level === 2 && campaignHierarchy.placementId) {
        next = {
          ...next,
          campaignIds: campaignHierarchy.campaignId ? [campaignHierarchy.campaignId] : next.campaignIds,
          placementIds: [campaignHierarchy.placementId],
          creativeIds: [],
        };
      }
    }
    if (activeSheet === "suppliers" && supplierHierarchy.level === 2 && supplierHierarchy.campaignId) {
      next = {
        ...next,
        campaignIds: [supplierHierarchy.campaignId],
        placementIds: [],
        creativeIds: [],
      };
    }

    return next;
  }, [
    activeSheet,
    baseVideoFilters,
    campaignHierarchy,
    supplierHierarchy.level,
    supplierHierarchy.campaignId,
    focusedDomain,
    focusedDate,
    timelineCampaignId,
  ]);

  const kpiRow = useMemo(() => {
    const row = query({
      filters: scopedVideoFilters,
      dimensions: [],
      metrics: VIDEO_KPI_METRICS,
    }).rows[0];
    return (row ?? {}) as Record<string, unknown>;
  }, [scopedVideoFilters]);

  const videoAvailable = safeNumber(kpiRow.impressions) > 0 || safeNumber(kpiRow.vastStart) > 0;

  const rawRows = useMemo<VideoTableRow[]>(() => {
    if (!videoAvailable) return [];
    if (activeSheet === "timelines") return [];

    const loadRows = (
      dimensions: Dimension[],
      sort: Array<{ field: string; dir: "asc" | "desc" }>,
      limit = 5000
    ) =>
      query({
        filters: scopedVideoFilters,
        dimensions,
        metrics: VIDEO_TABLE_METRICS,
        sort,
        limit,
      }).rows as Record<string, unknown>[];

    if (activeSheet === "campaigns") {
      if (campaignHierarchy.level === 0) {
        return loadRows(
          ["campaignId", "campaignName"],
          [{ field: "vastStart", dir: "desc" }],
          200
        ).map((row) =>
          toVideoTableRow(row, {
            key: `campaign-${safeNumber(row.campaignId)}`,
            label: String(row.campaignName ?? "—"),
            secondaryLabel: `ID ${safeNumber(row.campaignId)}`,
            level: 0,
            campaignId: safeNumber(row.campaignId),
          })
        );
      }

      if (campaignHierarchy.level === 1) {
        return loadRows(
          ["campaignId", "campaignName", "placementId", "placementName"],
          [{ field: "vastStart", dir: "desc" }],
          500
        )
          .filter((row) =>
            campaignHierarchy.campaignId ? safeNumber(row.campaignId) === campaignHierarchy.campaignId : true
          )
          .map((row) =>
            toVideoTableRow(row, {
              key: `placement-${safeNumber(row.placementId)}`,
              label: String(row.placementName ?? "—"),
              secondaryLabel: `Кампания: ${String(row.campaignName ?? "—")}`,
              level: 1,
              campaignId: safeNumber(row.campaignId),
              placementId: safeNumber(row.placementId),
            })
          );
      }

      return loadRows(
        ["campaignId", "campaignName", "placementId", "placementName", "creativeId", "creativeName"],
        [{ field: "vastStart", dir: "desc" }],
        1000
      )
        .filter((row) =>
          campaignHierarchy.placementId ? safeNumber(row.placementId) === campaignHierarchy.placementId : true
        )
        .map((row) =>
          toVideoTableRow(row, {
            key: `creative-${safeNumber(row.creativeId)}`,
            label: String(row.creativeName ?? "—"),
            secondaryLabel: `${String(row.campaignName ?? "—")} · ${String(row.placementName ?? "—")}`,
            level: 2,
            campaignId: safeNumber(row.campaignId),
            placementId: safeNumber(row.placementId),
            creativeId: safeNumber(row.creativeId),
          })
        );
    }

    if (activeSheet === "suppliers") {
      if (supplierHierarchy.level === 0) {
        return loadRows(["supplier"], [{ field: "vastStart", dir: "desc" }], 200).map((row) =>
          toVideoTableRow(row, {
            key: `supplier-${String(row.supplier ?? "—")}`,
            label: String(row.supplier ?? "—"),
            level: 0,
            supplier: String(row.supplier ?? "—"),
          })
        );
      }

      if (supplierHierarchy.level === 1) {
        return loadRows(
          ["supplier", "campaignId", "campaignName"],
          [{ field: "vastStart", dir: "desc" }],
          600
        )
          .filter((row) => (supplierHierarchy.supplier ? String(row.supplier ?? "") === supplierHierarchy.supplier : true))
          .map((row) =>
            toVideoTableRow(row, {
              key: `supplier-campaign-${String(row.supplier ?? "—")}-${safeNumber(row.campaignId)}`,
              label: String(row.campaignName ?? "—"),
              secondaryLabel: `Поставщик: ${String(row.supplier ?? "—")}`,
              level: 1,
              campaignId: safeNumber(row.campaignId),
              supplier: String(row.supplier ?? "—"),
            })
          );
      }

      return loadRows(
        ["supplier", "campaignId", "campaignName", "placementId", "placementName"],
        [{ field: "vastStart", dir: "desc" }],
        1000
      )
        .filter((row) => (supplierHierarchy.supplier ? String(row.supplier ?? "") === supplierHierarchy.supplier : true))
        .filter((row) =>
          supplierHierarchy.campaignId ? safeNumber(row.campaignId) === supplierHierarchy.campaignId : true
        )
        .map((row) =>
          toVideoTableRow(row, {
            key: `supplier-placement-${String(row.supplier ?? "—")}-${safeNumber(row.placementId)}`,
            label: String(row.placementName ?? "—"),
            secondaryLabel: `${String(row.campaignName ?? "—")} · ${String(row.supplier ?? "—")}`,
            level: 2,
            campaignId: safeNumber(row.campaignId),
            placementId: safeNumber(row.placementId),
            supplier: String(row.supplier ?? "—"),
          })
        );
    }

    if (activeSheet === "domains") {
      return loadRows(["domain"], [{ field: "vastStart", dir: "desc" }], 300).map((row) =>
        toVideoTableRow(row, {
          key: `domain-${String(row.domain ?? "—")}`,
          label: String(row.domain ?? "—"),
          level: 0,
          domain: String(row.domain ?? "—"),
        })
      );
    }

    if (activeSheet === "dates") {
      return loadRows(["date"], [{ field: "date", dir: "asc" }], 400).map((row) =>
        toVideoTableRow(row, {
          key: `date-${String(row.date ?? "—")}`,
          label: String(row.date ?? "—"),
          level: 0,
          date: String(row.date ?? "—"),
        })
      );
    }

    if (activeSheet === "playerSizes") {
      const placementRows = loadRows(
        ["placementId", "placementName", "campaignId", "campaignName"],
        [{ field: "vastStart", dir: "desc" }],
        1200
      );
      const grouped = new Map<string, VideoTableRow>();

      placementRows.forEach((row) => {
        const placementId = safeNumber(row.placementId);
        const playerSize = getVideoPlayerSizeLabel(placementId);
        if (focusedPlayerSize && playerSize !== focusedPlayerSize) return;

        const key = `player-size-${playerSize}`;
        const existing = grouped.get(key);
        if (existing) {
          existing.impressions += safeNumber(row.impressions);
          existing.viewableImpressions += safeNumber(row.viewableImpressions);
          existing.clicks += safeNumber(row.clicks);
          existing.vastStart += safeNumber(row.vastStart);
          existing.vastQ1 += safeNumber(row.vastQ1);
          existing.vastMid += safeNumber(row.vastMid);
          existing.vastQ3 += safeNumber(row.vastQ3);
          existing.vastComplete += safeNumber(row.vastComplete);
          return;
        }

        grouped.set(
          key,
          toVideoTableRow(row, {
            key,
            label: playerSize,
            secondaryLabel: "Агрегировано по placementId",
            level: 0,
            playerSize,
          })
        );
      });

      return Array.from(grouped.values()).sort((a, b) => b.vastStart - a.vastStart);
    }

    return [];
  }, [
    activeSheet,
    scopedVideoFilters,
    campaignHierarchy,
    supplierHierarchy,
    focusedPlayerSize,
    videoAvailable,
  ]);

  const adjustedRows = useMemo(() => rawRows.map((row) => toAdjustedVideoRow(row, viewabilityMode)), [rawRows, viewabilityMode]);

  useEffect(() => {
    if (!selectedRowKey) return;
    if (!adjustedRows.some((row) => row.key === selectedRowKey)) {
      setSelectedRowKey(null);
    }
  }, [adjustedRows, selectedRowKey]);

  const selectedRow = useMemo(
    () => adjustedRows.find((row) => row.key === selectedRowKey) ?? null,
    [adjustedRows, selectedRowKey]
  );

  const canDrillIntoRow = (row: VideoTableRow): boolean => {
    if (activeSheet === "campaigns") {
      if (campaignHierarchy.level === 0) return Boolean(row.campaignId);
      if (campaignHierarchy.level === 1) return Boolean(row.placementId);
      return false;
    }
    if (activeSheet === "suppliers") {
      if (supplierHierarchy.level === 0) return Boolean(row.supplier);
      if (supplierHierarchy.level === 1) return Boolean(row.campaignId);
      return false;
    }
    return false;
  };

  const drillIntoRow = (row: VideoTableRow) => {
    if (!canDrillIntoRow(row)) return;
    pushCurrentSnapshot();
    setContextMenu(null);
    setSelectedRowKey(null);

    if (activeSheet === "campaigns") {
      if (campaignHierarchy.level === 0 && row.campaignId) {
        setCampaignHierarchy({ level: 1, campaignId: row.campaignId, placementId: null });
        return;
      }
      if (campaignHierarchy.level === 1 && row.placementId) {
        setCampaignHierarchy({
          level: 2,
          campaignId: row.campaignId ?? campaignHierarchy.campaignId,
          placementId: row.placementId,
        });
      }
      return;
    }

    if (activeSheet === "suppliers") {
      if (supplierHierarchy.level === 0 && row.supplier) {
        setSupplierHierarchy({ level: 1, supplier: row.supplier, campaignId: null });
        return;
      }
      if (supplierHierarchy.level === 1 && row.campaignId) {
        setSupplierHierarchy({
          level: 2,
          supplier: row.supplier ?? supplierHierarchy.supplier,
          campaignId: row.campaignId,
        });
      }
    }
  };

  const canGoNextLevel = Boolean(selectedRow && canDrillIntoRow(selectedRow));
  const canGoBackLevel = history.length > 0;
  const hasDetailing =
    canGoBackLevel ||
    campaignHierarchy.level > 0 ||
    supplierHierarchy.level > 0 ||
    focusedDomain !== null ||
    focusedDate !== null ||
    focusedPlayerSize !== null ||
    timelineCampaignId !== null;

  const applyContextDetail = (targetSheet: VideoSheetId, row: VideoTableRow) => {
    pushCurrentSnapshot();
    clearDetailState();
    setActiveSheet(targetSheet);

    if (targetSheet === "campaigns" && row.campaignId) {
      setCampaignHierarchy({ level: 1, campaignId: row.campaignId, placementId: null });
    }
    if (targetSheet === "suppliers" && row.supplier) {
      setSupplierHierarchy({ level: 1, supplier: row.supplier, campaignId: null });
    }
    if (targetSheet === "domains" && row.domain) {
      setFocusedDomain(row.domain);
    }
    if (targetSheet === "dates" && row.date) {
      setFocusedDate(row.date);
    }
    if (targetSheet === "playerSizes") {
      const playerSize = row.playerSize ?? (row.placementId ? getVideoPlayerSizeLabel(row.placementId) : null);
      if (playerSize) setFocusedPlayerSize(playerSize);
    }
    if (targetSheet === "timelines" && row.campaignId) {
      setTimelineCampaignId(row.campaignId);
    }
  };

  const hierarchyLabel =
    activeSheet === "campaigns"
      ? campaignHierarchy.level === 0
        ? "Кампании"
        : campaignHierarchy.level === 1
          ? "Профили (размещения)"
          : "Креативы"
      : activeSheet === "suppliers"
        ? supplierHierarchy.level === 0
          ? "Поставщики"
          : supplierHierarchy.level === 1
            ? "Кампании"
            : "Профили (размещения)"
        : activeSheet === "timelines"
          ? "Секунды видео"
          : "Базовый срез";

  const scopeBadges = useMemo(() => {
    const badges: string[] = [];
    if (campaignHierarchy.campaignId) badges.push(`Кампания: ${campaignHierarchy.campaignId}`);
    if (campaignHierarchy.placementId) badges.push(`Размещение: ${campaignHierarchy.placementId}`);
    if (supplierHierarchy.supplier) badges.push(`Поставщик: ${supplierHierarchy.supplier}`);
    if (supplierHierarchy.campaignId) badges.push(`Кампания: ${supplierHierarchy.campaignId}`);
    if (focusedDomain) badges.push(`Домен: ${focusedDomain}`);
    if (focusedDate) badges.push(`Дата: ${focusedDate}`);
    if (focusedPlayerSize) badges.push(`Размер: ${focusedPlayerSize}`);
    if (timelineCampaignId) badges.push(`Timelines для кампании: ${timelineCampaignId}`);
    return badges;
  }, [
    campaignHierarchy.campaignId,
    campaignHierarchy.placementId,
    supplierHierarchy.supplier,
    supplierHierarchy.campaignId,
    focusedDomain,
    focusedDate,
    focusedPlayerSize,
    timelineCampaignId,
  ]);

  const totals = useMemo(
    () =>
      adjustedRows.reduce(
        (acc, row) => {
          acc.impressions += row.adjustedImpressions;
          acc.vastStart += row.adjustedVastStart;
          acc.vastQ1 += row.adjustedVastQ1;
          acc.vastMid += row.adjustedVastMid;
          acc.vastQ3 += row.adjustedVastQ3;
          acc.vastComplete += row.adjustedVastComplete;
          acc.clicks += row.adjustedClicks;
          return acc;
        },
        {
          impressions: 0,
          vastStart: 0,
          vastQ1: 0,
          vastMid: 0,
          vastQ3: 0,
          vastComplete: 0,
          clicks: 0,
        }
      ),
    [adjustedRows]
  );

  const leftChartData = useMemo(
    () =>
      adjustedRows.slice(0, 12).map((row) => ({
        name: row.label.length > 24 ? `${row.label.slice(0, 24)}…` : row.label,
        fullName: row.label,
        impressions: row.impressions,
        viewable: row.visibleImpressions,
        audible: row.audibleImpressions,
        vtrImpressions: ratio(row.vastComplete, row.impressions),
        vtrStarts: ratio(row.vastComplete, row.vastStart),
      })),
    [adjustedRows]
  );

  const vcrDistribution = useMemo(
    () => [
      {
        step: "VCR25",
        events: totals.vastQ1,
        rate: ratio(totals.vastQ1, totals.vastStart),
      },
      {
        step: "VCR50",
        events: totals.vastMid,
        rate: ratio(totals.vastMid, totals.vastStart),
      },
      {
        step: "VCR75",
        events: totals.vastQ3,
        rate: ratio(totals.vastQ3, totals.vastStart),
      },
      {
        step: "VCR100",
        events: totals.vastComplete,
        rate: ratio(totals.vastComplete, totals.vastStart),
      },
    ],
    [totals.vastQ1, totals.vastMid, totals.vastQ3, totals.vastComplete, totals.vastStart]
  );

  const timelineRows = useMemo<VideoTimelineRow[]>(() => {
    if (!videoAvailable || activeSheet !== "timelines") return [];
    const row =
      (query({
        filters: scopedVideoFilters,
        dimensions: [],
        metrics: VIDEO_TIMELINE_METRICS,
      }).rows[0] as Record<string, unknown> | undefined) ?? {};

    const starts = Math.max(1, safeNumber(row.vastStart));
    const complete = safeNumber(row.vastComplete);
    const totalClicks = safeNumber(row.clicks);
    const impressions = safeNumber(row.impressions);
    const viewabilityRate = clampValue(ratio(safeNumber(row.viewableImpressions), impressions), 0.2, 0.95);
    const completionRate = clampValue(ratio(complete, starts), 0.1, 0.95);
    const duration = 45;

    const clickWeights = Array.from({ length: duration + 1 }, (_, second) => {
      const earlyPeak = Math.exp(-second / 9);
      const latePeak = Math.exp(-Math.abs(second - duration * 0.82) / 7) * 0.6;
      return earlyPeak + latePeak + 0.08;
    });
    const clickWeightSum = clickWeights.reduce((sum, weight) => sum + weight, 0);

    return Array.from({ length: duration + 1 }, (_, second) => {
      const progress = second / duration;
      const retention = 1 - (1 - completionRate) * Math.pow(progress, 0.88);
      const activeImpressions = Math.max(0, Math.round(starts * retention));
      const visibleImpressions = Math.round(activeImpressions * viewabilityRate);
      const audibleImpressions = Math.round(visibleImpressions * 0.72);
      const clicksAtSecond = Math.round(totalClicks * (clickWeights[second] / clickWeightSum));
      const mute = Math.round(activeImpressions * (0.015 + progress * 0.02));
      const unmute = Math.round(activeImpressions * (0.03 - progress * 0.012));

      return {
        second,
        impressions: activeImpressions,
        viewableImpressions: visibleImpressions,
        audibleImpressions,
        clicks: clicksAtSecond,
        mute,
        unmute,
      };
    });
  }, [activeSheet, scopedVideoFilters, videoAvailable]);

  const timelineBase = timelineRows[0]?.impressions ?? 0;

  const timelineChartRows = useMemo(
    () =>
      timelineRows.map((row) => ({
        second: String(row.second),
        impressions: row.impressions,
        viewable: row.viewableImpressions,
        audible: row.audibleImpressions,
        clicks: row.clicks,
      })),
    [timelineRows]
  );

  if (!videoAvailable) {
    return (
      <div className="space-y-4">
        <SectionTitle title="Видео" subtitle="Диагностика видео-инвентаря и VAST/VPAID-цепочки по листам." />
        <div className="rounded-xl border border-dashed bg-white p-6">
          <p className="text-sm text-gray-600">Нет видео-размещений в текущем срезе.</p>
          <button onClick={onResetFilters} className="mt-3 rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50">
            Сбросить фильтры
          </button>
        </div>
      </div>
    );
  }

  const vcr25 = ratio(safeNumber(kpiRow.vastQ1), safeNumber(kpiRow.vastStart));
  const vcr50 = ratio(safeNumber(kpiRow.vastMid), safeNumber(kpiRow.vastStart));
  const vcr75 = ratio(safeNumber(kpiRow.vastQ3), safeNumber(kpiRow.vastStart));
  const vtrImpressions = ratio(safeNumber(kpiRow.vastComplete), safeNumber(kpiRow.impressions));
  const vtrStarts = ratio(safeNumber(kpiRow.vastComplete), safeNumber(kpiRow.vastStart));

  return (
    <div className="space-y-4">
      <SectionTitle title="Видео" subtitle="Диагностика видео-инвентаря и VAST/VPAID-цепочки по листам." />

      <KpiSection title="Видео-метрики">
        <MetricCard title="Креатив загружен" value={fmtInt(safeNumber(kpiRow.impressions))} metricKey="impressions" />
        <MetricCard title="VAST Start" value={fmtInt(safeNumber(kpiRow.vastStart))} metricKey="vastStart" />
        <MetricCard title="VAST Complete" value={fmtInt(safeNumber(kpiRow.vastComplete))} metricKey="vastComplete" />
        <MetricCard title="VCR100" value={fmtPercent(safeNumber(kpiRow.vcr100))} metricKey="vcr100" />
        <MetricCard title="VTR от показов" value={fmtPercent(vtrImpressions)} metricKey="vtrByImpressions" />
        <MetricCard title="VTR от стартов" value={fmtPercent(vtrStarts)} metricKey="vtrByStarts" />
        <MetricCard title="VCR25" value={fmtPercent(vcr25)} metricKey="vcr25" />
        <MetricCard title="VCR50" value={fmtPercent(vcr50)} metricKey="vcr50" />
        <MetricCard title="VCR75" value={fmtPercent(vcr75)} metricKey="vcr75" />
        <MetricCard title="CPM видео" value={safeNumber(kpiRow.impressions) > 0 ? fmtCurrency(safeNumber(kpiRow.cpm)) : "—"} metricKey="cpm" />
      </KpiSection>

      <section className="rounded-xl border bg-white p-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs">
            {VIDEO_SHEET_OPTIONS.map((sheet) => (
              <button
                key={sheet.id}
                type="button"
                onClick={() => handleSheetChange(sheet.id)}
                className={`rounded-full px-3 py-1.5 transition ${
                  activeSheet === sheet.id ? "bg-sky-600 text-white" : "text-slate-700 hover:bg-white"
                }`}
              >
                {sheet.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 text-xs">
            {(
              [
                ["absolute", "Абсолютные"],
                ["percent", "Процентные"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setValueMode(mode)}
                className={`rounded-full px-2.5 py-1 transition ${
                  valueMode === mode ? "bg-sky-600 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <select
            value={viewabilityMode}
            onChange={(event) => setViewabilityMode(event.target.value as VideoViewabilityMode)}
            className="h-8 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700"
            title="Viewability"
          >
            <option value="all">Все</option>
            <option value="viewable">Видимые</option>
            <option value="viewableAudible">Видимые и слышимые</option>
          </select>

          <button
            type="button"
            onClick={goBack}
            disabled={!canGoBackLevel}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Вернуться
          </button>
          <button
            type="button"
            onClick={() => {
              if (selectedRow) drillIntoRow(selectedRow);
            }}
            disabled={!canGoNextLevel}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            title="Перейти на следующий уровень в иерархии"
          >
            Следующий уровень
          </button>
          <button
            type="button"
            onClick={resetDetailing}
            disabled={!hasDetailing}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Сброс детализации
          </button>

          <span className="text-xs text-slate-500">
            Текущий уровень: <span className="font-semibold text-slate-700">{hierarchyLabel}</span>
          </span>
          {scopeBadges.map((badge) => (
            <span key={badge} className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] text-sky-700">
              {badge}
            </span>
          ))}
        </div>

        {activeSheet === "timelines" ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 p-3">
              <h3 className="mb-2 text-sm font-semibold">Timelines: события по секундам</h3>
              {timelineChartRows.length ? (
                <div className="h-72">
                  <ResponsiveContainer>
                    <ComposedChart data={timelineChartRows}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="second" tick={CHART_TICK_STYLE} minTickGap={14} />
                      <YAxis yAxisId="left" tick={CHART_TICK_STYLE} tickFormatter={(v) => fmtInt(Number(v))} />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={CHART_TICK_STYLE}
                        tickFormatter={(v) => fmtInt(Number(v))}
                      />
                      <Tooltip
                        contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                        labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                        itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                      />
                      <Bar yAxisId="left" dataKey="impressions" name="Показы" fill="#35a8e0" />
                      <Bar yAxisId="left" dataKey="viewable" name="Видимые" fill="#8ccff0" />
                      <Bar yAxisId="left" dataKey="audible" name="Видимые и слышимые" fill="#93c01f" />
                      <Line yAxisId="right" dataKey="clicks" name="Клики" stroke="#1d70b7" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState text="Нет данных для Timelines" />
              )}
            </div>

            <div className="overflow-auto rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2 text-left">Секунда</th>
                    <th className="p-2 text-right">Показы</th>
                    <th className="p-2 text-right">Видимые</th>
                    <th className="p-2 text-right">Видимые и слышимые</th>
                    <th className="p-2 text-right">Клики</th>
                    <th className="p-2 text-right">Mute</th>
                    <th className="p-2 text-right">Unmute</th>
                  </tr>
                </thead>
                <tbody>
                  {timelineRows.map((row) => (
                    <tr key={`timeline-${row.second}`} className="odd:bg-white even:bg-slate-50">
                      <td className="border-t p-2">{row.second}</td>
                      <td className="border-t p-2 text-right tabular-nums">{formatVideoEventCell(row.impressions, timelineBase, valueMode)}</td>
                      <td className="border-t p-2 text-right tabular-nums">{formatVideoEventCell(row.viewableImpressions, timelineBase, valueMode)}</td>
                      <td className="border-t p-2 text-right tabular-nums">{formatVideoEventCell(row.audibleImpressions, timelineBase, valueMode)}</td>
                      <td className="border-t p-2 text-right tabular-nums">{formatVideoEventCell(row.clicks, timelineBase, valueMode)}</td>
                      <td className="border-t p-2 text-right tabular-nums">{formatVideoEventCell(row.mute, timelineBase, valueMode)}</td>
                      <td className="border-t p-2 text-right tabular-nums">{formatVideoEventCell(row.unmute, timelineBase, valueMode)}</td>
                    </tr>
                  ))}
                  {!timelineRows.length && (
                    <tr>
                      <td colSpan={7} className="border-t p-4 text-center text-slate-500">
                        Нет данных для таблицы Timelines
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative overflow-auto rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-slate-100">
                  <tr>
                    <th className="w-10 p-2 text-center">+</th>
                    <th className="min-w-[260px] p-2 text-left">Срез</th>
                    <th className="p-2 text-right">Креатив загружен</th>
                    <th className="p-2 text-right">VAST Start</th>
                    <th className="p-2 text-right">VAST 25</th>
                    <th className="p-2 text-right">VAST 50</th>
                    <th className="p-2 text-right">VAST 75</th>
                    <th className="p-2 text-right">VAST 100</th>
                    <th className="p-2 text-right">Клики</th>
                    <th className="p-2 text-right">VTR от показов</th>
                    <th className="p-2 text-right">VTR от стартов</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustedRows.map((row) => {
                    const canDrill = canDrillIntoRow(row);
                    const selected = selectedRowKey === row.key;
                    const indentClass = row.level === 1 ? "pl-4" : row.level === 2 ? "pl-8" : "";
                    return (
                      <tr key={row.key} className={`${selected ? "bg-sky-50" : "odd:bg-white even:bg-slate-50"}`}>
                        <td className="border-t p-2 text-center">
                          {canDrill ? (
                            <button
                              type="button"
                              onClick={() => drillIntoRow(row)}
                              className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-300 text-[12px] text-slate-700 hover:bg-slate-100"
                              aria-label="Провалиться в детализацию"
                              title="Провалиться в детализацию"
                            >
                              +
                            </button>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td
                          className="border-t p-2"
                          onClick={() => setSelectedRowKey(row.key)}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            setSelectedRowKey(row.key);
                            setContextMenu({
                              x: event.clientX,
                              y: event.clientY,
                              row,
                            });
                          }}
                        >
                          <div className={`line-clamp-1 ${indentClass}`} title={row.label}>
                            {row.label}
                          </div>
                          {row.secondaryLabel && <div className="mt-0.5 text-[11px] text-slate-500">{row.secondaryLabel}</div>}
                        </td>
                        <td className="border-t p-2 text-right tabular-nums">
                          {valueMode === "absolute" ? fmtInt(row.adjustedImpressions) : row.adjustedImpressions > 0 ? "100.0%" : "0.0%"}
                        </td>
                        <td className="border-t p-2 text-right tabular-nums">{formatVideoEventCell(row.adjustedVastStart, row.adjustedImpressions, valueMode)}</td>
                        <td className="border-t p-2 text-right tabular-nums">{formatVideoEventCell(row.adjustedVastQ1, row.adjustedImpressions, valueMode)}</td>
                        <td className="border-t p-2 text-right tabular-nums">{formatVideoEventCell(row.adjustedVastMid, row.adjustedImpressions, valueMode)}</td>
                        <td className="border-t p-2 text-right tabular-nums">{formatVideoEventCell(row.adjustedVastQ3, row.adjustedImpressions, valueMode)}</td>
                        <td className="border-t p-2 text-right tabular-nums">{formatVideoEventCell(row.adjustedVastComplete, row.adjustedImpressions, valueMode)}</td>
                        <td className="border-t p-2 text-right tabular-nums">{formatVideoEventCell(row.adjustedClicks, row.adjustedImpressions, valueMode)}</td>
                        <td className="border-t p-2 text-right tabular-nums">{fmtPercent(row.vtrByImpressions, 1)}</td>
                        <td className="border-t p-2 text-right tabular-nums">{fmtPercent(row.vtrByStarts, 1)}</td>
                      </tr>
                    );
                  })}
                  {!adjustedRows.length && (
                    <tr>
                      <td colSpan={11} className="border-t p-4 text-center text-slate-500">
                        Нет данных для выбранного листа
                      </td>
                    </tr>
                  )}
                </tbody>
                {adjustedRows.length > 0 && (
                  <tfoot className="bg-slate-200/80">
                    <tr className="font-semibold text-slate-900">
                      <td className="border-t p-2 text-center">Σ</td>
                      <td className="border-t p-2">Всего</td>
                      <td className="border-t p-2 text-right tabular-nums">
                        {valueMode === "absolute" ? fmtInt(totals.impressions) : totals.impressions > 0 ? "100.0%" : "0.0%"}
                      </td>
                      <td className="border-t p-2 text-right tabular-nums">{formatVideoEventCell(totals.vastStart, totals.impressions, valueMode)}</td>
                      <td className="border-t p-2 text-right tabular-nums">{formatVideoEventCell(totals.vastQ1, totals.impressions, valueMode)}</td>
                      <td className="border-t p-2 text-right tabular-nums">{formatVideoEventCell(totals.vastMid, totals.impressions, valueMode)}</td>
                      <td className="border-t p-2 text-right tabular-nums">{formatVideoEventCell(totals.vastQ3, totals.impressions, valueMode)}</td>
                      <td className="border-t p-2 text-right tabular-nums">{formatVideoEventCell(totals.vastComplete, totals.impressions, valueMode)}</td>
                      <td className="border-t p-2 text-right tabular-nums">{formatVideoEventCell(totals.clicks, totals.impressions, valueMode)}</td>
                      <td className="border-t p-2 text-right tabular-nums">{fmtPercent(ratio(totals.vastComplete, totals.impressions), 1)}</td>
                      <td className="border-t p-2 text-right tabular-nums">{fmtPercent(ratio(totals.vastComplete, totals.vastStart), 1)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>

              {contextMenu && (
                <div
                  className="fixed z-50 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
                  style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                  <div className="px-2 py-1 text-[11px] font-semibold text-slate-500">Детализация</div>
                  {VIDEO_DETAIL_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        applyContextDetail(option.id, contextMenu.row);
                        setContextMenu(null);
                      }}
                      className="w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <section className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-3">
                <h3 className="mb-2 text-sm font-semibold">Показы, видимые и видимые/слышимые + VTR</h3>
                {leftChartData.length ? (
                  <div className="h-72">
                    <ResponsiveContainer>
                      <ComposedChart data={leftChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={CHART_TICK_STYLE} minTickGap={12} />
                        <YAxis yAxisId="left" tick={CHART_TICK_STYLE} tickFormatter={(v) => fmtInt(Number(v))} />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={CHART_TICK_STYLE}
                          tickFormatter={(v) => fmtPercent(Number(v), 0)}
                        />
                        <Tooltip
                          labelFormatter={(_, payload) =>
                            Array.isArray(payload) && payload[0]?.payload?.fullName
                              ? String(payload[0].payload.fullName)
                              : ""
                          }
                          formatter={(value, key) => {
                            if (key === "vtrImpressions") return [fmtPercent(Number(value), 2), "VTR от показов"];
                            if (key === "vtrStarts") return [fmtPercent(Number(value), 2), "VTR от стартов"];
                            return [fmtInt(Number(value)), String(key)];
                          }}
                          contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                          labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                          itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                        />
                        <Bar yAxisId="left" dataKey="impressions" name="Показы" fill="#35a8e0" />
                        <Bar yAxisId="left" dataKey="viewable" name="Видимые" fill="#8ccff0" />
                        <Bar yAxisId="left" dataKey="audible" name="Видимые и слышимые" fill="#93c01f" />
                        <Line yAxisId="right" dataKey="vtrImpressions" name="VTR от показов" stroke="#1d70b7" strokeWidth={2} dot={false} />
                        <Line yAxisId="right" dataKey="vtrStarts" name="VTR от стартов" stroke="#5b2c83" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState text="Нет данных для графика" />
                )}
              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <h3 className="mb-2 text-sm font-semibold">
                  Распределение по VCR
                </h3>
                <p className="mb-2 text-[11px] text-slate-500">База: VAST Start = {fmtInt(totals.vastStart)}</p>
                {totals.vastStart > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer>
                      <ComposedChart data={vcrDistribution}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="step" tick={CHART_TICK_STYLE} />
                        <YAxis
                          yAxisId="left"
                          tick={CHART_TICK_STYLE}
                          domain={[0, 1]}
                          tickFormatter={(v) => fmtPercent(Number(v), 0)}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={CHART_TICK_STYLE}
                          tickFormatter={(v) => fmtInt(Number(v))}
                        />
                        <Tooltip
                          formatter={(value, key) => {
                            if (key === "rate") return [fmtPercent(Number(value), 2), "% от стартов"];
                            return [fmtInt(Number(value)), "События"];
                          }}
                          contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                          labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                          itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                        />
                        <Bar yAxisId="left" dataKey="rate" name="% от стартов" fill="#35a8e0" radius={[6, 6, 0, 0]} />
                        <Line yAxisId="right" dataKey="events" name="События" stroke="#1d70b7" strokeWidth={2} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState text="Нет данных для VCR-распределения" />
                )}
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}

type ConversionCampaignRow = {
  id: number;
  campaign: string;
  advertiser: string;
  postView: number;
  postClick: number;
  total: number;
  incremental: number;
  spend: number;
  cpa: number;
};

type PostViewSubPage = "main" | "lag" | "socdem";
type PostViewGoalFilter = "all" | "allSite" | "firstVisit" | "entry" | "cartVisit" | "siteOrder";
type PostViewChannelFilter = "all" | "withoutUtm" | "utmWithoutAdriver";
type PostViewHierarchyLevel = 0 | 1 | 2 | 3;

type PostViewFunnelStepKey =
  | "landing"
  | "productView"
  | "addToCart"
  | "pickupClick"
  | "cartTransition"
  | "checkoutTransition"
  | "siteOrder"
  | "cartState";

type PostViewFunnelRow = ConversionCampaignRow & {
  funnel: Record<PostViewFunnelStepKey, number>;
};

type PostViewLagRow = {
  node: PostViewVisibleNode;
  total: number;
  values: number[];
};

type PostViewSocdemRow = {
  node: PostViewVisibleNode;
  total: number;
  byAge: number[];
  male: number;
  female: number;
  maleByAge: number[];
  femaleByAge: number[];
};

type PostViewNodeKind = "campaign" | "placement" | "banner" | "date";

type PostViewNode = {
  key: string;
  id: number;
  kind: PostViewNodeKind;
  label: string;
  subtitle: string;
  advertiser: string;
  funnel: Record<PostViewFunnelStepKey, number>;
  children: PostViewNode[];
};

type PostViewVisibleNode = {
  node: PostViewNode;
  depth: number;
};

const POSTVIEW_FUNNEL_STEPS: Array<{ key: PostViewFunnelStepKey; label: string; factor: number }> = [
  { key: "landing", label: "Главная", factor: 17 },
  { key: "productView", label: "Просмотр карточки товара", factor: 12 },
  { key: "addToCart", label: "Добавление в корзину", factor: 5.1 },
  { key: "pickupClick", label: "Кнопка забрать в магазине", factor: 1.7 },
  { key: "cartTransition", label: "Переход в корзину", factor: 1.58 },
  { key: "checkoutTransition", label: "Переход к оформлению", factor: 1.18 },
  { key: "siteOrder", label: "Заказ на сайте", factor: 1 },
  { key: "cartState", label: "Корзина", factor: 2.9 },
];

const POSTVIEW_AGE_LABELS = ["до 18", "18 - 24", "25 - 34", "35 - 44", "45 - 54", "55+"] as const;

const POSTVIEW_GOAL_OPTIONS: Array<{ value: PostViewGoalFilter; label: string }> = [
  { value: "all", label: "Все цели" },
  { value: "allSite", label: "Весь сайт" },
  { value: "firstVisit", label: "Первое посещение сайта" },
  { value: "entry", label: "Вход" },
  { value: "cartVisit", label: "Посещение корзины" },
  { value: "siteOrder", label: "Заказ на сайте" },
];

const POSTVIEW_CHANNEL_OPTIONS: Array<{ value: PostViewChannelFilter; label: string }> = [
  { value: "all", label: "Все" },
  { value: "withoutUtm", label: "Без utm меток" },
  { value: "utmWithoutAdriver", label: "С utm меткой без adriver" },
];

const POSTVIEW_HIERARCHY_LEVELS: Array<{ value: PostViewHierarchyLevel; label: string }> = [
  { value: 0, label: "Кампания" },
  { value: 1, label: "Размещение" },
  { value: 2, label: "Баннер" },
  { value: 3, label: "Дата" },
];

const POSTVIEW_LAG_MAX_BY_WINDOW: Record<AttributionWindow, number> = {
  1: 1,
  7: 7,
  30: 30,
  60: 40,
  90: 46,
};

function seededRatio(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function hashStringSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) + 1;
}

function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function emptyPostViewFunnel(): Record<PostViewFunnelStepKey, number> {
  return {
    landing: 0,
    productView: 0,
    addToCart: 0,
    pickupClick: 0,
    cartTransition: 0,
    checkoutTransition: 0,
    siteOrder: 0,
    cartState: 0,
  };
}

function splitFunnelByWeights(
  funnel: Record<PostViewFunnelStepKey, number>,
  weights: number[]
): Array<Record<PostViewFunnelStepKey, number>> {
  const splits = weights.map(() => emptyPostViewFunnel());
  POSTVIEW_FUNNEL_STEPS.forEach((step) => {
    const parts = distributeByWeights(funnel[step.key], weights);
    parts.forEach((value, index) => {
      splits[index][step.key] = value;
    });
  });
  return splits;
}

function sumPostViewFunnels(nodes: PostViewNode[]): Record<PostViewFunnelStepKey, number> {
  const total = emptyPostViewFunnel();
  nodes.forEach((node) => {
    POSTVIEW_FUNNEL_STEPS.forEach((step) => {
      total[step.key] += node.funnel[step.key];
    });
  });
  return total;
}

function formatDateRu(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}.${month}.${year}`;
}

function buildDateLabelsForHierarchy(dateFrom: string, dateTo: string, maxCount = 10): string[] {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return [formatDateRu(dateTo)];

  const all: string[] = [];
  for (let current = new Date(from); current <= to; current.setDate(current.getDate() + 1)) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    all.push(`${y}-${m}-${d}`);
  }

  if (all.length <= maxCount) return all.map(formatDateRu);

  const step = (all.length - 1) / (maxCount - 1);
  const sampled = new Set<string>();
  for (let i = 0; i < maxCount; i += 1) {
    sampled.add(all[Math.round(i * step)] ?? all[all.length - 1]);
  }
  return Array.from(sampled).sort().map(formatDateRu);
}

function applyPostViewGoalAndChannelFilters(params: {
  basePostView: number;
  seed: number;
  goalFilter: PostViewGoalFilter;
  channelFilter: PostViewChannelFilter;
}): number {
  const { basePostView, seed, goalFilter, channelFilter } = params;

  const goalBaseK: Record<PostViewGoalFilter, number> = {
    all: 1,
    allSite: 0.93,
    firstVisit: 0.76,
    entry: 0.31,
    cartVisit: 0.22,
    siteOrder: 0.14,
  };

  const channelBaseK: Record<PostViewChannelFilter, number> = {
    all: 1,
    withoutUtm: 0.61,
    utmWithoutAdriver: 0.39,
  };

  const goalVariance = 0.92 + seededRatio(seed * 17 + 13) * 0.16;
  const channelVariance = 0.93 + seededRatio(seed * 19 + 31) * 0.14;
  const goalK = goalBaseK[goalFilter] * goalVariance;
  const channelK = channelBaseK[channelFilter] * channelVariance;
  const value = Math.round(Math.max(0, basePostView) * goalK * channelK);
  return Math.max(0, value);
}

function collectPostViewNodesAtLevel(nodes: PostViewNode[], targetLevel: PostViewHierarchyLevel): PostViewNode[] {
  if (targetLevel === 0) return nodes;

  const out: PostViewNode[] = [];
  const visit = (source: PostViewNode[], level: number) => {
    if (level === targetLevel) {
      out.push(...source);
      return;
    }
    source.forEach((node) => visit(node.children, level + 1));
  };
  visit(nodes, 0);
  return out;
}

function flattenPostViewNodes(baseNodes: PostViewNode[], expandedKeys: Set<string>): PostViewVisibleNode[] {
  const out: PostViewVisibleNode[] = [];
  baseNodes.forEach((node) => {
    out.push({ node, depth: 0 });
    if (expandedKeys.has(node.key)) {
      node.children.forEach((child) => {
        out.push({ node: child, depth: 1 });
      });
    }
  });
  return out;
}

function distributeByWeights(total: number, weights: number[]): number[] {
  if (!weights.length) return [];
  if (total <= 0) return Array.from({ length: weights.length }, () => 0);

  const safeWeights = weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? weight : 0));
  const sumWeights = safeWeights.reduce((acc, value) => acc + value, 0);
  if (!sumWeights) return Array.from({ length: weights.length }, () => 0);

  const scaled = safeWeights.map((weight) => (weight / sumWeights) * total);
  const base = scaled.map((value) => Math.floor(value));
  let remainder = total - base.reduce((acc, value) => acc + value, 0);

  const remainders = scaled
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction);

  let pointer = 0;
  while (remainder > 0 && remainders.length > 0) {
    const target = remainders[pointer % remainders.length];
    base[target.index] += 1;
    remainder -= 1;
    pointer += 1;
  }

  return base;
}

function rebalanceToTarget(parts: number[], target: number): number[] {
  const out = [...parts];
  let diff = target - out.reduce((acc, value) => acc + value, 0);
  if (!diff) return out;

  const indices = out
    .map((value, index) => ({ value, index }))
    .sort((left, right) => right.value - left.value)
    .map((item) => item.index);

  let pointer = 0;
  while (diff !== 0 && indices.length > 0) {
    const index = indices[pointer % indices.length];
    if (diff > 0) {
      out[index] += 1;
      diff -= 1;
    } else if (out[index] > 0) {
      out[index] -= 1;
      diff += 1;
    }
    pointer += 1;
  }

  return out;
}

function buildPostViewFunnelCounts(params: {
  basePostView: number;
  seed: number;
  windowDays: AttributionWindow;
  withIvtFilter: boolean;
}): Record<PostViewFunnelStepKey, number> {
  const { basePostView, seed, windowDays, withIvtFilter } = params;
  const normalizedBase = Math.max(0, Math.round(basePostView));
  const windowK =
    windowDays === 1
      ? 0.18
      : windowDays === 7
        ? 0.48
        : windowDays === 30
          ? 0.84
          : windowDays === 60
            ? 1
            : 1.14;
  const ivtK = withIvtFilter ? 0.93 : 1;
  const out = {} as Record<PostViewFunnelStepKey, number>;

  POSTVIEW_FUNNEL_STEPS.forEach((step, index) => {
    const variance = 0.88 + seededRatio(seed * 101 + (index + 1) * 19) * 0.28;
    const count = Math.round(normalizedBase * step.factor * variance * windowK * ivtK);
    out[step.key] = Math.max(0, count);
  });

  return out;
}

function buildPostViewLagCounts(totalConversions: number, seed: number, maxLagDays: number): number[] {
  const total = Math.max(0, Math.round(totalConversions));
  if (!total) return Array.from({ length: maxLagDays + 1 }, () => 0);

  const weights: number[] = [];
  const smooth = 4.2 + seededRatio(seed * 13) * 2.6;

  for (let day = 0; day <= maxLagDays; day += 1) {
    const decay = Math.exp(-day / smooth);
    const variability = 0.9 + seededRatio(seed * 29 + day * 17) * 0.24;
    const firstTouchBoost = day === 0 ? 1.7 + seededRatio(seed * 43) * 0.35 : 1;
    weights.push(decay * variability * firstTouchBoost);
  }

  return distributeByWeights(total, weights);
}

function buildPostViewSocdem(totalConversions: number, seed: number) {
  const total = Math.max(0, Math.round(totalConversions));
  const ageBase = [0.005, 0.01, 0.12, 0.34, 0.39, 0.135];
  const adjustedAgeWeights = ageBase.map((weight, index) => {
    const variance = 0.85 + seededRatio(seed * 59 + (index + 1) * 7) * 0.32;
    return Math.max(0.001, weight * variance);
  });
  const byAge = distributeByWeights(total, adjustedAgeWeights);

  const femaleShare = clampValue(0.59 + (seededRatio(seed * 71) - 0.5) * 0.16, 0.46, 0.72);
  const female = Math.round(total * femaleShare);
  const male = Math.max(0, total - female);

  const maleByAgeRaw = byAge.map((bucket, index) => {
    const baseMaleShare = male / Math.max(total, 1);
    const ageShift = index <= 1 ? 0.05 : index >= 4 ? -0.04 : 0.01;
    const variance = (seededRatio(seed * 83 + (index + 1) * 11) - 0.5) * 0.08;
    const maleShare = clampValue(baseMaleShare + ageShift + variance, 0.25, 0.78);
    return Math.round(bucket * maleShare);
  });

  const maleByAge = rebalanceToTarget(maleByAgeRaw, male).map((value, index) => clampValue(value, 0, byAge[index]));
  const femaleByAge = byAge.map((bucket, index) => Math.max(0, bucket - maleByAge[index]));

  return {
    byAge,
    male,
    female,
    maleByAge,
    femaleByAge,
  };
}

function ConversionsSection(props: {
  filters: Filters;
  grain: "day" | "hour";
}) {
  const { filters, grain } = props;
  const keyBase = JSON.stringify(filters);
  const [seriesMode, setSeriesMode] = useState<"total" | "postView" | "postClick">("total");
  const [mode, setMode] = useState<"standard" | "postview">("standard");
  const [postViewPage, setPostViewPage] = useState<PostViewSubPage>("main");
  const [postViewIvtFilter, setPostViewIvtFilter] = useState(false);
  const [postViewGoalFilter, setPostViewGoalFilter] = useState<PostViewGoalFilter>("all");
  const [postViewChannelFilter, setPostViewChannelFilter] = useState<PostViewChannelFilter>("all");
  const [postViewHierarchyLevel, setPostViewHierarchyLevel] = useState<PostViewHierarchyLevel>(0);
  const [expandedPostViewKeys, setExpandedPostViewKeys] = useState<string[]>([]);
  const postViewWindowDays = filters.attributionWindow;
  const kpiRes = useAsyncResource(
    `conv-kpi-${keyBase}`,
    () => selectOverviewGeneralKpis(filters),
    EMPTY_RESPONSE
  );
  const seriesRes = useAsyncResource(
    `conv-series-${keyBase}`,
    () => selectConversionsSeries(filters),
    EMPTY_RESPONSE
  );
  const tableRes = useAsyncResource(
    `conv-table-${keyBase}`,
    () => selectConversionsTable(filters),
    EMPTY_RESPONSE
  );

  const kpiRow = (kpiRes.data.rows[0] ?? {}) as Record<string, unknown>;
  const campaignMetaById = useMemo(() => {
    const map = new Map<number, { advertiser: string }>();
    listCampaigns().forEach((campaign) => {
      map.set(campaign.id, { advertiser: campaign.advertiser });
    });
    return map;
  }, []);

  const series = (seriesRes.data.rows as Record<string, unknown>[]).map((r) => ({
    label: buildTimelineLabel(r, grain),
    total: safeNumber(r.totalConversions),
    postView: safeNumber(r.postViewConv),
    postClick: safeNumber(r.postClickConv),
    incremental: safeNumber(r.incrementalConversions),
  }));

  const rows: ConversionCampaignRow[] = (tableRes.data.rows as Record<string, unknown>[]).map((r) => {
    const id = safeNumber(r.campaignId);
    const campaign = String(r.campaignName ?? "—");
    const advertiser = campaignMetaById.get(id)?.advertiser ?? "—";
    return {
      id,
      campaign,
      advertiser,
      postView: safeNumber(r.postViewConv),
      postClick: safeNumber(r.postClickConv),
      total: safeNumber(r.totalConversions),
      incremental: safeNumber(r.incrementalConversions),
      spend: safeNumber(r.spend),
      cpa: safeNumber(r.cpa),
    };
  });

  const selectedSeriesKey = seriesMode === "total" ? "total" : seriesMode === "postView" ? "postView" : "postClick";
  const resolveSeed = (row: ConversionCampaignRow): number => {
    if (row.id > 0) return row.id;
    return Array.from(row.campaign).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  };

  const placementsByCampaign = useMemo(() => {
    const map = new Map<number, Array<{ id: number; name: string }>>();
    CATALOG.placements.forEach((placement) => {
      const list = map.get(placement.campaignId) ?? [];
      list.push({ id: placement.id, name: placement.name });
      map.set(placement.campaignId, list);
    });
    return map;
  }, []);

  const creativesByPlacement = useMemo(() => {
    const map = new Map<number, Array<{ id: number; name: string }>>();
    CATALOG.creatives.forEach((creative) => {
      const list = map.get(creative.placementId) ?? [];
      list.push({ id: creative.id, name: creative.name });
      map.set(creative.placementId, list);
    });
    return map;
  }, []);

  const postViewDateLabels = useMemo(
    () => buildDateLabelsForHierarchy(filters.dateFrom, filters.dateTo, 10),
    [filters.dateFrom, filters.dateTo]
  );

  const postViewCampaignRows: PostViewFunnelRow[] = useMemo(
    () =>
      rows.map((row) => {
        const seed = resolveSeed(row);
        const filteredBasePostView = applyPostViewGoalAndChannelFilters({
          basePostView: row.postView,
          seed,
          goalFilter: postViewGoalFilter,
          channelFilter: postViewChannelFilter,
        });
        return {
          ...row,
          funnel: buildPostViewFunnelCounts({
            basePostView: filteredBasePostView,
            seed,
            windowDays: postViewWindowDays,
            withIvtFilter: postViewIvtFilter,
          }),
        };
      }),
    [rows, postViewGoalFilter, postViewChannelFilter, postViewWindowDays, postViewIvtFilter]
  );

  const postViewTree = useMemo<PostViewNode[]>(
    () =>
      postViewCampaignRows.map((row) => {
        const campaignSeed = resolveSeed(row);
        const placementSource = placementsByCampaign.get(row.id) ?? [];
        const placements =
          placementSource.length > 0
            ? placementSource
            : [{ id: row.id * 10 + 1, name: `PL-${row.id || campaignSeed}-1` }];

        const placementWeights = placements.map(
          (_, index) => 1 + seededRatio(campaignSeed * 11 + (index + 1) * 17) * 0.7
        );
        const placementFunnels = splitFunnelByWeights(row.funnel, placementWeights);

        const placementChildren: PostViewNode[] = placements.map((placement, placementIndex) => {
          const placementFunnel = placementFunnels[placementIndex] ?? emptyPostViewFunnel();
          const creativeSource = creativesByPlacement.get(placement.id) ?? [];
          const creatives =
            creativeSource.length > 0
              ? creativeSource
              : [{ id: placement.id * 10 + 1, name: `CR-${placement.id}-1` }];

          const creativeWeights = creatives.map(
            (_, index) => 1 + seededRatio(campaignSeed * 13 + placement.id * 3 + (index + 1) * 19) * 0.7
          );
          const creativeFunnels = splitFunnelByWeights(placementFunnel, creativeWeights);

          const creativeChildren: PostViewNode[] = creatives.map((creative, creativeIndex) => {
            const creativeFunnel = creativeFunnels[creativeIndex] ?? emptyPostViewFunnel();
            const dateWeights = postViewDateLabels.map(
              (_, dateIndex) =>
                1 + seededRatio(campaignSeed * 29 + creative.id * 5 + (dateIndex + 1) * 23) * 0.8
            );
            const dateFunnels = splitFunnelByWeights(creativeFunnel, dateWeights);

            const dateChildren: PostViewNode[] = postViewDateLabels.map((dateLabel, dateIndex) => ({
              key: `date-${creative.id}-${dateLabel}`,
              id: dateIndex + 1,
              kind: "date",
              label: dateLabel,
              subtitle: creative.name,
              advertiser: row.advertiser,
              funnel: dateFunnels[dateIndex] ?? emptyPostViewFunnel(),
              children: [],
            }));

            return {
              key: `banner-${creative.id}`,
              id: creative.id,
              kind: "banner",
              label: `${creative.id} ${creative.name}`,
              subtitle: placement.name,
              advertiser: row.advertiser,
              funnel: creativeFunnel,
              children: dateChildren,
            };
          });

          return {
            key: `placement-${placement.id}`,
            id: placement.id,
            kind: "placement",
            label: `${placement.id} ${placement.name}`,
            subtitle: row.campaign,
            advertiser: row.advertiser,
            funnel: placementFunnel,
            children: creativeChildren,
          };
        });

        return {
          key: `campaign-${row.id}`,
          id: row.id,
          kind: "campaign",
          label: `${row.id} ${row.campaign}`,
          subtitle: row.advertiser,
          advertiser: row.advertiser,
          funnel: row.funnel,
          children: placementChildren,
        };
      }),
    [postViewCampaignRows, placementsByCampaign, creativesByPlacement, postViewDateLabels]
  );

  const postViewBaseNodes = useMemo(
    () => collectPostViewNodesAtLevel(postViewTree, postViewHierarchyLevel),
    [postViewTree, postViewHierarchyLevel]
  );

  const expandedPostViewSet = useMemo(() => new Set(expandedPostViewKeys), [expandedPostViewKeys]);
  const postViewVisibleNodes = useMemo(
    () => flattenPostViewNodes(postViewBaseNodes, expandedPostViewSet),
    [postViewBaseNodes, expandedPostViewSet]
  );

  const postViewMainTotals = useMemo(() => sumPostViewFunnels(postViewBaseNodes), [postViewBaseNodes]);

  const togglePostViewExpansion = (key: string) => {
    setExpandedPostViewKeys((prev) => {
      if (prev.includes(key)) return prev.filter((value) => value !== key);
      return [...prev, key];
    });
  };

  const goToNextHierarchyLevel = () => {
    setPostViewHierarchyLevel((current) => (Math.min(3, current + 1) as PostViewHierarchyLevel));
    setExpandedPostViewKeys([]);
  };

  const resetHierarchyLevel = () => {
    setPostViewHierarchyLevel(0);
    setExpandedPostViewKeys([]);
  };

  const maxLagDays = POSTVIEW_LAG_MAX_BY_WINDOW[postViewWindowDays];
  const postViewLagRows: PostViewLagRow[] = useMemo(
    () =>
      postViewVisibleNodes.map((visibleNode) => {
        const { node } = visibleNode;
        const seed = hashStringSeed(node.key);
        const total = node.funnel.siteOrder;
        return {
          node: visibleNode,
          total,
          values: buildPostViewLagCounts(total, seed, maxLagDays),
        };
      }),
    [postViewVisibleNodes, maxLagDays]
  );

  const postViewLagTotals = useMemo(
    () => {
      const baseLagRows = postViewBaseNodes.map((node) => {
        const seed = hashStringSeed(node.key);
        return buildPostViewLagCounts(node.funnel.siteOrder, seed, maxLagDays);
      });
      return baseLagRows.reduce<number[]>(
        (acc, values) => acc.map((value, index) => value + (values[index] ?? 0)),
        Array.from({ length: maxLagDays + 1 }, () => 0)
      );
    },
    [postViewBaseNodes, maxLagDays]
  );

  const lagChartData = useMemo(
    () => postViewLagTotals.map((value, day) => ({ day: String(day), conversions: value })),
    [postViewLagTotals]
  );

  const postViewSocdemRows: PostViewSocdemRow[] = useMemo(
    () =>
      postViewVisibleNodes.map((visibleNode) => {
        const { node } = visibleNode;
        const seed = hashStringSeed(node.key);
        const total = node.funnel.siteOrder;
        const socdem = buildPostViewSocdem(total, seed);
        return {
          node: visibleNode,
          total,
          byAge: socdem.byAge,
          male: socdem.male,
          female: socdem.female,
          maleByAge: socdem.maleByAge,
          femaleByAge: socdem.femaleByAge,
        };
      }),
    [postViewVisibleNodes]
  );

  const postViewSocdemTotals = useMemo(
    () => {
      const totalsSeedRows = postViewBaseNodes.map((node) => {
        const seed = hashStringSeed(node.key);
        const total = node.funnel.siteOrder;
        const socdem = buildPostViewSocdem(total, seed);
        return { total, ...socdem };
      });

      return totalsSeedRows.reduce(
        (acc, row) => {
          acc.total += row.total;
          acc.male += row.male;
          acc.female += row.female;
          row.byAge.forEach((value, index) => {
            acc.byAge[index] += value;
            acc.maleByAge[index] += row.maleByAge[index] ?? 0;
            acc.femaleByAge[index] += row.femaleByAge[index] ?? 0;
          });
          return acc;
        },
        {
          total: 0,
          male: 0,
          female: 0,
          byAge: Array.from({ length: POSTVIEW_AGE_LABELS.length }, () => 0),
          maleByAge: Array.from({ length: POSTVIEW_AGE_LABELS.length }, () => 0),
          femaleByAge: Array.from({ length: POSTVIEW_AGE_LABELS.length }, () => 0),
        }
      );
    },
    [postViewBaseNodes]
  );

  const postViewGenderChartData = useMemo(
    () => [
      { name: "Женщины", value: postViewSocdemTotals.female, color: "#8bc0ec" },
      { name: "Мужчины", value: postViewSocdemTotals.male, color: "#1d70b7" },
    ],
    [postViewSocdemTotals.female, postViewSocdemTotals.male]
  );

  const postViewAgeChartData = useMemo(
    () =>
      POSTVIEW_AGE_LABELS.map((label, index) => ({
        age: label,
        women: postViewSocdemTotals.femaleByAge[index] ?? 0,
        men: postViewSocdemTotals.maleByAge[index] ?? 0,
      })),
    [postViewSocdemTotals.femaleByAge, postViewSocdemTotals.maleByAge]
  );

  const socdemCoverage = useMemo(() => {
    const base =
      0.82 +
      (postViewWindowDays === 90
        ? 0.03
        : postViewWindowDays === 60
          ? 0.015
          : postViewWindowDays === 30
            ? 0
            : postViewWindowDays === 7
              ? -0.02
              : -0.04) +
      Math.min(postViewBaseNodes.length, 30) * 0.002 -
      (postViewIvtFilter ? 0.01 : 0);
    const overall = clampValue(base, 0.78, 0.96);
    const gender = clampValue(overall + 0.04, 0.82, 0.98);
    const age = clampValue(overall - 0.12, 0.62, 0.9);
    return { overall, gender, age };
  }, [postViewWindowDays, postViewIvtFilter, postViewBaseNodes.length]);

  const hierarchyLevelLabel =
    POSTVIEW_HIERARCHY_LEVELS.find((level) => level.value === postViewHierarchyLevel)?.label ?? "Кампания";
  const canGoNextHierarchyLevel = postViewHierarchyLevel < 3;

  const postViewSubtitle =
    postViewPage === "main"
      ? "Страница 1. Основная таблица post-view этапов."
      : postViewPage === "lag"
        ? "Страница 2. Время до конверсии после post-view контакта."
        : "Страница 3. Соцдем-профиль post-view конверсий.";

  const renderPostViewNodeCell = (item: PostViewVisibleNode) => {
    const { node, depth } = item;
    const expandable = depth === 0 && node.children.length > 0;
    const expanded = expandedPostViewSet.has(node.key);

    return (
      <div className={`flex items-start gap-2 ${depth > 0 ? "pl-5" : ""}`}>
        {expandable ? (
          <button
            type="button"
            onClick={() => togglePostViewExpansion(node.key)}
            className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-300 text-[10px] text-slate-600 hover:bg-slate-50"
            aria-label={expanded ? "Свернуть уровень" : "Развернуть уровень"}
            title={expanded ? "Свернуть уровень" : "Развернуть уровень"}
          >
            {expanded ? "−" : "+"}
          </button>
        ) : (
          <span className="inline-block h-4 w-4 shrink-0" />
        )}

        <div className="min-w-0">
          <div className="truncate font-medium text-slate-900">{node.label}</div>
          <div className="truncate text-[11px] text-slate-500">{node.subtitle || node.advertiser}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Конверсии"
        subtitle={
          mode === "standard"
            ? "Всего/PV/PC, инкрементальность и стоимость конверсии."
            : "Post-view атрибуция: этапы, лаг до конверсии и соцдем."
        }
      />

      <section className="rounded-xl border border-slate-200 bg-white p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-slate-50 p-0.5">
            {([
              ["standard", "Базовые конверсии"],
              ["postview", "Post-view атрибуция"],
            ] as const).map(([itemMode, label]) => (
              <button
                key={itemMode}
                type="button"
                onClick={() => setMode(itemMode)}
                className={`h-8 rounded-full px-3 text-xs font-medium transition ${
                  mode === itemMode
                    ? "bg-sky-600 text-white"
                    : "text-slate-700 hover:bg-white hover:text-sky-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "postview" && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-600">
                <span className="whitespace-nowrap text-[11px]">Цель</span>
                <select
                  value={postViewGoalFilter}
                  onChange={(event) => {
                    setPostViewGoalFilter(event.target.value as PostViewGoalFilter);
                    setExpandedPostViewKeys([]);
                  }}
                  className="bg-transparent text-xs font-medium text-slate-700 outline-none"
                >
                  {POSTVIEW_GOAL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-600">
                <span className="whitespace-nowrap text-[11px]">Канал</span>
                <select
                  value={postViewChannelFilter}
                  onChange={(event) => {
                    setPostViewChannelFilter(event.target.value as PostViewChannelFilter);
                    setExpandedPostViewKeys([]);
                  }}
                  className="bg-transparent text-xs font-medium text-slate-700 outline-none"
                >
                  {POSTVIEW_CHANNEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={postViewIvtFilter}
                  onChange={(event) => {
                    setPostViewIvtFilter(event.target.checked);
                    setExpandedPostViewKeys([]);
                  }}
                />
                IVT фильтрация
              </label>
            </div>
          )}
        </div>
      </section>

      {mode === "standard" && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard title="Всего конверсий" value={fmtInt(safeNumber(kpiRow.totalConversions))} metricKey="totalConversions" />
            <MetricCard title="Конверсии post-view" value={fmtInt(safeNumber(kpiRow.postViewConv))} metricKey="postViewConv" />
            <MetricCard title="Конверсии post-click" value={fmtInt(safeNumber(kpiRow.postClickConv))} metricKey="postClickConv" />
            <MetricCard
              title="Инкрементальные конверсии"
              value={fmtInt(safeNumber(kpiRow.incrementalConversions))}
              metricKey="incrementalConversions"
            />
            <MetricCard
              title="CPA"
              value={safeNumber(kpiRow.totalConversions) > 0 ? fmtCurrency(safeNumber(kpiRow.cpa)) : "—"}
              metricKey="cpa"
            />
            <MetricCard title="Затраты" value={fmtCurrency(safeNumber(kpiRow.spend))} metricKey="spend" />
          </section>

          <section className="rounded-xl border bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Конверсии</h3>
              <div className="flex flex-wrap gap-2">
                {([
                  ["total", "Всего"],
                  ["postView", "Post-view"],
                  ["postClick", "Post-click"],
                ] as const).map(([metricMode, label]) => (
                  <button
                    key={metricMode}
                    onClick={() => setSeriesMode(metricMode)}
                    className={`rounded-full px-2.5 py-1 text-xs ring-1 ${
                      seriesMode === metricMode
                        ? "bg-sky-600 text-white ring-sky-600"
                        : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" minTickGap={22} tick={CHART_TICK_STYLE} />
                  <YAxis tick={CHART_TICK_STYLE} tickFormatter={(v) => fmtInt(Number(v))} />
                  <Tooltip
                    formatter={(v) => fmtInt(Number(v))}
                    contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  />
                  <Line dataKey={selectedSeriesKey} stroke="#93c01f" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-3">
            <h3 className="mb-2 text-sm font-semibold">Инкрементальные конверсии</h3>
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" minTickGap={22} tick={CHART_TICK_STYLE} />
                  <YAxis tick={CHART_TICK_STYLE} tickFormatter={(v) => fmtInt(Number(v))} />
                  <Tooltip
                    formatter={(v) => fmtInt(Number(v))}
                    contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  />
                  <Line dataKey="incremental" stroke="#35a8e0" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-3">
            <h3 className="mb-2 text-sm font-semibold">Кампании</h3>
            <div className="overflow-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 text-left">Кампания</th>
                    <th className="p-2 text-right">Конверсии post-view</th>
                    <th className="p-2 text-right">Конверсии post-click</th>
                    <th className="p-2 text-right">Всего конверсий</th>
                    <th className="p-2 text-right">Инкрементальные</th>
                    <th className="p-2 text-right">Затраты</th>
                    <th className="p-2 text-right">CPA</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.id}-${row.campaign}`} className="odd:bg-white even:bg-gray-50">
                      <td className="border-t p-2">{row.campaign}</td>
                      <td className="border-t p-2 text-right">{fmtInt(row.postView)}</td>
                      <td className="border-t p-2 text-right">{fmtInt(row.postClick)}</td>
                      <td className="border-t p-2 text-right">{fmtInt(row.total)}</td>
                      <td className="border-t p-2 text-right">{fmtInt(row.incremental)}</td>
                      <td className="border-t p-2 text-right">{fmtCurrency(row.spend)}</td>
                      <td className="border-t p-2 text-right">{row.total > 0 ? fmtCurrency(row.cpa) : "—"}</td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr>
                      <td colSpan={7} className="border-t p-4 text-center text-slate-500">
                        Нет данных по кампаниям
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {mode === "postview" && (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-slate-50 p-0.5">
                {([
                  ["main", "Страница 1. Основная таблица"],
                  ["lag", "Страница 2. Время до конверсии"],
                  ["socdem", "Страница 3. Соцдем"],
                ] as const).map(([page, label]) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setPostViewPage(page)}
                    className={`h-8 rounded-full px-3 text-xs font-medium transition ${
                      postViewPage === page
                        ? "bg-sky-600 text-white"
                        : "text-slate-700 hover:bg-white hover:text-sky-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={goToNextHierarchyLevel}
                  disabled={!canGoNextHierarchyLevel}
                  className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                  title="Перейти на следующий уровень в иерархии"
                >
                  Следующий уровень
                </button>
                <button
                  type="button"
                  onClick={resetHierarchyLevel}
                  className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Сброс уровня
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <div>
                Текущий уровень: <span className="font-semibold text-slate-700">{hierarchyLevelLabel}</span>
              </div>
              <div>
                Строк в таблице: <span className="font-semibold text-slate-700">{fmtInt(postViewVisibleNodes.length)}</span>
              </div>
            </div>
            <p className="text-xs text-slate-500">{postViewSubtitle}</p>
          </section>

          {postViewPage === "main" && (
            <section className="rounded-xl border bg-white p-3">
              <div className="overflow-auto">
                <table className="min-w-[1380px] border-collapse text-xs">
                  <thead>
                    <tr className="bg-sky-50 text-slate-700">
                      <th rowSpan={2} className="w-[320px] border-b border-sky-200 p-2 text-left">
                        {hierarchyLevelLabel}
                      </th>
                      {POSTVIEW_FUNNEL_STEPS.map((step, index) => (
                        <th key={step.key} className="min-w-[120px] border-b border-l border-sky-200 p-2 text-center">
                          <div className="text-[11px] font-medium text-slate-500">{index + 1}</div>
                          <div className="text-[12px] font-semibold">{step.label}</div>
                        </th>
                      ))}
                    </tr>
                    <tr className="bg-sky-50/70 text-slate-600">
                      {POSTVIEW_FUNNEL_STEPS.map((step) => (
                        <th key={`${step.key}-pv`} className="border-b border-l border-sky-200 p-2 text-center text-[11px]">
                          Post-view
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {postViewVisibleNodes.map((item) => (
                      <tr key={`pv-main-${item.node.key}`} className="odd:bg-white even:bg-slate-50/40">
                        <td className="border-t border-slate-200 p-2">{renderPostViewNodeCell(item)}</td>
                        {POSTVIEW_FUNNEL_STEPS.map((step) => (
                          <td key={`pv-main-cell-${item.node.key}-${step.key}`} className="border-l border-t border-slate-200 p-2 text-right tabular-nums">
                            {fmtInt(item.node.funnel[step.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="bg-slate-100 font-semibold">
                      <td className="border-t border-slate-200 p-2 text-slate-900">Всего</td>
                      {POSTVIEW_FUNNEL_STEPS.map((step) => (
                        <td key={`pv-main-total-${step.key}`} className="border-l border-t border-slate-200 p-2 text-right tabular-nums text-slate-900">
                          {fmtInt(postViewMainTotals[step.key])}
                        </td>
                      ))}
                    </tr>
                    {!postViewVisibleNodes.length && (
                      <tr>
                        <td colSpan={1 + POSTVIEW_FUNNEL_STEPS.length} className="border-t p-4 text-center text-slate-500">
                          Нет данных post-view по текущим фильтрам
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {postViewPage === "lag" && (
            <>
              <section className="rounded-xl border bg-white p-3">
                <div className="overflow-auto">
                  <table
                    className="border-collapse text-xs"
                    style={{ minWidth: `${Math.max(1040, 280 + (maxLagDays + 1) * 56)}px` }}
                  >
                    <thead>
                      <tr className="bg-sky-50 text-slate-700">
                        <th className="sticky left-0 z-10 w-[260px] border-b border-sky-200 bg-sky-50 p-2 text-left">
                          {hierarchyLevelLabel}
                        </th>
                        {Array.from({ length: maxLagDays + 1 }, (_, day) => (
                          <th key={`pv-lag-h-${day}`} className="border-b border-l border-sky-200 p-2 text-center">
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {postViewLagRows.map((row) => (
                        <tr key={`pv-lag-${row.node.node.key}`} className="odd:bg-white even:bg-slate-50/40">
                          <td className="sticky left-0 z-10 border-t border-slate-200 bg-inherit p-2">
                            {renderPostViewNodeCell(row.node)}
                          </td>
                          {row.values.map((value, index) => (
                            <td key={`pv-lag-c-${row.node.node.key}-${index}`} className="border-l border-t border-slate-200 p-2 text-right tabular-nums">
                              {fmtInt(value)}
                            </td>
                          ))}
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-semibold">
                        <td className="sticky left-0 z-10 border-t border-slate-200 bg-slate-100 p-2 text-slate-900">Всего</td>
                        {postViewLagTotals.map((value, index) => (
                          <td key={`pv-lag-total-${index}`} className="border-l border-t border-slate-200 p-2 text-right tabular-nums text-slate-900">
                            {fmtInt(value)}
                          </td>
                        ))}
                      </tr>
                      {!postViewLagRows.length && (
                        <tr>
                          <td colSpan={maxLagDays + 2} className="border-t p-4 text-center text-slate-500">
                            Нет данных для распределения времени до конверсии
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-xl border bg-white p-3">
                <h3 className="mb-2 text-sm font-semibold">Распределение конверсий по времени до конверсии</h3>
                <div className="h-72">
                  <ResponsiveContainer>
                    <BarChart data={lagChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" minTickGap={18} tick={CHART_TICK_STYLE} />
                      <YAxis tick={CHART_TICK_STYLE} tickFormatter={(value) => fmtInt(Number(value))} />
                      <Tooltip
                        formatter={(value) => fmtInt(Number(value))}
                        contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                        labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                        itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                      />
                      <Bar dataKey="conversions" fill="#8bc0ec" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </>
          )}

          {postViewPage === "socdem" && (
            <>
              <section className="rounded-xl border bg-white p-3">
                <div className="overflow-auto">
                  <table className="min-w-[1260px] border-collapse text-xs">
                    <thead>
                      <tr className="bg-sky-50 text-slate-700">
                        <th className="w-[300px] border-b border-sky-200 p-2 text-left">{hierarchyLevelLabel}</th>
                        <th className="border-b border-l border-sky-200 p-2 text-right">Всего конверсий</th>
                        <th className="border-b border-l border-sky-200 p-2 text-right">до 18</th>
                        <th className="border-b border-l border-sky-200 p-2 text-right">18 - 24</th>
                        <th className="border-b border-l border-sky-200 p-2 text-right">25 - 34</th>
                        <th className="border-b border-l border-sky-200 p-2 text-right">35 - 44</th>
                        <th className="border-b border-l border-sky-200 p-2 text-right">45 - 54</th>
                        <th className="border-b border-l border-sky-200 p-2 text-right">55+</th>
                        <th className="border-b border-l border-sky-200 p-2 text-right">Муж</th>
                        <th className="border-b border-l border-sky-200 p-2 text-right">Жен</th>
                      </tr>
                    </thead>
                    <tbody>
                      {postViewSocdemRows.map((row) => (
                        <tr key={`pv-socdem-${row.node.node.key}`} className="odd:bg-white even:bg-slate-50/40">
                          <td className="border-t border-slate-200 p-2">{renderPostViewNodeCell(row.node)}</td>
                          <td className="border-l border-t border-slate-200 p-2 text-right tabular-nums">{fmtInt(row.total)}</td>
                          {row.byAge.map((value, index) => (
                            <td key={`pv-socdem-age-${row.node.node.key}-${index}`} className="border-l border-t border-slate-200 p-2 text-right tabular-nums">
                              {fmtInt(value)}
                            </td>
                          ))}
                          <td className="border-l border-t border-slate-200 p-2 text-right tabular-nums">{fmtInt(row.male)}</td>
                          <td className="border-l border-t border-slate-200 p-2 text-right tabular-nums">{fmtInt(row.female)}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-semibold">
                        <td className="border-t border-slate-200 p-2 text-slate-900">Всего</td>
                        <td className="border-l border-t border-slate-200 p-2 text-right tabular-nums">{fmtInt(postViewSocdemTotals.total)}</td>
                        {postViewSocdemTotals.byAge.map((value, index) => (
                          <td key={`pv-socdem-total-${index}`} className="border-l border-t border-slate-200 p-2 text-right tabular-nums">
                            {fmtInt(value)}
                          </td>
                        ))}
                        <td className="border-l border-t border-slate-200 p-2 text-right tabular-nums">{fmtInt(postViewSocdemTotals.male)}</td>
                        <td className="border-l border-t border-slate-200 p-2 text-right tabular-nums">{fmtInt(postViewSocdemTotals.female)}</td>
                      </tr>
                      {!postViewSocdemRows.length && (
                        <tr>
                          <td colSpan={10} className="border-t p-4 text-center text-slate-500">
                            Нет данных по соцдему
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-3">
                <div className="rounded-xl border bg-white p-4">
                  <h3 className="mb-3 text-sm font-semibold">Определяемость</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="text-[36px] font-semibold leading-none text-slate-900">{fmtPercent(socdemCoverage.overall, 1)}</div>
                      <div className="text-sm text-slate-600">Соцдем определен</div>
                    </div>
                    <div>
                      <div className="text-[36px] font-semibold leading-none text-slate-900">{fmtPercent(socdemCoverage.gender, 1)}</div>
                      <div className="text-sm text-slate-600">Пол определен</div>
                    </div>
                    <div>
                      <div className="text-[36px] font-semibold leading-none text-slate-900">{fmtPercent(socdemCoverage.age, 1)}</div>
                      <div className="text-sm text-slate-600">Возраст определен</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-4">
                  <h3 className="mb-2 text-sm font-semibold">Конверсии по полу</h3>
                  <div className="h-64">
                    <ResponsiveContainer>
                      <PieChart>
                        <Tooltip
                          formatter={(value) => fmtInt(Number(value))}
                          contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                          labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                          itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                        />
                        <Pie
                          data={postViewGenderChartData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={56}
                          outerRadius={90}
                          paddingAngle={1}
                        >
                          {postViewGenderChartData.map((item) => (
                            <Cell key={`pv-gender-${item.name}`} fill={item.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs">
                    {postViewGenderChartData.map((item) => {
                      const total = Math.max(1, postViewSocdemTotals.male + postViewSocdemTotals.female);
                      const share = item.value / total;
                      return (
                        <div key={`pv-gender-label-${item.name}`} className="inline-flex items-center gap-1.5 text-slate-600">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span>
                            {item.name}: {fmtPercent(share, 1)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-4">
                  <h3 className="mb-2 text-sm font-semibold">Конверсии по возрасту</h3>
                  <div className="h-64">
                    <ResponsiveContainer>
                      <BarChart data={postViewAgeChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="age" tick={CHART_TICK_STYLE} />
                        <YAxis tick={CHART_TICK_STYLE} tickFormatter={(value) => fmtInt(Number(value))} />
                        <Tooltip
                          formatter={(value) => fmtInt(Number(value))}
                          contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                          labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                          itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                        />
                        <Bar dataKey="women" stackId="gender" fill="#8bc0ec" name="Женщины" />
                        <Bar dataKey="men" stackId="gender" fill="#1d70b7" name="Мужчины" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}

function ExportsSection(props: {
  filters: Filters;
  budgetsByPlacementId: Record<string, number>;
  lastUploadMeta: { fileName: string; uploadedAt: string; rowsOk: number; rowsError: number } | null;
  onUpsertBudgets: (
    next: Record<string, number>,
    meta: { fileName: string; uploadedAt: string; rowsOk: number; rowsError: number }
  ) => void;
  onClearBudgets: () => void;
}) {
  const { filters, budgetsByPlacementId, lastUploadMeta, onUpsertBudgets, onClearBudgets } = props;

  const [uploadSummary, setUploadSummary] = useState<{ rowsOk: number; rowsError: number } | null>(null);
  const [uploadErrors, setUploadErrors] = useState<BudgetParseError[]>([]);
  const [toastText, setToastText] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedCampaignIds = filters.campaignIds;
  const canDownloadTemplate = selectedCampaignIds.length > 0;
  const budgetKpis = useMemo(
    () => computeBudgetKpis(filters, MOCK_DATASET, budgetsByPlacementId),
    [filters, budgetsByPlacementId]
  );

  useEffect(() => {
    if (!toastText) return;
    const timer = window.setTimeout(() => setToastText(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toastText]);

  const handleDownloadTemplate = async () => {
    const result = await exportBudgetsTemplate(filters, MOCK_DATASET);
    if (!result.downloaded) return;
  };

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setUploadSummary({ rowsOk: 0, rowsError: 1 });
      setUploadErrors([{ placementId: "—", reason: "Поддерживается только .xlsx" }]);
      return;
    }

    setIsUploading(true);
    try {
      const parsed = await parseBudgetsXlsx(file);
      const placementMap = new Map<number, { campaignId: number }>();
      for (const row of MOCK_DATASET) {
        if (!placementMap.has(row.placementId)) {
          placementMap.set(row.placementId, { campaignId: row.campaignId });
        }
      }

      const selected = new Set(selectedCampaignIds);
      const errors: BudgetParseError[] = [...parsed.errors];
      const validRows: Array<{ placementId: number; plannedBudget: number }> = [];

      parsed.rows.forEach((row) => {
        const placement = placementMap.get(row.placementId);
        if (!placement) {
          errors.push({ placementId: String(row.placementId), reason: "placement_id отсутствует в датасете" });
          return;
        }
        if (selected.size && !selected.has(placement.campaignId)) {
          errors.push({
            placementId: String(row.placementId),
            reason: "placement_id не относится к выбранным кампаниям",
          });
          return;
        }
        if (placement.campaignId !== row.campaignId) {
          errors.push({
            placementId: String(row.placementId),
            reason: "campaign_id не соответствует placement_id",
          });
          return;
        }
        validRows.push({ placementId: row.placementId, plannedBudget: row.plannedBudget });
      });

      const nextBudgets: Record<string, number> = {};
      validRows.forEach((row) => {
        nextBudgets[String(row.placementId)] = row.plannedBudget;
      });

      const rowsOk = validRows.length;
      const rowsError = errors.length;
      setUploadSummary({ rowsOk, rowsError });
      setUploadErrors(errors);

      if (rowsOk > 0) {
        onUpsertBudgets(nextBudgets, {
          fileName: file.name,
          uploadedAt: new Date().toISOString(),
          rowsOk,
          rowsError,
        });
        setToastText("Бюджеты обновлены");
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <SectionTitle title="Экспорт-импорт" subtitle="Шаблон бюджетов по размещениям и загрузка заполненного Excel." />

      {toastText && (
        <div className="fixed right-6 top-6 z-50 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 shadow-sm">
          {toastText}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard title="Плановый бюджет" value={fmtCurrency(budgetKpis.plannedBudget)} metricKey="plannedBudget" />
        <MetricCard
          title="Budget coverage"
          value={fmtPercent(budgetKpis.budgetCoverageRatio)}
          metricKey="budgetCoverage"
          hint={`Заполнено: ${budgetKpis.coveredPlacements}/${budgetKpis.totalPlacements}`}
        />
        <MetricCard
          title="План vs Затраты"
          value={fmtCurrency(budgetKpis.budgetVsSpend)}
          metricKey="budgetVsSpend"
          hint={
            budgetKpis.budgetVsSpendPct === null
              ? "План не задан"
              : `${budgetKpis.budgetVsSpendPct >= 0 ? "+" : ""}${(budgetKpis.budgetVsSpendPct * 100).toFixed(1)}% от плана`
          }
        />
      </section>

      <section className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Скачать шаблон</h3>
            <p className="text-xs text-slate-500">Формируется по выбранным кампаниям и их размещениям.</p>
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={!canDownloadTemplate}
            className="rounded-md bg-sky-600 px-3 py-2 text-xs text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Скачать Excel по выбранным кампаниям
          </button>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Загрузить бюджеты</h3>
            <p className="text-xs text-slate-500">Принимаем только .xlsx в формате шаблона.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!canDownloadTemplate || isUploading}
              className="rounded-md border px-3 py-2 text-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Выбрать файл
            </button>
            <button
              type="button"
              onClick={onClearBudgets}
              className="rounded-md border px-3 py-2 text-xs text-rose-700 hover:bg-rose-50"
            >
              Очистить бюджеты
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.currentTarget.value = "";
          }}
        />

        <div
          className={`rounded-xl border border-dashed p-6 text-center text-xs ${
            canDownloadTemplate
              ? "border-slate-300 bg-slate-50 text-slate-600"
              : "border-slate-200 bg-slate-100 text-slate-400"
          }`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!canDownloadTemplate) return;
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
        >
          {canDownloadTemplate
            ? "Перетащите .xlsx файл сюда или выберите файл кнопкой выше"
            : "Сначала выберите кампании в фильтрах"}
        </div>

        {uploadSummary && (
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            Загружено строк: {uploadSummary.rowsOk}, ошибок: {uploadSummary.rowsError}
          </div>
        )}

        {uploadErrors.length > 0 && (
          <div className="mt-3 overflow-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left">placement_id</th>
                  <th className="p-2 text-left">Причина</th>
                </tr>
              </thead>
              <tbody>
                {uploadErrors.map((err, idx) => (
                  <tr key={`${err.placementId}-${idx}`} className="odd:bg-white even:bg-gray-50">
                    <td className="border-t p-2">{err.placementId}</td>
                    <td className="border-t p-2">{err.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold">Последняя загрузка</h3>
        {lastUploadMeta ? (
          <div className="space-y-1 text-xs text-slate-700">
            <div>Файл: {lastUploadMeta.fileName}</div>
            <div>Время: {new Date(lastUploadMeta.uploadedAt).toLocaleString("ru-RU")}</div>
            <div>Успешно: {lastUploadMeta.rowsOk}</div>
            <div>Ошибок: {lastUploadMeta.rowsError}</div>
          </div>
        ) : (
          <div className="text-xs text-slate-500">Файл бюджетов ещё не загружался.</div>
        )}
      </section>
    </div>
  );
}

function HelpSection() {
  const glossarySections: Array<{
    title: string;
    items: Array<{ term: string; text: string }>;
  }> = [
    {
      title: "Методика измерения",
      items: [
        {
          term: "Типы верификационных кодов и особенности учета",
          text: `Для верификации размещений могут использоваться разные типы кодов, отличающиеся возможностями верификации.
Полные возможности предоставляют коды прошивки для баннеров и VPAID контейнер для видео. В таком случае доступна верификация IVT трафика, подтверждения загрузки, измеримости, видимости, определение фактического домена размещения.
В случае использования пикселей доступна только верификация IVT трафика.
Фактический домен размещения не может быть определен, в качестве домена в данном случае используется ближайший технический домен, который может не совпадать (и чаще всего не совпадает) с фактическим.`,
        },
        {
          term: "Измерение видимости по стандарту IAB/MRC",
          text: `Видимым считается показ баннера в активной вкладке браузера, при котором не менее 50% площади баннера находилось на экране в течение не менее одной последовательной секунды (для видео не менее двух последовательных секунд).`,
        },
        {
          term: "Измерение видимости по заданным параметрам Custom",
          text: `Видимым считается показ баннера в активной вкладке браузера, при указанных во время загрузки баннера значениях площади и времени видимости.`,
        },
        {
          term: "GIVT, показы",
          text: `- Datacenter traffic: трафик исходящий из хостерских IP диапазонов, которые не могут использоваться для выхода в сеть обычных пользователей, в том числе анонимные прокси
- Blocked IP: IP диапазоны, заблокированные по причине регулярной аномальной активности, выявленного фрода, технических проблем
- Bad User Agents: браузеры, идентифицирующие себя как известные поисковые и другие роботы, средства автоматизированной загрузки контента, мониторинга рекламы и другие подобные системы
- Excessive activity: активность пользователя, превышающая характерные для обычной пользовательской сессии значения
- Для видео дополнительно: нарушение порядка и количества событий`,
        },
        {
          term: "Показы GIVT",
          text: "Количество показов, отнесенных к General Invalid Traffic. Это технически или автоматически сгенерированный невалидный трафик, который определяется по формальным признакам и справочникам.",
        },
        {
          term: "Показы GIVT %",
          text: "Доля показов GIVT от общего количества показов. Метрика помогает быстро понять, какая часть трафика относится к general invalid traffic и требует фильтрации при оценке качества.",
        },
        {
          term: "SIVT, трафик",
          text: `- Трафик в кампании, источником которого являются пользователи, имеющие статус ботов
- Статус назначается при выявлении регулярной аномальной активности, не характерной для обычных пользовательских сессий
- Классификация основана на поведении, а не на формальных признаках, которые могут быть фальсифицированы. Например, устаревшая версия user agent сама по себе не является признаком IVT
- Для классификации используется анализ прецедентов за длительный период времени на всей платформе AdRiver/Soloway`,
        },
        {
          term: "Показы SIVT",
          text: "Количество показов, отнесенных к Sophisticated Invalid Traffic. Это более сложные формы невалидного трафика, которые выявляются по поведенческим паттернам, аномалиям и накопленному анализу платформы.",
        },
        {
          term: "Показы SIVT %",
          text: "Доля показов SIVT от общего количества показов. Метрика используется для оценки уровня сложного фрода и сравнения качества трафика между поставщиками, размещениями и доменами.",
        },
        {
          term: "Креатив загружен",
          text: "Видео-дашборд использует это пользовательское название для базовой метрики показов. По смыслу это стартовая точка воронки видео и соответствует общему объему показов креатива.",
        },
        {
          term: "CPM видео",
          text: "Пользовательское название стандартной метрики CPM в контексте видео-инвентаря. Считается как стоимость 1000 показов видео и соответствует общей метрике CPM.",
        },
        {
          term: "Методология выявления SIVT",
          text: `- Ручной разбор прецедентов аномальной активности, построение правил их определения
- Автоматический анализ данных платформы AdRiver/Soloway за длительный период (более 2 триллионов датапоинтов) по заданным правилам, оффлайн классификация пользователей
- Автоматическое выявление источников трафика, с повышенной концентрацией пользователей с аномальной активностью
- Риалтайм разметка пользователей, сконцентрированных на источниках, с аномальной активностью, превышающей пороговые значение как ботов на определенное время. При повторном многократном повторении статус подтверждается
- Риалтайм фильтрация в любых РК и на сайтах рекламодателей пользователей, классифицированных как боты`,
        },
      ],
    },
    {
      title: "Измерения",
      items: [
        {
          term: "Типы устройств",
          text: `Тип устройства определяется по его user agent.
Прочее - еще не классифицированные устройства.`,
        },
        {
          term: "Домен",
          text: `Если информация о странице размещения доступна, то мы усекаем ее до домена второго уровня, отбрасываем адрес страницы и параметры. В случае возникновения вопросов к определенному размещению, можно посчитать отчет по отдельному сайту в большей детализации.
Определение фактического домена размещения производится только для полных кодов верификации: прошивки баннеров или vpaid контейнера. При использовании простых пикселей определение фактического домена не доступно. Так как определение домена производится библиотекой верификации или контейнером после ее загрузки, то в случае, если показ не подтвержден, или, для видео размещений, impression вызван плеером, а VPAID контейнер не загружен, фактический домен определить не представляется возможным. Это также невозможно в определенных браузерах (незначительная доля, не более 5%), и в случае inapp размещений.`,
        },
        {
          term: "Верификация видимости в РСЯ и на других площадках учитывающих только видимые показы в статистике",
          text: `В случае верификации размещений подрядчиков, которые сами учитывают только видимые показы и/или закупают размещения у суб-подрядчиков, учитывающих видимые показы (например любые независимые DSP, закупающие трафик в РСЯ), AdRiver не получает от подрядчика информации о том, какие показы были учтены в статистику, какие нет и верифицирует на видимость весь трафик. Подрядчик же, в свою очередь, учитывает в статистике и предъявляет к оплате только видимые показы. Таким образом в статистике будет больше показов, чем у подрядчика, при этом может быть зафиксирована низкая видимость, которая в данном случае не имеет значения, так как невидимые показы не оплачиваются.
В случае если размещение проходит только на РСЯ достаточно сравнить видимые показы в AdRiver и видимые показы подрядчика, без учета самого показателя видимости. В случае, если подрядчик закупает трафик не только в РСЯ, но и в других источниках, сравнение невозможно, так как для части размещения будут учтены только видимые показы (РСЯ), а для части - все показы. Во избежание такой неопределенности рекомендуем при наличии технической возможности выделять размещения у суб-подрядчиков, учитывающих только видимые показы, в отдельное размещение.`,
        },
      ],
    },
    {
      title: "Метрики",
      items: [
        {
          term: "Всего запросов",
          text: "Сумма засчитанных показов и отфильтрованных IVT показов.",
        },
        {
          term: "Недействительный трафик, IVT",
          text: "Трафик, являющийся результатом намеренной манипуляции с откруткой рекламы и/или её измерениями, либо создающий фиктивную пользовательскую активность, а также трафик скомпрометированных устройств, замеченных в создании недействительного трафика ранее, обычно через вредоносные расширения браузеров и тулбары.",
        },
        {
          term: "Отфильтровано GIVT",
          text: "Недействительный трафик, для определения которого достаточно информации о текущей сессии пользователя в конкретной рекламной кампании.",
        },
        {
          term: "Отфильтровано SIVT",
          text: "Сложный для определения недействительный трафик, для выявления которого требуется анализ информации по всей платформе AdRiver за длительный период времени: индивидуальная оценка посетителя по множеству факторов, в том числе информации о прецедентах аномального поведения в автоматическом режиме по всем доступным данным. Фильтрация событий происходит при накоплении критического веса.",
        },
        {
          term: "Подтверждение загрузки",
          text: "Происходит, когда в ответ на обращение к адсерверу, на страницу загружается код баннера. Наступает в момент, когда контент баннера начинает загружаться и отрисовываться. Подтверждение загрузки может быть зафиксировано только при использовании кодов прошивки и не доступно при использовании обычного пикселя.",
        },
        {
          term: "Измеримые показы IAB",
          text: "Количество показов, для которых возможно провести измерение видимости показов. Доля измеримых считается как отношение измеримых показов ко всем вызовам кода баннера.",
        },
        {
          term: "Измеримые показы Custom",
          text: "Количество показов согласно заданным пользователем параметрам площади и времени видимости баннера. Доля считается как отношение видимых показов к измеримым.",
        },
        {
          term: "Видимые показы IAB",
          text: "Количество показов, для которых было зарегистрировано событие видимости согласно стандарта IAB/MRC. Доля считается как отношение видимых показов к измеримым показам.",
        },
        {
          term: "Видимые показы Custom",
          text: "Видимым считается показ баннера в активной вкладке браузера, при указанных во время загрузки баннера значениях площади и времени видимости.",
        },
        {
          term: "IVT клики",
          text: `- Повторный клик
- Быстрый клик
- Заблокированные IP
- Клик без показа
- Роботы`,
        },
        {
          term: "Клики GIVT / Клики SIVT",
          text: "IVT-клики могут быть разбиты на две составляющие: GIVT и SIVT. GIVT отражает формально определяемую невалидную активность, SIVT — более сложные и поведенчески выявляемые сценарии фрода.",
        },
        {
          term: "Повторный клик",
          text: "В Adriver не учитывается повторный клик по баннеру без повторного показа. То есть, если баннер загружен на странице и по нему кликнули один раз — клик будет засчитан. Если затем кликнули второй раз без перезагрузки баннера, то второй клик не будет учтен в статистике. Такой способ учета полностью соответствует рекомендациям IAB Click Measurement Guidelines. Чаще всего повторные клики вызваны ошибками реализации интерфейса плееров (видео) и неудачным расположением баннера на странице. Большинство повторных кликов - случайные.",
        },
        {
          term: "Быстрый клик",
          text: "Алгоритмы AdRiver проверяют временной интервал между показом и кликом. На основании проведенных исследований были проанализированы распределения кликов по времени показа, в том числе качество кликов, приводящих к конверсии на сайте рекламодателя и на основании этого были получены временные интервалы, в которых клики можно считать слишком быстрыми для человеческой активности и конверсий на сайте рекламодателя. В результате работы алгоритмов такие клики не учитываются в статистике. Кроме того, согласно принятым MRC стандартам измерений, необходим непрерывный контакт не менее 1 секунды (для баннеров) и 2 секунд (для видео), чтобы показ технически мог считаться видимым. Таким образом, клики, которые произошли ранее наступления момента видимости, чаще всего являются случайными.",
        },
        {
          term: "Роботы",
          text: "Клики от пользователей, классифицированных как боты.",
        },
        {
          term: "Заблокированные IP",
          text: "Датацентр трафик и диапазоны IP, заблокированные по причине регулярной аномальной активности, выявленного фрода, технических проблем.",
        },
        {
          term: "Клик без показа",
          text: "При обработке клика по баннеру в системе AdRiver всегда проверяется наличие соответствующего и предшествующего клику показа. Если соответствующего показа не нашлось в базе данных системы, то такой клик не будет учтен в статистику.",
        },
        {
          term: "Избыточная активность",
          text: "В случае обнаружения избыточной активности, превышающей характерную для обычного потребления контента, например, постоянная перезагрузка страницы или превышение определенного порога показов от одного пользователя или IP адреса, такие события фильтруются и не засчитываются в статистику. При этом используются разные сочетания параметров, которые позволяют анализировать активность не только в рамках определенной рекламной кампании или сайта, а также в рамках всей активности по платформе AdRiver. Принципы фильтрации событий конкретные примеры избыточной активности не разглашаются.",
        },
      ],
    },
  ];

  const adriverBenchmarks = [
    { format: "Видео", device: "Desktop", givt: "1,0%", sivt: "9,9%", viewability: "93,7%" },
    { format: "Видео", device: "Mobile", givt: "0,5%", sivt: "4,9%", viewability: "83,4%" },
    { format: "Баннер", device: "Desktop", givt: "1,4%", sivt: "7,3%", viewability: "61,4%" },
    { format: "Баннер", device: "Mobile", givt: "1,3%", sivt: "3,7%", viewability: "59,7%" },
  ];

  const arirBenchmarks = [
    { format: "Видео", device: "Desktop", givt: "2,1%", sivt: "8,3%", viewability: "89,1%" },
    { format: "Видео", device: "Mobile", givt: "1,7%", sivt: "5,9%", viewability: "79,2%" },
    { format: "Баннер", device: "Desktop", givt: "2,6%", sivt: "5,8%", viewability: "59,7%" },
    { format: "Баннер", device: "Mobile", givt: "2,6%", sivt: "3,6%", viewability: "57,9%" },
  ];
  const metricRows = [
    ...METRIC_HELP_ORDER.map((metricKey) => METRIC_HELP[metricKey]),
    ...Object.entries(METRIC_HELP)
      .filter(([metricKey]) => !METRIC_HELP_ORDER.includes(metricKey as MetricHelpKey))
      .map(([, metric]) => metric),
  ];

  return (
    <div className="space-y-3">
      <SectionTitle title="Справка" subtitle="Глоссарий и методика верификации." />

      <section className="rounded-2xl border border-sky-200 bg-gradient-to-b from-white to-sky-50/30 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-sky-800">Метрики дашборда</h3>
          <span className="rounded-full border border-sky-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
            {metricRows.length} метрик
          </span>
        </div>
        <div className="overflow-auto rounded-xl border border-sky-200 bg-white">
          <table className="min-w-[1120px] w-full border-collapse text-[12px] leading-5 text-slate-700">
            <thead className="sticky top-0 z-10">
              <tr className="bg-sky-100/70 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                <th className="w-[16%] border-b border-sky-200 px-3 py-2">Метрика</th>
                <th className="w-[30%] border-b border-sky-200 px-3 py-2">Определение</th>
                <th className="w-[24%] border-b border-sky-200 px-3 py-2">Как считаем</th>
                <th className="w-[30%] border-b border-sky-200 px-3 py-2">Интерпретация</th>
              </tr>
            </thead>
            <tbody>
              {metricRows.map((metric, index) => (
                <tr
                  key={`metric-help-${metric.title}`}
                  className={index % 2 === 0 ? "bg-white" : "bg-sky-50/35"}
                >
                  <td className="border-b border-slate-200 px-3 py-2 align-top font-semibold text-sky-800">
                    {metric.title}
                  </td>
                  <td className="whitespace-pre-line border-b border-slate-200 px-3 py-2 align-top">
                    {metric.definition}
                  </td>
                  <td className="whitespace-pre-line border-b border-slate-200 px-3 py-2 align-top font-mono text-[11px] text-slate-700">
                    {metric.formula}
                  </td>
                  <td className="whitespace-pre-line border-b border-slate-200 px-3 py-2 align-top">
                    {metric.interpretation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <section className="rounded-2xl border border-sky-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-lg font-semibold leading-none text-slate-800">Глоссарий</h3>
          <div className="max-h-[76vh] overflow-auto pr-2">
            <div className="space-y-7">
              {glossarySections.map((section) => (
                <div key={section.title}>
                  <h4 className="mb-3 text-sm font-semibold tracking-wide text-sky-800 uppercase">{section.title}</h4>
                  <div className="space-y-5">
                    {section.items.map((item) => (
                      <div
                        key={`${section.title}-${item.term}`}
                        className="grid gap-2.5 rounded-xl border border-slate-200 bg-white/80 p-3 md:grid-cols-[340px_minmax(0,1fr)]"
                      >
                        <div className="text-sm leading-tight font-semibold text-sky-800">{item.term}</div>
                        <div className="whitespace-pre-line text-[12px] leading-relaxed text-slate-700">{item.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-sky-200 bg-white p-4 shadow-sm">
          <div className="space-y-7">
            <div>
              <h3 className="mb-2 text-base font-semibold text-slate-800">Бенчмарки AdRiver</h3>
              <div className="overflow-auto rounded-xl border border-sky-200">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="border-b border-sky-300 bg-sky-100/60">
                      <th className="p-2 text-left font-semibold">Формат</th>
                      <th className="p-2 text-left font-semibold">Устройства</th>
                      <th className="p-2 text-right font-semibold">GIVT</th>
                      <th className="p-2 text-right font-semibold">SIVT</th>
                      <th className="p-2 text-right font-semibold">Видимость</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adriverBenchmarks.map((item, index) => (
                      <tr key={`adriver-${item.format}-${item.device}`} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/35"}>
                        <td className="p-2">{item.format}</td>
                        <td className="p-2">{item.device}</td>
                        <td className="p-2 text-right">{item.givt}</td>
                        <td className="p-2 text-right">{item.sivt}</td>
                        <td className="p-2 text-right">{item.viewability}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-base font-semibold text-slate-800">Бенчмарки ARIR</h3>
              <div className="overflow-auto rounded-xl border border-sky-200">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="border-b border-sky-300 bg-sky-100/60">
                      <th className="p-2 text-left font-semibold">Формат</th>
                      <th className="p-2 text-left font-semibold">Устройства</th>
                      <th className="p-2 text-right font-semibold">GIVT</th>
                      <th className="p-2 text-right font-semibold">SIVT</th>
                      <th className="p-2 text-right font-semibold">Видимость</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arirBenchmarks.map((item, index) => (
                      <tr key={`arir-${item.format}-${item.device}`} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/35"}>
                        <td className="p-2">{item.format}</td>
                        <td className="p-2">{item.device}</td>
                        <td className="p-2 text-right">{item.givt}</td>
                        <td className="p-2 text-right">{item.sivt}</td>
                        <td className="p-2 text-right">{item.viewability}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-sky-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-800">Как читать бенчмарки</h3>
        <p className="text-[12px] leading-relaxed text-slate-600">
          Для GIVT и SIVT превышение бенчмарка является негативным сигналом. Для видимости наоборот: негативным
          сигналом считается значение ниже бенчмарка.
        </p>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const section = getSectionFromPath(pathname);

  const store = useDashboardFiltersStore(
    useShallow((state) => ({
      initialized: state.initialized,
      datePreset: state.datePreset,
      dateFrom: state.dateFrom,
      dateTo: state.dateTo,
      compare: state.compare,
      grain: state.grain,
      attributionMode: state.attributionMode,
      attributionModel: state.attributionModel,
      attributionWindow: state.attributionWindow,
      campaignIds: state.campaignIds,
      placementIds: state.placementIds,
      creativeIds: state.creativeIds,
      brands: state.brands,
      advertisers: state.advertisers,
      campaignTags: state.campaignTags,
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
      exclusionsDomains: state.exclusionsDomains,
      hydrateFromUrl: state.hydrateFromUrl,
      setDatePreset: state.setDatePreset,
      setCustomDateRange: state.setCustomDateRange,
      setCompare: state.setCompare,
      setGrain: state.setGrain,
      setAttributionModel: state.setAttributionModel,
      setAttributionWindow: state.setAttributionWindow,
      setCampaignIds: state.setCampaignIds,
      setPlacementIds: state.setPlacementIds,
      setCreativeIds: state.setCreativeIds,
      setBrands: state.setBrands,
      setAdvertisers: state.setAdvertisers,
      setCampaignTags: state.setCampaignTags,
      setSuppliers: state.setSuppliers,
      setPlacementEnvironments: state.setPlacementEnvironments,
      setDomains: state.setDomains,
      setGeos: state.setGeos,
      setDeviceTypes: state.setDeviceTypes,
      setOs: state.setOs,
      setFormats: state.setFormats,
      setCookiesMode: state.setCookiesMode,
      setVerificationType: state.setVerificationType,
      addExcludedDomain: state.addExcludedDomain,
      removeExcludedDomain: state.removeExcludedDomain,
      resetFilters: state.resetFilters,
    }))
  );
  const hydrateFromUrl = store.hydrateFromUrl;
  const budgetsByPlacementId = useBudgetsStore((state) => state.budgetsByPlacementId);
  const lastUploadMeta = useBudgetsStore((state) => state.lastUploadMeta);
  const upsertBudgets = useBudgetsStore((state) => state.upsertBudgets);
  const clearBudgets = useBudgetsStore((state) => state.clearBudgets);
  const [kpiMode, setKpiMode] = useState<KpiMode>("compact");
  const [kpiReady, setKpiReady] = useState(false);
  const [isActiveFiltersOpen, setIsActiveFiltersOpen] = useState(false);

  const campaignIdsFromEntry = useMemo(
    () => parseNumberList(searchParams.get("ids")),
    [searchParams]
  );

  useEffect(() => {
    hydrateFromUrl(new URLSearchParams(searchParams.toString()), campaignIdsFromEntry);
  }, [hydrateFromUrl, searchParams, campaignIdsFromEntry]);

  useEffect(() => {
    if (!store.initialized) return;
    const fromUrl = parseKpiMode(searchParams.get("kpi"));
    let resolved = fromUrl;

    if (!resolved && typeof window !== "undefined") {
      resolved = parseKpiMode(window.localStorage.getItem(KPI_MODE_STORAGE_KEY));
    }

    setKpiMode(resolved ?? "compact");
    setKpiReady(true);
  }, [store.initialized, searchParams]);

  const periodDays = daysBetweenInclusive(store.dateFrom, store.dateTo);
  const currentGrain = store.grain;
  const setCurrentGrain = store.setGrain;

  useEffect(() => {
    if (currentGrain === "hour" && periodDays > 7) {
      setCurrentGrain("day");
    }
  }, [currentGrain, setCurrentGrain, periodDays]);

  const visibleCampaigns = useMemo(() => {
    const campaigns = listCampaigns();
    const archivedSet = new Set(getArchivedIds());
    const visible = campaigns.filter((campaign) => !archivedSet.has(campaign.id));
    return visible.length ? visible : campaigns;
  }, []);

  const campaignTagsMap = useMemo(() => getAllTagsMap(), []);

  const globalState = useMemo<GlobalFiltersState>(
    () => ({
      datePreset: store.datePreset,
      dateFrom: store.dateFrom,
      dateTo: store.dateTo,
      compare: store.compare,
      grain: store.grain,
      attributionMode: store.attributionMode,
      attributionModel: store.attributionModel,
      attributionWindow: store.attributionWindow,
      campaignIds: store.campaignIds,
      placementIds: store.placementIds,
      creativeIds: store.creativeIds,
      brands: store.brands,
      advertisers: store.advertisers,
      campaignTags: store.campaignTags,
      suppliers: store.suppliers,
      placementEnvironments: store.placementEnvironments,
      domains: store.domains,
      geos: store.geos,
      deviceTypes: store.deviceTypes,
      os: store.os,
      formats: store.formats,
      cookiesMode: store.cookiesMode,
      verificationType: store.verificationType,
      tableDimension: store.tableDimension,
      exclusionsDomains: store.exclusionsDomains,
    }),
    [
      store.datePreset,
      store.dateFrom,
      store.dateTo,
      store.compare,
      store.grain,
      store.attributionMode,
      store.attributionModel,
      store.attributionWindow,
      store.campaignIds,
      store.placementIds,
      store.creativeIds,
      store.brands,
      store.advertisers,
      store.campaignTags,
      store.suppliers,
      store.placementEnvironments,
      store.domains,
      store.geos,
      store.deviceTypes,
      store.os,
      store.formats,
      store.cookiesMode,
      store.verificationType,
      store.tableDimension,
      store.exclusionsDomains,
    ]
  );

  const serializedParams = useMemo(() => {
    const params = serializeFiltersToParams(globalState);
    params.set("kpi", kpiMode);
    return params.toString();
  }, [globalState, kpiMode]);

  useEffect(() => {
    if (!store.initialized) return;
    if (!kpiReady) return;
    if (serializedParams === searchParams.toString()) return;
    router.replace(`${pathname}?${serializedParams}`, { scroll: false });
  }, [store.initialized, kpiReady, serializedParams, searchParams, router, pathname]);

  const tagMatchedCampaignIds = useMemo(() => {
    if (!store.campaignTags.length) return null;
    const normalizedSelectedTags = store.campaignTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
    if (!normalizedSelectedTags.length) return null;

    return visibleCampaigns
      .filter((campaign) => {
        const campaignTags = (campaignTagsMap[campaign.id] || []).map((tag) => tag.trim().toLowerCase());
        return normalizedSelectedTags.every((selectedTag) =>
          campaignTags.some((campaignTag) => campaignTag.includes(selectedTag))
        );
      })
      .map((campaign) => campaign.id);
  }, [store.campaignTags, visibleCampaigns, campaignTagsMap]);

  const queryFilters = useMemo(() => {
    const baseFilters = toQueryFilters(globalState);
    if (!tagMatchedCampaignIds) return baseFilters;

    const explicitCampaignIds = baseFilters.campaignIds.length ? baseFilters.campaignIds : null;
    const nextCampaignIds = explicitCampaignIds
      ? explicitCampaignIds.filter((campaignId) => tagMatchedCampaignIds.includes(campaignId))
      : tagMatchedCampaignIds;

    return {
      ...baseFilters,
      campaignIds: nextCampaignIds.length ? nextCampaignIds : [NO_MATCH_CAMPAIGN_ID],
    };
  }, [globalState, tagMatchedCampaignIds]);

  const compareRange = useMemo(
    () => shiftPeriod(globalState.dateFrom, globalState.dateTo),
    [globalState.dateFrom, globalState.dateTo]
  );

  const compareFilters = useMemo<Filters>(
    () => ({
      ...queryFilters,
      dateFrom: compareRange.from,
      dateTo: compareRange.to,
    }),
    [queryFilters, compareRange]
  );

  const [isFiltersDrawerOpen, setIsFiltersDrawerOpen] = useState(false);

  const handleKpiModeChange = (nextMode: KpiMode) => {
    setKpiMode(nextMode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KPI_MODE_STORAGE_KEY, nextMode);
    }
  };

  const sectionQuery = serializedParams ? `?${serializedParams}` : "";

  const campaignOptions = useMemo<Option[]>(() => {
    return visibleCampaigns.map((campaign) => ({ value: String(campaign.id), label: `${campaign.id} · ${campaign.name}` }));
  }, [visibleCampaigns]);
  const campaignLabelById = useMemo(
    () => new Map(campaignOptions.map((option) => [Number(option.value), option.label])),
    [campaignOptions]
  );
  const placementOptions = useMemo<Option[]>(
    () => CATALOG.placements.map((p) => ({ value: String(p.id), label: `${p.id} · ${p.name}` })),
    []
  );
  const placementLabelById = useMemo(
    () => new Map(placementOptions.map((option) => [Number(option.value), option.label])),
    [placementOptions]
  );
  const creativeOptions = useMemo<Option[]>(
    () => CATALOG.creatives.map((c) => ({ value: String(c.id), label: `${c.id} · ${c.name}` })),
    []
  );
  const creativeLabelById = useMemo(
    () => new Map(creativeOptions.map((option) => [Number(option.value), option.label])),
    [creativeOptions]
  );
  const brandOptions = useMemo<Option[]>(
    () => CATALOG.brands.map((brand) => ({ value: brand, label: brand })),
    []
  );
  const advertiserOptions = useMemo<Option[]>(
    () => CATALOG.advertisers.map((advertiser) => ({ value: advertiser, label: advertiser })),
    []
  );
  const campaignTagOptions = useMemo<Option[]>(
    () =>
      Array.from(new Set(Object.values(campaignTagsMap).flat().map((tag) => tag.trim()).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, "ru"))
        .map((tag) => ({ value: tag, label: tag })),
    [campaignTagsMap]
  );
  const supplierOptions = useMemo<Option[]>(
    () => CATALOG.suppliers.map((supplier) => ({ value: supplier, label: supplier })),
    []
  );
  const placementEnvironmentOptions = useMemo<Option[]>(
    () => CATALOG.placementEnvironments.map((environment) => ({ value: environment, label: environment })),
    []
  );
  const domainOptions = useMemo<Option[]>(() => CATALOG.domains.map((d) => ({ value: d, label: d })), []);
  const geoOptions = useMemo<Option[]>(() => CATALOG.geos.map((g) => ({ value: g, label: g })), []);
  const deviceOptions = useMemo<Option[]>(
    () => CATALOG.deviceTypes.map((d) => ({ value: d, label: d })),
    []
  );
  const osOptions = useMemo<Option[]>(() => CATALOG.os.map((o) => ({ value: o, label: o })), []);
  const formatOptions = useMemo<Option[]>(
    () => CATALOG.formats.map((format) => ({ value: format, label: format.toUpperCase() })),
    []
  );

  const sectionsVisible = useMemo(() => SECTIONS, []);

  const applyOverviewSliceFilter = (sliceId: OverviewSliceId, series: OverviewSliceSeries) => {
    if (sliceId === "campaign") {
      store.setCampaignIds([Number(series.filterValue)]);
      return;
    }
    if (sliceId === "supplier") {
      store.setSuppliers([String(series.filterValue)]);
      return;
    }
    if (sliceId === "placement") {
      store.setPlacementIds([Number(series.filterValue)]);
      return;
    }
    if (sliceId === "placementEnvironment") {
      store.setPlacementEnvironments([String(series.filterValue)]);
      return;
    }
    if (sliceId === "creative") {
      store.setCreativeIds([Number(series.filterValue)]);
      return;
    }
    if (sliceId === "domain") {
      store.setDomains([String(series.filterValue)]);
      return;
    }
    if (sliceId === "deviceType") {
      store.setDeviceTypes([String(series.filterValue)]);
      return;
    }
    if (sliceId === "format") {
      store.setFormats([String(series.filterValue) as AdFormat]);
    }
  };

  const {
    campaignIds: selectedCampaignIds,
    setCampaignIds,
    placementIds: selectedPlacementIds,
    setPlacementIds,
    creativeIds: selectedCreativeIds,
    setCreativeIds,
    brands: selectedBrands,
    setBrands,
    advertisers: selectedAdvertisers,
    setAdvertisers,
    campaignTags: selectedCampaignTags,
    setCampaignTags,
    suppliers: selectedSuppliers,
    setSuppliers,
    placementEnvironments: selectedPlacementEnvironments,
    setPlacementEnvironments,
    domains: selectedDomains,
    setDomains,
    geos: selectedGeos,
    setGeos,
    deviceTypes: selectedDeviceTypes,
    setDeviceTypes,
    os: selectedOs,
    setOs,
    formats: selectedFormats,
    setFormats,
    attributionModel: selectedAttributionModel,
    setAttributionModel,
    attributionWindow: selectedAttributionWindow,
    setAttributionWindow,
    cookiesMode: selectedCookiesMode,
    setCookiesMode,
    verificationType: selectedVerificationType,
    setVerificationType,
  } = store;

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

    selectedCampaignIds.forEach((id) => {
      chips.push({
        key: `campaign-${id}`,
        label: `Кампания: ${campaignLabelById.get(id) ?? id}`,
        onRemove: () => setCampaignIds(selectedCampaignIds.filter((item) => item !== id)),
      });
    });
    selectedPlacementIds.forEach((id) => {
      chips.push({
        key: `placement-${id}`,
        label: `Размещение: ${placementLabelById.get(id) ?? id}`,
        onRemove: () => setPlacementIds(selectedPlacementIds.filter((item) => item !== id)),
      });
    });
    selectedCreativeIds.forEach((id) => {
      chips.push({
        key: `creative-${id}`,
        label: `Креатив: ${creativeLabelById.get(id) ?? id}`,
        onRemove: () => setCreativeIds(selectedCreativeIds.filter((item) => item !== id)),
      });
    });
    selectedBrands.forEach((value) => {
      chips.push({
        key: `brand-${value}`,
        label: `Бренд: ${value}`,
        onRemove: () => setBrands(selectedBrands.filter((item) => item !== value)),
      });
    });
    selectedAdvertisers.forEach((value) => {
      chips.push({
        key: `advertiser-${value}`,
        label: `Рекламодатель: ${value}`,
        onRemove: () => setAdvertisers(selectedAdvertisers.filter((item) => item !== value)),
      });
    });
    selectedCampaignTags.forEach((value) => {
      chips.push({
        key: `tag-${value}`,
        label: `Тег: ${value}`,
        onRemove: () => setCampaignTags(selectedCampaignTags.filter((item) => item !== value)),
      });
    });
    selectedSuppliers.forEach((value) => {
      chips.push({
        key: `supplier-${value}`,
        label: `Поставщик: ${value}`,
        onRemove: () => setSuppliers(selectedSuppliers.filter((item) => item !== value)),
      });
    });
    selectedPlacementEnvironments.forEach((value) => {
      chips.push({
        key: `environment-${value}`,
        label: `Среда: ${value}`,
        onRemove: () => setPlacementEnvironments(selectedPlacementEnvironments.filter((item) => item !== value)),
      });
    });
    selectedDomains.forEach((value) => {
      chips.push({
        key: `domain-${value}`,
        label: `Домен: ${value}`,
        onRemove: () => setDomains(selectedDomains.filter((item) => item !== value)),
      });
    });
    selectedGeos.forEach((value) => {
      chips.push({
        key: `geo-${value}`,
        label: `Гео: ${value}`,
        onRemove: () => setGeos(selectedGeos.filter((item) => item !== value)),
      });
    });
    selectedDeviceTypes.forEach((value) => {
      chips.push({
        key: `device-${value}`,
        label: `Устройство: ${value}`,
        onRemove: () => setDeviceTypes(selectedDeviceTypes.filter((item) => item !== value)),
      });
    });
    selectedOs.forEach((value) => {
      chips.push({
        key: `os-${value}`,
        label: `ОС: ${value}`,
        onRemove: () => setOs(selectedOs.filter((item) => item !== value)),
      });
    });
    selectedFormats.forEach((value) => {
      chips.push({
        key: `format-${value}`,
        label: `Формат: ${String(value).toUpperCase()}`,
        onRemove: () => setFormats(selectedFormats.filter((item) => item !== value)),
      });
    });

    if (selectedAttributionModel !== "last_touch") {
      const option = ATTRIBUTION_MODEL_OPTIONS.find((item) => item.value === selectedAttributionModel);
      chips.push({
        key: "attr-model",
        label: `Модель: ${option?.label ?? selectedAttributionModel}`,
        onRemove: () => setAttributionModel("last_touch"),
      });
    }
    if (selectedAttributionWindow !== 90) {
      const option = ATTRIBUTION_WINDOW_OPTIONS.find((item) => item.value === selectedAttributionWindow);
      chips.push({
        key: "attr-window",
        label: `Окно: ${option?.label ?? `${selectedAttributionWindow}`}`,
        onRemove: () => setAttributionWindow(90),
      });
    }
    if (selectedCookiesMode !== "all") {
      const option = COOKIES_MODE_OPTIONS.find((item) => item.value === selectedCookiesMode);
      chips.push({
        key: "cookies",
        label: option?.label ?? `Cookies: ${selectedCookiesMode}`,
        onRemove: () => setCookiesMode("all"),
      });
    }
    if (selectedVerificationType !== "all") {
      const option = VERIFICATION_TYPE_OPTIONS.find((item) => item.value === selectedVerificationType);
      chips.push({
        key: "verification",
        label: `Верификация: ${option?.label ?? selectedVerificationType}`,
        onRemove: () => setVerificationType("all"),
      });
    }

    return chips;
  }, [
    campaignLabelById,
    selectedCampaignIds,
    setCampaignIds,
    creativeLabelById,
    selectedCreativeIds,
    setCreativeIds,
    placementLabelById,
    selectedPlacementIds,
    setPlacementIds,
    selectedBrands,
    setBrands,
    selectedAdvertisers,
    setAdvertisers,
    selectedCampaignTags,
    setCampaignTags,
    selectedSuppliers,
    setSuppliers,
    selectedPlacementEnvironments,
    setPlacementEnvironments,
    selectedDomains,
    setDomains,
    selectedGeos,
    setGeos,
    selectedDeviceTypes,
    setDeviceTypes,
    selectedOs,
    setOs,
    selectedFormats,
    setFormats,
    selectedAttributionModel,
    setAttributionModel,
    selectedAttributionWindow,
    setAttributionWindow,
    selectedCookiesMode,
    setCookiesMode,
    selectedVerificationType,
    setVerificationType,
  ]);

  const activeDetailedFiltersCount = useMemo(
    () =>
      [
        store.campaignIds.length,
        store.placementIds.length,
        store.creativeIds.length,
        store.brands.length,
        store.advertisers.length,
        store.campaignTags.length,
        store.suppliers.length,
        store.placementEnvironments.length,
        store.domains.length,
        store.geos.length,
        store.deviceTypes.length,
        store.os.length,
        store.formats.length,
        store.attributionModel !== "last_touch" ? 1 : 0,
        store.attributionWindow !== 90 ? 1 : 0,
        store.cookiesMode !== "all" ? 1 : 0,
        store.verificationType !== "all" ? 1 : 0,
      ].filter((count) => count > 0).length,
    [
      store.campaignIds.length,
      store.placementIds.length,
      store.creativeIds.length,
      store.brands.length,
      store.advertisers.length,
      store.campaignTags.length,
      store.suppliers.length,
      store.placementEnvironments.length,
      store.domains.length,
      store.geos.length,
      store.deviceTypes.length,
      store.os.length,
      store.formats.length,
      store.attributionModel,
      store.attributionWindow,
      store.cookiesMode,
      store.verificationType,
    ]
  );
  if (!store.initialized) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-[1440px] px-6 py-4">
          <FiltersSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 px-3 py-3 sm:px-6 sm:py-4 md:flex-row">
      <aside className="flex w-full shrink-0 items-center gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 md:block md:w-20 md:overflow-visible">
        <nav className="flex flex-row items-center gap-2 md:flex-col">
          {sectionsVisible.map((item) => {
            const active = section === item.id;
            return (
              <div key={item.id} className="group relative">
                <Link
                  href={`/dashboard/${item.id}${sectionQuery}`}
                  aria-label={item.label}
                  title={item.label}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                    active
                      ? "border-sky-600 bg-sky-600 text-white shadow-sm"
                      : "border-slate-200 text-slate-500 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                  }`}
                >
                  <SectionIcon sectionId={item.id} />
                </Link>
                <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm group-hover:block group-focus-within:block">
                  {item.label}
                </span>
              </div>
            );
          })}
        </nav>

        <div className="h-8 w-px shrink-0 bg-slate-200 md:my-3 md:h-px md:w-auto" />

        <div className="flex flex-row items-center gap-2 md:flex-col">
          <div className="group relative">
            <Link
              href="/campaigns"
              aria-label="К кампаниям"
              title="К кампаниям"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
            <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm group-hover:block group-focus-within:block">
              К кампаниям
            </span>
          </div>

          <div className="group relative">
            <Link
              href={`/builder?ids=${store.campaignIds.join(",")}`}
              aria-label="Открыть конструктор"
              title="Открыть конструктор"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
            >
              <BuilderIcon className="h-4 w-4" />
            </Link>
            <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm group-hover:block group-focus-within:block">
              Открыть конструктор
            </span>
          </div>
        </div>
      </aside>

      <main className="w-full min-w-0 flex-1 space-y-4">
        <header className="rounded-xl border border-sky-200 bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex h-9 max-w-full items-center overflow-x-auto rounded-full border border-slate-200 bg-slate-50 p-0.5">
              {([
                ["today", "Сегодня"],
                ["7d", "7 дней"],
                ["30d", "30 дней"],
                ["custom", "Custom"],
              ] as const).map(([preset, label]) => (
                <button
                  key={preset}
                  onClick={() => store.setDatePreset(preset)}
                  className={`h-8 rounded-full px-3 text-xs font-medium transition ${
                    store.datePreset === preset
                      ? "bg-sky-600 text-white"
                      : "text-slate-700 hover:bg-white hover:text-sky-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex min-h-9 max-w-full flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1 sm:h-9 sm:flex-nowrap sm:rounded-full sm:py-0">
              <CalendarIcon className="h-4 w-4 text-slate-500" />
              <input
                type="date"
                value={store.dateFrom}
                onChange={(e) => store.setCustomDateRange(e.target.value, store.dateTo)}
                className="w-[112px] bg-transparent text-xs text-slate-700 outline-none sm:w-[120px]"
              />
              <span className="text-xs text-slate-400">—</span>
              <input
                type="date"
                value={store.dateTo}
                onChange={(e) => store.setCustomDateRange(store.dateFrom, e.target.value)}
                className="w-[112px] bg-transparent text-xs text-slate-700 outline-none sm:w-[120px]"
              />
            </div>

            <label className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 sm:h-9 sm:py-0">
              <input
                type="checkbox"
                checked={store.compare}
                onChange={(e) => store.setCompare(e.target.checked)}
              />
              <span className="inline-flex items-center gap-1">
                <span>Сравнить с прошлым периодом</span>
                <CompareHelpTooltip />
              </span>
            </label>

            <select
              value={store.grain}
              onChange={(e) => store.setGrain(e.target.value as "day" | "hour")}
              className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700"
              title={periodDays > 7 ? "hour доступен только при периоде <= 7 дней" : "Grain"}
            >
              <option value="day">день</option>
              <option value="hour" disabled={periodDays > 7}>
                час
              </option>
            </select>

            <button
              type="button"
              onClick={() => setIsFiltersDrawerOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <FilterIcon className="h-4 w-4" />
              <span>Фильтр</span>
              <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-600">
                {activeDetailedFiltersCount}
              </span>
            </button>

            {activeFilterChips.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsActiveFiltersOpen((value) => !value)}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <span>Активные: {activeFilterChips.length}</span>
                </button>
                {isActiveFiltersOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-10 cursor-default"
                      onClick={() => setIsActiveFiltersOpen(false)}
                      aria-label="Закрыть список активных фильтров"
                    />
                    <div className="absolute right-0 top-11 z-20 w-[320px] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold text-slate-900">Активные фильтры</div>
                          <div className="text-[11px] text-slate-500">{activeFilterChips.length} шт.</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            store.resetFilters();
                            setIsActiveFiltersOpen(false);
                          }}
                          className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
                        >
                          Сбросить всё
                        </button>
                      </div>
                      <div className="max-h-[260px] space-y-1 overflow-y-auto">
                        {activeFilterChips.map((chip) => (
                          <div
                            key={chip.key}
                            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                          >
                            <span className="min-w-0 flex-1 truncate text-[12px] text-slate-700">{chip.label}</span>
                            <button
                              type="button"
                              onClick={() => {
                                chip.onRemove();
                              }}
                              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                              aria-label={`Убрать фильтр ${chip.label}`}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <button
              onClick={() => {
                store.resetFilters();
                setIsActiveFiltersOpen(false);
              }}
              className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Сброс фильтров
            </button>
          </div>
        </header>

        {section === "overview" && (
          <OverviewSection
            filters={queryFilters}
            attributionMode={store.attributionMode}
            kpiMode={kpiMode}
            onKpiModeChange={handleKpiModeChange}
            onApplySliceFilter={applyOverviewSliceFilter}
            compare={store.compare}
            compareFilters={compareFilters}
            grain={store.grain}
            periodDays={periodDays}
          />
        )}

        {section === "performance" && (
          <PerformanceSection
            filters={queryFilters}
            tableDimension={store.tableDimension}
            budgetsByPlacementId={budgetsByPlacementId}
          />
        )}

        {section === "verification" && (
          <VerificationSection
            filters={queryFilters}
            grain={store.grain}
            excludedDomains={store.exclusionsDomains}
            onAddExclusion={store.addExcludedDomain}
            onRemoveExclusion={store.removeExcludedDomain}
          />
        )}

        {section === "video" && (
          <VideoSection filters={queryFilters} grain={store.grain} onResetFilters={store.resetFilters} />
        )}

        {section === "conversions" && (
          <ConversionsSection
            filters={queryFilters}
            grain={store.grain}
          />
        )}

        {section === "exports" && (
          <ExportsSection
            filters={queryFilters}
            budgetsByPlacementId={budgetsByPlacementId}
            lastUploadMeta={lastUploadMeta}
            onUpsertBudgets={upsertBudgets}
            onClearBudgets={clearBudgets}
          />
        )}

        {section === "help" && <HelpSection />}
      </main>

      {isFiltersDrawerOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/25"
            onClick={() => setIsFiltersDrawerOpen(false)}
            aria-label="Закрыть фильтр"
          />

          <aside className="absolute right-0 top-0 h-full w-full max-w-[860px] bg-white shadow-2xl">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-900">Фильтр</h2>
                <button
                  type="button"
                  onClick={store.resetFilters}
                  className="h-9 rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Сброс
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                <div className="grid gap-3 md:grid-cols-2">
                  <SingleSelectFilter
                    label="Модель атрибуции"
                    value={store.attributionModel}
                    options={ATTRIBUTION_MODEL_OPTIONS}
                    onChange={(value) => store.setAttributionModel(value as AttributionModel)}
                    className="relative w-full min-w-0"
                  />
                  <SingleSelectFilter
                    label="Окно атрибуции"
                    value={String(store.attributionWindow)}
                    options={ATTRIBUTION_WINDOW_OPTIONS.map((option) => ({
                      value: String(option.value),
                      label: option.label,
                    }))}
                    onChange={(value) => store.setAttributionWindow(Number(value) as AttributionWindow)}
                    className="relative w-full min-w-0"
                  />
                  <SingleSelectFilter
                    label="Cookies"
                    value={store.cookiesMode}
                    options={COOKIES_MODE_OPTIONS}
                    onChange={(value) => store.setCookiesMode(value as CookiesMode)}
                    className="relative w-full min-w-0"
                  />
                  <SingleSelectFilter
                    label="Тип верификации"
                    value={store.verificationType}
                    options={VERIFICATION_TYPE_OPTIONS}
                    onChange={(value) => store.setVerificationType(value as VerificationType)}
                    className="relative w-full min-w-0"
                  />
                  <MultiSelectFilter
                    label="Кампании"
                    options={campaignOptions}
                    selected={store.campaignIds.map(String)}
                    onChange={(vals) => store.setCampaignIds(vals.map(Number).filter(Number.isFinite))}
                    className="relative w-full min-w-0"
                  />
                  <MultiSelectFilter
                    label="Бренд"
                    options={brandOptions}
                    selected={store.brands}
                    onChange={store.setBrands}
                    className="relative w-full min-w-0"
                  />
                  <MultiSelectFilter
                    label="Рекламодатель"
                    options={advertiserOptions}
                    selected={store.advertisers}
                    onChange={store.setAdvertisers}
                    className="relative w-full min-w-0"
                  />
                  <MultiSelectFilter
                    label="Тег рекламной кампании"
                    options={campaignTagOptions}
                    selected={store.campaignTags}
                    onChange={store.setCampaignTags}
                    className="relative w-full min-w-0"
                  />
                  <MultiSelectFilter
                    label="Размещения"
                    options={placementOptions}
                    selected={store.placementIds.map(String)}
                    onChange={(vals) => store.setPlacementIds(vals.map(Number).filter(Number.isFinite))}
                    className="relative w-full min-w-0"
                  />
                  <MultiSelectFilter
                    label="Креативы"
                    options={creativeOptions}
                    selected={store.creativeIds.map(String)}
                    onChange={(vals) => store.setCreativeIds(vals.map(Number).filter(Number.isFinite))}
                    className="relative w-full min-w-0"
                  />
                  <MultiSelectFilter
                    label="Поставщики"
                    options={supplierOptions}
                    selected={store.suppliers}
                    onChange={store.setSuppliers}
                    className="relative w-full min-w-0"
                  />
                  <MultiSelectFilter
                    label="Среды размещения"
                    options={placementEnvironmentOptions}
                    selected={store.placementEnvironments}
                    onChange={store.setPlacementEnvironments}
                    className="relative w-full min-w-0"
                  />
                  <MultiSelectFilter
                    label="Домены"
                    options={domainOptions}
                    selected={store.domains}
                    onChange={store.setDomains}
                    className="relative w-full min-w-0"
                  />
                  <MultiSelectFilter
                    label="Формат"
                    options={formatOptions}
                    selected={store.formats}
                    onChange={(vals) => store.setFormats(vals as AdFormat[])}
                    className="relative w-full min-w-0"
                  />
                  <MultiSelectFilter
                    label="Гео"
                    options={geoOptions}
                    selected={store.geos}
                    onChange={store.setGeos}
                    className="relative w-full min-w-0"
                  />
                  <MultiSelectFilter
                    label="Устройства"
                    options={deviceOptions}
                    selected={store.deviceTypes}
                    onChange={store.setDeviceTypes}
                    className="relative w-full min-w-0"
                  />
                  <MultiSelectFilter
                    label="ОС"
                    options={osOptions}
                    selected={store.os}
                    onChange={store.setOs}
                    className="relative w-full min-w-0"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setIsFiltersDrawerOpen(false)}
                  className="h-9 rounded-full border border-slate-200 px-4 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Закрыть
                </button>
                <button
                  type="button"
                  onClick={() => setIsFiltersDrawerOpen(false)}
                  className="h-9 rounded-full bg-sky-600 px-4 text-sm text-white hover:bg-sky-700"
                >
                  Применить
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
    </div>
  );
}
