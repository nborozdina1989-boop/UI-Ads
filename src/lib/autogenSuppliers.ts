export const CODE_TYPES = [
  'Кликовый',
  'Аудит',
  'Аудит ABF',
  'Аудит с проверкой IVT',
  'Аудит с проверкой IVT, видимости',
  'Партнерская видимость (VK) Медиа',
  'Аудит с проверкой видимости',
  'Счетчик VAST',
  'Счетчик VAST с проверкой IVT',
  'Партнерская видимость (VK) Видео',
  'Аудит видео с проверкой IVT, видимости',
  'Аудит видео с проверкой IVT, видимости (интегрированный)',
  'MRAID',
  'MRAID Видео',
  'Аудит Видео',
  'Аудит Видео с проверкой IVT',
  'Аудит Видео с проверкой видимости',
  'Сторонний аудит',
] as const;

export type CodeType = typeof CODE_TYPES[number];

export type SupplierKey =
  | 'other'
  | 'yandex'
  | 'ivi'
  | 'ozon'
  | 'hyper'
  | 'vk'
  | 'rambler'
  | 'gpmd'
  | 'everest'
  | 'avito'
  | 'yabbi'
  | 'digitalalliance'
  | 'sape'
  | 'youdo'
  | 'xiaomi'
  | 'weborama'
  | 'videotarget';

export type SupplierMacros = {
  macroExss?: string;
  macroExtId?: string;
  macroAdvId?: string;
  macroBundleId?: string;
  macroErir?: string;
  hidden?: Record<string, string>;
};

export type SupplierConfig = {
  id: number | '';
  label: string;
  aliases: string[];
  defaultCode: CodeType | '';
  recommended: CodeType[];
  macros?: SupplierMacros;
};

export const SUPPLIERS: Record<SupplierKey, SupplierConfig> = {
  other: { id: '', label: 'Другой', aliases: [], defaultCode: '', recommended: [] },
  yandex: {
    id: 120,
    label: 'Yandex',
    aliases: ['янд', 'yandex', 'yandex spb', 'direct', 'яндекс'],
    defaultCode: 'Аудит',
    recommended: ['Аудит', 'Аудит с проверкой IVT', 'Аудит с проверкой IVT, видимости'],
  },
  ivi: {
    id: 146,
    label: 'IVI',
    aliases: ['ivi', 'иви'],
    defaultCode: 'Счетчик VAST',
    recommended: ['Счетчик VAST', 'Счетчик VAST с проверкой IVT', 'Аудит Видео'],
  },
  ozon: {
    id: 191,
    label: 'Ozon',
    aliases: ['ozon', 'озон'],
    defaultCode: 'Аудит',
    recommended: ['Аудит', 'Аудит с проверкой IVT'],
  },
  hyper: {
    id: 204,
    label: 'Hyper',
    aliases: ['hyper', 'гипер'],
    defaultCode: 'Аудит',
    recommended: ['Аудит', 'Аудит ABF'],
  },
  vk: {
    id: 242,
    label: 'VK',
    aliases: ['vk', 'вк', 'vk ads', 'vk_video', 'mytarget', 'my target'],
    defaultCode: 'Партнерская видимость (VK) Видео',
    recommended: ['Кликовый', 'Партнерская видимость (VK) Медиа', 'Партнерская видимость (VK) Видео'],
    macros: { macroExss: '{{impression_id}}', hidden: { rnd: '{{random}}' } },
  },
  rambler: {
    id: 260,
    label: 'Rambler',
    aliases: ['rambler', 'рамблер'],
    defaultCode: 'Аудит',
    recommended: ['Аудит', 'Аудит с проверкой видимости'],
  },
  gpmd: {
    id: 263,
    label: 'ГПМД',
    aliases: ['гпм', 'гпмд', 'gpmd', 'gpm', 'premier'],
    defaultCode: 'Счетчик VAST',
    recommended: ['Счетчик VAST', 'Счетчик VAST с проверкой IVT', 'Аудит Видео'],
  },
  everest: {
    id: 267,
    label: 'Everest',
    aliases: ['everest'],
    defaultCode: 'Аудит',
    recommended: ['Аудит', 'Аудит ABF'],
    macros: { macroExss: '%request.request_session%' },
  },
  avito: {
    id: 268,
    label: 'Avito',
    aliases: ['avito', 'авито'],
    defaultCode: 'Аудит с проверкой видимости',
    recommended: ['Аудит с проверкой видимости', 'Аудит Видео с проверкой видимости'],
  },
  yabbi: {
    id: 283,
    label: 'Yabbi',
    aliases: ['yabbi', 'яби', 'yappi'],
    defaultCode: 'Аудит',
    recommended: ['Аудит', 'Аудит с проверкой IVT'],
  },
  digitalalliance: {
    id: 301,
    label: 'Digital Alliance',
    aliases: ['digitalalliance', 'digital alliance', 'da_', 'da '],
    defaultCode: 'Аудит с проверкой IVT',
    recommended: ['Аудит с проверкой IVT', 'Аудит с проверкой IVT, видимости'],
  },
  sape: {
    id: 286,
    label: 'Sape',
    aliases: ['sape', 'сапе'],
    defaultCode: 'Аудит ABF',
    recommended: ['Аудит ABF', 'Аудит'],
  },
  youdo: {
    id: 284,
    label: 'Youdo',
    aliases: ['youdo', 'юду'],
    defaultCode: 'Аудит',
    recommended: ['Аудит', 'Аудит с проверкой IVT'],
  },
  xiaomi: {
    id: 282,
    label: 'Xiaomi',
    aliases: ['xiaomi', 'mi ads', 'сяоми'],
    defaultCode: 'MRAID',
    recommended: ['MRAID', 'MRAID Видео'],
    macros: { macroAdvId: '__IMEI__', macroBundleId: '__APP_BUNDLE__' },
  },
  weborama: {
    id: 278,
    label: 'Weborama',
    aliases: ['weborama', 'веборама'],
    defaultCode: 'Сторонний аудит',
    recommended: ['Сторонний аудит', 'Аудит'],
  },
  videotarget: {
    id: 274,
    label: 'Videotarget',
    aliases: ['videotarget', 'video target'],
    defaultCode: 'Счетчик VAST',
    recommended: ['Счетчик VAST', 'Счетчик VAST с проверкой IVT', 'Аудит Видео'],
  },
};

