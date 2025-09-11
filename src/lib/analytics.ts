export const logEvent = (name: string, payload?: Record<string, any>) => {
  if (typeof window === "undefined") return;
  try { console.debug("[analytics]", name, payload||{}); } catch {}
};
