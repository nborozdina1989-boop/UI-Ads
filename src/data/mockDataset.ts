import type { AdFormat, DatasetRow } from "@/query/types";
import { getArchivedIds } from "@/lib/archfav";
import { listCampaigns, type Campaign as ListCampaign } from "@/lib/campaigns";

type CampaignEntity = {
  id: number;
  name: string;
  advertiser: string;
  brand: string;
  client: string;
  supplier: string;
  weight: number;
  videoShare: number;
  convLift: number;
};

type PlacementEntity = {
  id: number;
  campaignId: number;
  name: string;
};

type CreativeEntity = {
  id: number;
  placementId: number;
  campaignId: number;
  name: string;
};

type DomainProfile = {
  name: string;
  share: number;
  ivtBase: number;
  safetyBase: number;
  ctrAdj: number;
};

type GeoProfile = {
  name: string;
  share: number;
};

type DeviceProfile = {
  name: string;
  share: number;
  ctrAdj: number;
  ivtAdj: number;
  osMix: Array<{ name: string; share: number }>;
};

type SupplierProfile = {
  name: string;
  share: number;
  videoBias: number;
  ctrAdj: number;
  ivtAdj: number;
  viewabilityAdj: number;
  cpmAdj: number;
};

const CLIENT_POOL = [
  "Media Instinct",
  "Group4Media",
  "OMD OM Group",
  "NMi Group",
  "Игроник",
  "Realweb",
  "Артикс",
] as const;

const SUPPLIER_PROFILES: SupplierProfile[] = [
  { name: "Яндекс", share: 1.45, videoBias: 0.05, ctrAdj: 0.00025, ivtAdj: -0.002, viewabilityAdj: 0.01, cpmAdj: 12 },
  { name: "VK Реклама", share: 1.2, videoBias: 0.12, ctrAdj: 0.00018, ivtAdj: -0.001, viewabilityAdj: 0.006, cpmAdj: 9 },
  { name: "Digital Alliance", share: 0.92, videoBias: 0.34, ctrAdj: 0.0001, ivtAdj: -0.003, viewabilityAdj: 0.024, cpmAdj: 28 },
  { name: "Hybrid", share: 0.86, videoBias: 0.18, ctrAdj: 0.00008, ivtAdj: 0.002, viewabilityAdj: 0.004, cpmAdj: 6 },
  { name: "Between Exchange", share: 0.74, videoBias: 0.22, ctrAdj: 0.00006, ivtAdj: 0.001, viewabilityAdj: 0.008, cpmAdj: 11 },
  { name: "Soloway", share: 0.72, videoBias: 0.16, ctrAdj: 0.00003, ivtAdj: 0.003, viewabilityAdj: 0.003, cpmAdj: 4 },
  { name: "Getintent", share: 0.66, videoBias: 0.1, ctrAdj: 0.00004, ivtAdj: 0.002, viewabilityAdj: 0.002, cpmAdj: 3 },
  { name: "MediaSniper", share: 0.58, videoBias: 0.14, ctrAdj: 0.00007, ivtAdj: 0.001, viewabilityAdj: 0.005, cpmAdj: 5 },
  { name: "Segmento", share: 0.56, videoBias: 0.08, ctrAdj: 0.00002, ivtAdj: 0.002, viewabilityAdj: -0.002, cpmAdj: 2 },
  { name: "myTarget", share: 0.54, videoBias: 0.11, ctrAdj: 0.00011, ivtAdj: 0.001, viewabilityAdj: 0.004, cpmAdj: 7 },
  { name: "Buzzoola", share: 0.5, videoBias: -0.04, ctrAdj: -0.00005, ivtAdj: 0.004, viewabilityAdj: -0.006, cpmAdj: -4 },
  { name: "SberAds", share: 0.49, videoBias: 0.09, ctrAdj: 0.00005, ivtAdj: 0.001, viewabilityAdj: 0.003, cpmAdj: 6 },
  { name: "Relap", share: 0.46, videoBias: -0.08, ctrAdj: -0.00003, ivtAdj: 0.003, viewabilityAdj: -0.004, cpmAdj: -2 },
  { name: "МТС Ads", share: 0.44, videoBias: 0.07, ctrAdj: 0.00003, ivtAdj: 0.002, viewabilityAdj: 0.001, cpmAdj: 4 },
  { name: "Adwile", share: 0.42, videoBias: -0.1, ctrAdj: -0.00006, ivtAdj: 0.004, viewabilityAdj: -0.007, cpmAdj: -5 },
  { name: "Aitarget One", share: 0.4, videoBias: 0.13, ctrAdj: 0.00006, ivtAdj: 0.001, viewabilityAdj: 0.002, cpmAdj: 5 },
  { name: "Redllama", share: 0.36, videoBias: 0.05, ctrAdj: -0.00001, ivtAdj: 0.003, viewabilityAdj: -0.001, cpmAdj: 1 },
] as const;

