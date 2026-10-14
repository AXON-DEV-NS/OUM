/**
 * Lightweight analytics dispatcher — no vendor lock-in.
 * Emits a DOM CustomEvent("oum:analytics") and forwards to dataLayer/gtag/va
 * when present. Safe to call during SSR (no-ops without window).
 */
export type AnalyticsEvent =
  | "hero_video_play"
  | "modal_open"
  | "cta_click";

export function track(event: AnalyticsEvent, props: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  const detail = { event, ...props, ts: Date.now() };
  try {
    window.dispatchEvent(new CustomEvent("oum:analytics", { detail }));
    const w = window as unknown as {
      dataLayer?: unknown[];
      gtag?: (...a: unknown[]) => void;
      va?: (...a: unknown[]) => void;
    };
    if (Array.isArray(w.dataLayer)) w.dataLayer.push(detail);
    if (typeof w.gtag === "function") w.gtag("event", event, props);
    if (typeof w.va === "function") w.va("track", event, props);
  } catch {
    /* analytics must never break UX */
  }
}
