export type SupplierKey = 'yandex' | 'ivi' | 'ozon' | 'hyper' | 'vk' | 'rambler' | 'gpmd';
export const SUPPLIER_SYNONYMS: Record<SupplierKey,string[]> = {
  yandex:['yandex','яндекс','yandex video','videonet','yndx','yandexdisplay'],
  ivi:['ivi','иви','ivi.ru'],
  ozon:['ozон','ozon'],
  hyper:['hyper','хайпер','гипер','hyperadx','hyper adx'],
  vk:['vk','vkontakte','вк','mytarget','вконтакте'],
  rambler:['rambler','рамблер'],
  gpmd:['гпмд','gpm','gazprom media','gpm digital']
};
export const SUPPLIER_LABEL: Record<SupplierKey,string> = {
  yandex:'Yandex', ivi:'IVI', ozon:'Ozon', hyper:'Hyper', vk:'VK', rambler:'Rambler', gpmd:'ГПМД'
};
export type SupplierDetect =
  | { kind:'none' }
  | { kind:'single', key: SupplierKey }
  | { kind:'multiple', keys: SupplierKey[] };
export function inferSupplierByTitle(title:string): SupplierDetect {
  const t=(title||'').toLowerCase(); const hits: SupplierKey[]=[];
  (Object.keys(SUPPLIER_SYNONYMS) as SupplierKey[]).forEach(k=>{
    if (SUPPLIER_SYNONYMS[k].some(s=>t.includes(s))) hits.push(k);
  });
  if (!hits.length) return {kind:'none'};
  const uniq=Array.from(new Set(hits));
  return uniq.length===1? {kind:'single', key:uniq[0]} : {kind:'multiple', keys:uniq};
}