function seededUnit(seed: number): number {
  let x = Math.imul(seed ^ 0x9e3779b1, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return x / 0xffffffff;
}

function getDashboardCampaignSource(): ListCampaign[] {
  const all = listCampaigns();
  if (typeof window === "undefined") return all;
  const archived = new Set(getArchivedIds());
  const active = all.filter((campaign) => !archived.has(campaign.id));
  return active.length ? active : all;
}

function mapCampaignsToEntities(campaigns: ListCampaign[]): CampaignEntity[] {
  return campaigns.map((campaign, idx) => {
    const seed = campaign.id + idx * 17;
    const statusK = campaign.status === "Активна" ? 1 : 0.5;
    const delegatedK = campaign.type === "Делегированная" ? 0.88 : 1.04;
    const videoShare = clamp(0.06 + seededUnit(seed + 53) * 0.72, 0, 0.86);
    const supplier = weightedPick(
      SUPPLIER_PROFILES,
      SUPPLIER_PROFILES.map((profile) => profile.share + videoShare * profile.videoBias),
      () => seededUnit(seed + 29)
    ).name;
    return {
      id: campaign.id,
      name: campaign.name,
      advertiser: campaign.advertiser,
      brand: campaign.brand,
      client: CLIENT_POOL[Math.floor(seededUnit(seed + 11) * CLIENT_POOL.length)] ?? CLIENT_POOL[0],
      supplier,
      weight: 0.8 + seededUnit(seed + 41) * 1.4 * statusK * delegatedK,
      videoShare,
      convLift: clamp(0.82 + seededUnit(seed + 67) * 0.62, 0.72, 1.55),
    };
  });
}

const CAMPAIGNS: CampaignEntity[] = mapCampaignsToEntities(getDashboardCampaignSource());

const DOMAIN_NAMES = [
  "yandex.ru",
  "dzen.ru",
  "rbc.ru",
  "lenta.ru",
  "gazeta.ru",
  "kp.ru",
  "ria.ru",
  "mk.ru",
  "iz.ru",
  "vedomosti.ru",
  "sport-express.ru",
  "championat.com",
  "auto.ru",
  "drom.ru",
  "avito.ru",
  "cian.ru",
  "hh.ru",
  "vc.ru",
  "habr.com",
  "4pda.to",
  "woman.ru",
  "wday.ru",
  "deti.mail.ru",
  "afisha.ru",
  "ivi.ru",
  "okko.tv",
  "kinopoisk.ru",
  "rutube.ru",
  "vk.com",
  "mail.ru",
  "news.mail.ru",
  "weather.mail.ru",
  "drive2.ru",
  "banki.ru",
  "sravni.ru",
  "forbes.ru",
  "kommersant.ru",
  "the-village.ru",
  "fontanka.ru",
  "ngs.ru",
  "e1.ru",
  "74.ru",
  "161.ru",
  "v1.ru",
  "sports.ru",
  "riafan.ru",
  "life.ru",
  "ren.tv",
  "aif.ru",
  "vm.ru",
  "mvideo.ru",
  "eldorado.ru",
  "citilink.ru",
  "sberbank.com",
  "tbank.ru",
  "ozon.ru",
  "wildberries.ru",
];

const GEO_NAMES = [
  "Москва",
  "Санкт-Петербург",
  "Новосибирск",
  "Екатеринбург",
  "Казань",
  "Нижний Новгород",
  "Челябинск",
  "Самара",
  "Омск",
  "Ростов-на-Дону",
  "Уфа",
  "Красноярск",
  "Воронеж",
  "Пермь",
  "Волгоград",
  "Краснодар",
  "Саратов",
  "Тюмень",
  "Тольятти",
  "Ижевск",
  "Барнаул",
  "Ульяновск",
  "Иркутск",
  "Хабаровск",
  "Владивосток",
  "Ярославль",
  "Томск",
  "Рязань",
  "Пенза",
  "Калининград",
  "Алматы",
  "Минск",
  "Астана",
  "Бишкек",
  "Ташкент",
];

const DEVICE_PROFILES: DeviceProfile[] = [
  {
    name: "Desktop",
    share: 0.31,
    ctrAdj: 0.0003,
    ivtAdj: -0.002,
    osMix: [
      { name: "Windows", share: 0.72 },
      { name: "macOS", share: 0.19 },
      { name: "Linux", share: 0.09 },
    ],
  },
  {
    name: "Mobile",
    share: 0.53,
    ctrAdj: 0.0008,
    ivtAdj: 0.003,
    osMix: [
      { name: "Android", share: 0.73 },
      { name: "iOS", share: 0.24 },
      { name: "HarmonyOS", share: 0.03 },
    ],
  },
  {
    name: "Tablet",
    share: 0.1,
    ctrAdj: 0.0002,
    ivtAdj: 0.001,
    osMix: [
      { name: "Android", share: 0.58 },
      { name: "iOS", share: 0.37 },
      { name: "Windows", share: 0.05 },
    ],
  },
  {
    name: "CTV",
    share: 0.06,
    ctrAdj: -0.00025,
    ivtAdj: -0.001,
    osMix: [
      { name: "Android TV", share: 0.62 },
      { name: "tvOS", share: 0.22 },
      { name: "Tizen", share: 0.16 },
    ],
  },
];

const VERIFICATION_TYPES = [
  "basic_audit",
  "ivt_adserving",
  "full_verification",
  "click_audit",
] as const;

export const QUALITY_BENCHMARKS = {
  display: {
    Desktop: { givtRate: 0.018, sivtRate: 0.012, viewabilityRate: 0.62 },
    Mobile: { givtRate: 0.023, sivtRate: 0.017, viewabilityRate: 0.57 },
  },
  video: {
    Desktop: { givtRate: 0.016, sivtRate: 0.011, viewabilityRate: 0.71 },
    Mobile: { givtRate: 0.021, sivtRate: 0.015, viewabilityRate: 0.66 },
  },
} as const;

function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let s = Math.imul(t ^ (t >>> 15), 1 | t);
    s ^= s + Math.imul(s ^ (s >>> 7), 61 | s);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function lastNDays(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(formatDate(d));
  }
  return out;
}

