export const ctr  = (clicks:number, imps:number) => imps ? clicks / imps : 0;
export const cpm  = (spend:number, imps:number) => imps ? (spend / imps) * 1000 : 0;
export const cpc  = (spend:number, clicks:number) => clicks ? spend / clicks : 0;
export const cpa  = (spend:number, actions:number) => actions ? spend / actions : 0;

export function weightedIVTShare(rows:{ impressions:number; ivtShare:number }[]) {
  const imps = rows.reduce((s,r)=>s+r.impressions,0);
  return imps ? rows.reduce((s,r)=>s + r.ivtShare*r.impressions,0) / imps : 0;
}

export const validImpressions = (imps:number, ivtPct:number) =>
  Math.max(0, Math.round(imps * (1 - ivtPct/100)));
