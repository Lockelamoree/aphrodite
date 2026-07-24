import type { ConciergeEvent } from "@/lib/concierge/types";

/**
 * Strip raw provider payloads from an event before it reaches the browser.
 * Skin/color results carry an optional `raw` field (the literal YouCam response)
 * for server-side debugging; it must never be streamed to the client. Setting it
 * to `undefined` drops it from the JSON frame (JSON.stringify omits undefined).
 */
export function sanitizeEvent(ev: ConciergeEvent): ConciergeEvent {
  if (ev.type === "skin") {
    return { ...ev, analysis: { ...ev.analysis, raw: undefined } };
  }
  if (ev.type === "color") {
    return { ...ev, profile: { ...ev.profile, raw: undefined } };
  }
  return ev;
}