function weightedPick<T>(arr: T[], weights: number[], rnd: () => number): T {
  const sum = weights.reduce((acc, x) => acc + x, 0);
  const point = rnd() * sum;
  let acc = 0;
  for (let i = 0; i < arr.length; i += 1) {
    acc += weights[i];
    if (point <= acc) return arr[i];
  }
  return arr[arr.length - 1];
}

function makeDomainProfiles(rnd: () => number): DomainProfile[] {
  const n = DOMAIN_NAMES.length;
  return DOMAIN_NAMES.map((name, idx) => {
    const rank = idx / (n - 1);
    const share = 1 / (1 + idx * 0.5);
    const ivtBase = clamp(0.008 + rank * 0.08 + rnd() * 0.03, 0.005, 0.15);
    const safetyBase = clamp(0.992 - rank * 0.08 - rnd() * 0.04, 0.85, 0.995);
    const ctrAdj = clamp(0.0015 - rank * 0.0025 + (rnd() - 0.5) * 0.0008, -0.0015, 0.0018);
    return { name, share, ivtBase, safetyBase, ctrAdj };
  });
}

function makeGeoProfiles(rnd: () => number): GeoProfile[] {
  return GEO_NAMES.map((name, idx) => ({
    name,
    share: 1 / (1 + idx * 0.12) + rnd() * 0.15,
  }));
}

function buildHierarchy(): {
  placements: PlacementEntity[];
  creatives: CreativeEntity[];
} {
  const placements: PlacementEntity[] = [];
  const creatives: CreativeEntity[] = [];

  let placementId = 50000;
  let creativeId = 80000;

  CAMPAIGNS.forEach((campaign, campaignIndex) => {
    const placementCount = 1 + ((campaign.id + campaignIndex) % 2);
    for (let p = 0; p < placementCount; p += 1) {
      const pId = placementId;
      placementId += 1;
      placements.push({
        id: pId,
        campaignId: campaign.id,
        name: `PL-${campaign.id}-${p + 1}`,
      });

      const creativesCount = 1 + ((campaign.id + p) % 2);
      for (let c = 0; c < creativesCount; c += 1) {
        creatives.push({
          id: creativeId,
          campaignId: campaign.id,
          placementId: pId,
          name: `CR-${campaign.id}-${p + 1}-${c + 1}`,
        });
        creativeId += 1;
      }
    }
  });

  return { placements, creatives };
}