export const SUPPLIER_KEYS = Object.keys(SUPPLIERS) as SupplierKey[];

const normalize = (value: unknown) => String(value || '').trim().toLowerCase();

export function findSupplier(value: string | undefined): SupplierKey {
  const source = normalize(value);
  if (!source) return 'other';
  return SUPPLIER_KEYS.find((key) => key !== 'other' && SUPPLIERS[key].aliases.some((alias) => source.includes(alias))) || 'other';
}

export function findSupplierExact(value: string | undefined): SupplierKey {
  const source = normalize(value);
  if (!source) return 'other';
  return SUPPLIER_KEYS.find((key) => key !== 'other' && normalize(SUPPLIERS[key].label) === source) || 'other';
}

export function resolveSupplierFromExcel(value: string | undefined): SupplierKey {
  const exact = findSupplierExact(value);
  return exact !== 'other' ? exact : findSupplier(value);
}

export function isCodeType(value: string): value is CodeType {
  return CODE_TYPES.includes(value as CodeType);
}

export function codeSupportsIvt(codeType = '') {
  const type = normalize(codeType);
  return type.includes('ivt') || type.includes('mraid') || type.includes('партнерская видимость');
}

export function codeSupportsViewability(codeType = '') {
  const type = normalize(codeType);
  return type.includes('видим') || type.includes('view') || type.includes('mraid') || type.includes('партнерская видимость');
}

export function codeRequiresCreative(codeType = '') {
  const type = normalize(codeType);
  return type.includes('mraid') || type.includes('аудит видео с проверкой ivt, видимости');
}

export function codeMatchesMetrics(row: { ivt?: boolean; view?: boolean }, codeType: string): boolean {
  if (!codeType) return false;
  if (row.ivt && !codeSupportsIvt(codeType)) return false;
  if (row.view && !codeSupportsViewability(codeType)) return false;
  return true;
}

export function isRecommendedCode(supplier: SupplierKey | undefined, row: { ivt?: boolean; view?: boolean }, codeType = '') {
  if (!supplier || supplier === 'other' || !isCodeType(codeType)) return false;
  return SUPPLIERS[supplier].recommended.includes(codeType) && codeMatchesMetrics(row, codeType);
}
