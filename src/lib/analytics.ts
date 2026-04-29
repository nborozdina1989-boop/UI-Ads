export const logEvent = (name: string, payload?: Record<string, unknown>) => {
  if (typeof window === "undefined") return;
  try { console.debug("[analytics]", name, payload||{}); } catch {}
};