function hourWeights(): number[] {
  // Пиковые часы 10-13 и 18-22
  return Array.from({ length: 24 }, (_, h) => {
    if (h >= 10 && h <= 13) return 1.8;
    if (h >= 18 && h <= 22) return 2.2;
    if (h >= 0 && h <= 5) return 0.4;
    return 1.0;
  });
}

function pickFormat(campaign: CampaignEntity, rndFn: () => number): AdFormat {
  const nativeShare = 0.12;
  const audioShare = 0.06;
  const videoShare = clamp(campaign.videoShare, 0, 0.86);
  const displayShare = Math.max(0.01, 1 - videoShare - nativeShare - audioShare);
  const total = displayShare + videoShare + nativeShare + audioShare;
  const point = rndFn() * total;

  if (point < displayShare) return "display";
  if (point < displayShare + videoShare) return "video";
  if (point < displayShare + videoShare + nativeShare) return "native";
  return "audio";
}

function pickVerificationType(format: AdFormat, rndFn: () => number): (typeof VERIFICATION_TYPES)[number] {
  const point = rndFn();
  if (format === "video") {
    if (point < 0.22) return "basic_audit";
    if (point < 0.54) return "ivt_adserving";
    if (point < 0.86) return "full_verification";
    return "click_audit";
  }
  if (point < 0.28) return "basic_audit";
  if (point < 0.57) return "ivt_adserving";
  if (point < 0.89) return "full_verification";
  return "click_audit";
}

const rnd = mulberry32(42_2026);
const domainProfiles = makeDomainProfiles(rnd);
const geoProfiles = makeGeoProfiles(rnd);
const hierarchy = buildHierarchy();
const hourMix = hourWeights();
const PLACEMENT_ENVIRONMENTS = ["In-app", "Web Mobile", "Web Webview", "Web Прочее"] as const;
const supplierProfileByName = new Map(SUPPLIER_PROFILES.map((profile) => [profile.name, profile]));

const PLACEMENT_TEMPLATES: Record<AdFormat, string[]> = {
  display: ["ROS Desktop 300x250", "Главная 970x250", "Sidebar 300x600", "Mobile banner 320x50"],
  video: ["In-stream pre-roll", "Out-stream in-read", "OLV mid-roll", "Rewarded video"],
  native: ["Native feed card", "Native article card", "Recommendation widget", "In-feed native"],
  audio: ["Audio preroll 15s", "Audio midroll 20s", "Podcast preroll", "Streaming audio 30s"],
};

const CREATIVE_TEMPLATES: Record<AdFormat, string[]> = {
  display: ["HTML5 banner", "KV resize", "Promo banner", "Retail offer banner"],
  video: ["Video 10s", "Video 15s", "Video 20s", "Cutdown 6s"],
  native: ["Native card", "Article teaser", "Feed tile", "Product native"],
  audio: ["Audio 10s", "Audio 15s", "Audio 20s", "Audio CTA"],
};

function getPlacementEnvironmentWeights(campaign: CampaignEntity, placementId: number): number[] {
  const seed = placementId * 97 + campaign.id * 13;
  const mobileBias = seededUnit(seed + 11);
  const webviewBias = seededUnit(seed + 29);
  const miscBias = seededUnit(seed + 47);
  const videoBias = clamp(campaign.videoShare, 0, 0.86);

  return [
    0.14 + videoBias * 0.88 + (1 - mobileBias) * 0.12,
    0.26 + mobileBias * 0.44,
    0.14 + webviewBias * 0.32,
    0.18 + miscBias * 0.28 + (1 - videoBias) * 0.2,
  ];
}

function pickPlacementEnvironment(campaign: CampaignEntity, placementId: number): (typeof PLACEMENT_ENVIRONMENTS)[number] {
  const seed = placementId * 131 + campaign.id * 17;
  return weightedPick(
    [...PLACEMENT_ENVIRONMENTS],
    getPlacementEnvironmentWeights(campaign, placementId),
    () => seededUnit(seed)
  );
}

