export type CompatCtx = { hasVideo: boolean; hasViewability: boolean };

export const METRIC_RULES: Record<string, { videoOnly?: boolean; requiresViewability?: boolean }> = {
  "VTR 25%":   { videoOnly: true },
  "VTR 50%":   { videoOnly: true },
  "VTR 75%":   { videoOnly: true },
  "VTR 100%":  { videoOnly: true },
  "Видимость %": { requiresViewability: true },
};

export function metricAllowed(label: string, ctx: CompatCtx) {
  const r = METRIC_RULES[label];
  if (!r) return true;
  if (r.videoOnly && !ctx.hasVideo) return false;
  if (r.requiresViewability && !ctx.hasViewability) return false;
  return true;
}
export function filterCompatibleMetricsLabels(metrics: string[], ctx: CompatCtx) {
  return metrics.filter(m => metricAllowed(m, ctx));
}
