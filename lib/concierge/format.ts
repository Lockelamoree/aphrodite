/**
 * Pure display helpers shared by server (deterministic engine) and client (UI).
 * No server-only imports — safe in both.
 */

const CONCERN_LABELS: Record<string, string> = {
  dark_circle_v2: "dark circles",
  dark_circle: "dark circles",
  age_spot: "age spots",
  eye_bag: "eye bags",
  tear_trough: "tear troughs",
  droopy_upper_eyelid: "upper-eyelid droop",
  droopy_lower_eyelid: "lower-eyelid droop",
  skin_type: "skin type",
  pore: "pores",
  wrinkle: "fine lines",
};

/** Human-readable name for a YouCam skin concern (handles HD prefix + aliases). */
export function prettyConcern(name: string): string {
  const key = name.replace(/^hd_/, "");
  return CONCERN_LABELS[name] ?? CONCERN_LABELS[key] ?? key.replace(/_/g, " ");
}