function getPlacementFormatWeights(campaign: CampaignEntity, placementId: number): number[] {
  const seed = placementId * 83 + campaign.id * 19;
  const videoShare = clamp(campaign.videoShare, 0, 0.86);
  const nativeBias = seededUnit(seed + 7);
  const audioBias = seededUnit(seed + 17);

  return [
    Math.max(0.08, 1.12 - videoShare - nativeBias * 0.2),
    0.12 + videoShare * 1.45,
    0.08 + nativeBias * 0.28,
    0.04 + audioBias * 0.14,
  ];
}

function pickPlacementFormat(campaign: CampaignEntity, placementId: number): AdFormat {
  const seed = placementId * 149 + campaign.id * 23;
  return weightedPick<AdFormat>(
    ["display", "video", "native", "audio"],
    getPlacementFormatWeights(campaign, placementId),
    () => seededUnit(seed)
  );
}

const placementsByCampaign = CAMPAIGNS.reduce<Record<number, PlacementEntity[]>>((acc, campaign) => {
  acc[campaign.id] = hierarchy.placements.filter((p) => p.campaignId === campaign.id);
  return acc;
}, {});

const campaignById = new Map(CAMPAIGNS.map((campaign) => [campaign.id, campaign]));
const placementFormatByPlacementId = hierarchy.placements.reduce<Record<number, AdFormat>>((acc, placement) => {
  const campaign = campaignById.get(placement.campaignId);
  if (campaign) {
    acc[placement.id] = pickPlacementFormat(campaign, placement.id);
  }
  return acc;
}, {});

const placementEnvironmentByPlacementId = hierarchy.placements.reduce<Record<number, (typeof PLACEMENT_ENVIRONMENTS)[number]>>(
  (acc, placement) => {
    const campaign = campaignById.get(placement.campaignId);
    if (campaign) {
      acc[placement.id] = pickPlacementEnvironment(campaign, placement.id);
    }
    return acc;
  },
  {}
);

hierarchy.placements.forEach((placement, index) => {
  const format = placementFormatByPlacementId[placement.id] ?? "display";
  const templates = PLACEMENT_TEMPLATES[format];
  placement.name = templates[index % templates.length];
});

hierarchy.creatives.forEach((creative, index) => {
  const format = placementFormatByPlacementId[creative.placementId] ?? "display";
  const templates = CREATIVE_TEMPLATES[format];
  creative.name = templates[index % templates.length];
});

const creativesByPlacement = hierarchy.creatives.reduce<Record<number, CreativeEntity[]>>((acc, creative) => {
  if (!acc[creative.placementId]) acc[creative.placementId] = [];
  acc[creative.placementId].push(creative);
  return acc;
}, {});

const days = lastNDays(90);
const weekFactor = [0.88, 0.92, 0.97, 1.02, 1.09, 1.15, 1.03];

const dataset: DatasetRow[] = [];

for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
  const day = days[dayIndex];
  const weekday = new Date(day).getDay();

  CAMPAIGNS.forEach((campaign) => {
    const seasonality = 0.92 + Math.sin((dayIndex / 90) * Math.PI * 2 + campaign.id * 0.01) * 0.09;
    const volatility = 0.8 + rnd() * 0.45;
    const dailyBudgetImps = Math.round(
      42_000 * campaign.weight * weekFactor[weekday] * seasonality * volatility
    );

    const slices = 1 + (rnd() > 0.82 ? 1 : 0);
    const rawShares = Array.from({ length: slices }, () => 0.3 + rnd() * 1.8);
    const shareSum = rawShares.reduce((acc, x) => acc + x, 0);

    for (let i = 0; i < slices; i += 1) {
      const placement = weightedPick(
        placementsByCampaign[campaign.id],
        placementsByCampaign[campaign.id].map((_, idx) => 1.2 / (1 + idx * 0.35)),
        rnd
      );

      const creative = weightedPick(
        creativesByPlacement[placement.id],
        creativesByPlacement[placement.id].map((_, idx) => 1 / (1 + idx * 0.4)),
        rnd
      );

      const domain = weightedPick(
        domainProfiles,
        domainProfiles.map((d) => d.share),
        rnd
      );

      const geo = weightedPick(
        geoProfiles,
        geoProfiles.map((g) => g.share),
        rnd
      );

      const device = weightedPick(
        DEVICE_PROFILES,
        DEVICE_PROFILES.map((d) => d.share),
        rnd
      );

      const osName = weightedPick(
        device.osMix,
        device.osMix.map((x) => x.share),
        rnd
      ).name;

      const hour = weightedPick(
        Array.from({ length: 24 }, (_, h) => h),
        hourMix,
        rnd
      );

      const share = rawShares[i] / shareSum;
      const impressions = Math.max(120, Math.round(dailyBudgetImps * share * (0.75 + rnd() * 0.5)));
      const format = placementFormatByPlacementId[placement.id] ?? pickFormat(campaign, rnd);
      const placementEnvironment = placementEnvironmentByPlacementId[placement.id] ?? "Web Прочее";
      const verificationType = pickVerificationType(format, rnd);
      const supplierProfile = supplierProfileByName.get(campaign.supplier);

      const ctrRate = clamp(
        0.0034 +
          campaign.weight * 0.00125 +
          domain.ctrAdj +
          device.ctrAdj +
          (supplierProfile?.ctrAdj ?? 0) +
          (rnd() - 0.5) * 0.0016,
        0.001,
        0.02
      );
      const clicks = Math.round(impressions * ctrRate);

      const baseCpm = clamp(
        85 +
          campaign.weight * 72 +
          (format === "video" ? 140 : 0) +
          (device.name === "CTV" ? 48 : 0) +
          (supplierProfile?.cpmAdj ?? 0) +
          domain.ivtBase * 120 +
          (rnd() - 0.5) * 36,
        40,
        690
      );
      const spend = Math.round((impressions / 1000) * baseCpm);

      const freqTarget = clamp(1.35 + campaign.weight * 0.85 + rnd() * 3.3, 1.2, 7.8);
      const reach = Math.max(1, Math.round(impressions / freqTarget));

      const ivtRate = clamp(domain.ivtBase + device.ivtAdj + (rnd() - 0.5) * 0.02, 0.005, 0.15);
      const normalizedIvtRate = clamp(ivtRate + (supplierProfile?.ivtAdj ?? 0), 0.005, 0.15);
      const givtShare = clamp(0.44 + domain.ivtBase * 0.9 + device.ivtAdj * 5 + (rnd() - 0.5) * 0.12, 0.32, 0.86);
      const givtRate = clamp(normalizedIvtRate * givtShare, 0, normalizedIvtRate);
      const sivtRate = clamp(normalizedIvtRate - givtRate, 0, normalizedIvtRate);
      const givtImpressions = Math.round(impressions * givtRate);
      const sivtImpressions = Math.round(impressions * sivtRate);
      const ivtClickRate = clamp(normalizedIvtRate * (0.7 + rnd() * 0.9) + (rnd() - 0.5) * 0.01, 0.003, 0.22);
      const ivtClicks = Math.round(clicks * ivtClickRate);
      const givtClickShare = clamp(givtShare + (rnd() - 0.5) * 0.08, 0.24, 0.9);
      const givtClicks = Math.min(ivtClicks, Math.round(ivtClicks * givtClickShare));
      const sivtClicks = Math.max(0, ivtClicks - givtClicks);
      const givtClickRate = clicks > 0 ? givtClicks / clicks : 0;
      const sivtClickRate = clicks > 0 ? sivtClicks / clicks : 0;
      const validImpressions = Math.max(0, Math.round(impressions * (1 - normalizedIvtRate)));
      const validClicks = Math.max(0, Math.round(clicks * (1 - ivtClickRate)));
      const viewabilityRate = clamp(
        (format === "video" ? 0.68 : format === "display" ? 0.58 : format === "native" ? 0.61 : 0.52) +
          (device.name === "Desktop" ? 0.03 : 0) -
          (device.name === "Mobile" ? 0.015 : 0) +
          (supplierProfile?.viewabilityAdj ?? 0) +
          (domain.safetyBase - 0.9) * 0.18 +
          (rnd() - 0.5) * 0.08,
        0.3,
        0.93
      );
      const viewableImpressions = Math.round(impressions * viewabilityRate);
      const brandSafetyRate = clamp(domain.safetyBase + (rnd() - 0.5) * 0.025, 0.85, 0.995);
      const cookiesProbability =
        device.name === "Desktop" ? 0.84 : device.name === "Mobile" ? 0.66 : device.name === "Tablet" ? 0.61 : 0.18;
      const cookiesFlag = rnd() < cookiesProbability;

      const isVideo = format === "video";
      const vastStart = isVideo ? Math.round(impressions * clamp(0.55 + rnd() * 0.34, 0.35, 0.94)) : 0;
      const q1Rate = clamp(0.64 + rnd() * 0.24, 0.5, 0.94);
      const midRate = clamp(q1Rate - 0.09 + rnd() * 0.09, 0.45, q1Rate);
      const q3Rate = clamp(midRate - 0.08 + rnd() * 0.07, 0.38, midRate);
      const completeRate = clamp(q3Rate - 0.07 + rnd() * 0.06, 0.3, 0.85);

      const vastQ1 = isVideo ? Math.round(vastStart * q1Rate) : 0;
      const vastMid = isVideo ? Math.round(vastStart * midRate) : 0;
      const vastQ3 = isVideo ? Math.round(vastStart * q3Rate) : 0;
      const vastComplete = isVideo ? Math.round(vastStart * completeRate) : 0;

      const postViewConv = Math.round(
        impressions * clamp(0.00004 + campaign.convLift * 0.00025 + (rnd() - 0.5) * 0.00015, 0.00002, 0.0012)
      );
      const postClickConv = Math.round(
        clicks * clamp(0.015 + campaign.convLift * 0.027 + (rnd() - 0.5) * 0.015, 0.006, 0.085)
      );
      const overlapK = clamp(0.1 + rnd() * 0.2, 0.1, 0.3);
      const overlapConv = Math.round(Math.min(postViewConv, postClickConv) * overlapK);
      const totalConversions = Math.max(0, postViewConv + postClickConv - overlapConv);
      const incrementalShare = clamp(0.15 + rnd() * 0.2, 0.15, 0.35);
      const incrementalConversions = Math.round(totalConversions * incrementalShare);

      dataset.push({
        date: day,
        hour,
        campaignId: campaign.id,
        campaignName: campaign.name,
        brand: campaign.brand,
        supplier: campaign.supplier,
        client: campaign.client,
        advertiser: campaign.advertiser,
        placementId: placement.id,
        placementName: placement.name,
        creativeId: creative.id,
        creativeName: creative.name,
        placementEnvironment,
        domain: domain.name,
        geo: geo.name,
        deviceType: device.name,
        os: osName,
        format,
        cookiesFlag,
        verificationType,
        impressions,
        validImpressions,
        viewableImpressions,
        viewabilityRate,
        clicks,
        validClicks,
        ivtClicks,
        givtClicks,
        sivtClicks,
        ivtClickRate,
        givtClickRate,
        sivtClickRate,
        reach,
        spend,
        ivtRate: normalizedIvtRate,
        givtRate,
        sivtRate,
        givtImpressions,
        sivtImpressions,
        brandSafetyRate,
        vastStart,
        vastQ1,
        vastMid,
        vastQ3,
        vastComplete,
        postViewConv,
        postClickConv,
        overlapConv,
        totalConversions,
        incrementalShare,
        incrementalConversions,
      });
    }
  });
}

export const MOCK_DATASET: DatasetRow[] = dataset;

export const CATALOG = {
  campaigns: CAMPAIGNS.map((x) => ({ id: x.id, name: x.name })),
  placements: hierarchy.placements,
  creatives: hierarchy.creatives,
  suppliers: Array.from(new Set(CAMPAIGNS.map((x) => x.supplier))),
  placementEnvironments: [...PLACEMENT_ENVIRONMENTS],
  brands: Array.from(new Set(CAMPAIGNS.map((x) => x.brand))),
  clients: Array.from(new Set(CAMPAIGNS.map((x) => x.client))),
  advertisers: Array.from(new Set(CAMPAIGNS.map((x) => x.advertiser))),
  domains: domainProfiles.map((d) => d.name),
  geos: geoProfiles.map((g) => g.name),
  deviceTypes: DEVICE_PROFILES.map((d) => d.name),
  os: Array.from(new Set(DEVICE_PROFILES.flatMap((d) => d.osMix.map((x) => x.name)))),
  formats: ["display", "video", "native", "audio"] as AdFormat[],
  verificationTypes: [...VERIFICATION_TYPES],
  dateFrom: days[0],
  dateTo: days[days.length - 1],
};
