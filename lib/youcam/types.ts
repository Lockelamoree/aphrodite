/**
 * Shared types for the YouCam / Perfect Corp AI API client.
 *
 * NOTE: exact wire field names are being confirmed against the API Playground
 * (https://yce.perfectcorp.com/) and docs.perfectcorp.com. The client isolates
 * request/response *shaping* in a few clearly-marked helpers so that pinning the
 * real schema is a small, local edit — the rest of the app depends only on the
 * typed results below.
 */

/** Raw task lifecycle status returned by the polling endpoint. */
export type YouCamTaskStatus =
  | "queued"
  | "running"
  | "success"
  | "error"
  | (string & {});

/** Generic result of a completed (or failed) polled task. */
export interface YouCamTaskResult<T = unknown> {
  taskId: string;
  status: YouCamTaskStatus;
  /** Present when status === "success". */
  result?: T;
  /** Present when status === "error". */
  error?: string;
}

/** A single detected skin concern with a 0–100 HEALTH score. */
export interface SkinConcern {
  /** e.g. "wrinkle", "acne", "oiliness", "dark_circle_v2", "redness". */
  name: string;
  /** 0–100 HEALTH (higher = healthier). The LOWEST scores are where to focus. */
  score: number;
  /** Optional detection-mask/overlay image URL for this concern. */
  maskUrl?: string;
}

/** Normalized skin-analysis output the app consumes. */
export interface SkinAnalysis {
  concerns: SkinConcern[];
  /** Overall/summary image with all overlays, if provided. */
  overlayUrl?: string;
  /** The raw provider payload, kept for debugging / richer UI later. */
  raw?: unknown;
}

/** Undertone / seasonal color result derived from YouCam facial color tones. */
export interface ColorProfile {
  /** "warm" | "cool" | "neutral" — derived from the detected skin-color hex. */
  undertone?: string;
  /** Tonal depth "light" | "medium" | "deep" — a separate axis from undertone
   * so recommendations stay accurate across all skin tones. */
  depth?: string;
  /** Seasonal palette label, e.g. "Deep Autumn", if derived. */
  season?: string;
  /** Colors YouCam actually detected on the face (hex). */
  detected?: {
    skin?: string;
    eye?: string;
    eyeName?: string;
    lip?: string;
    eyebrow?: string;
  };
  /** Recommended apparel hex colors for this person. */
  paletteHex: string[];
  raw?: unknown;
}

/** Result of any image-generating task (VTO, simulation, etc.). */
export interface RenderedImage {
  /** URL of the generated image (may be a YouCam CDN URL, short-lived). */
  url: string;
  raw?: unknown;
}

/** How the caller provides an input image to the client. */
export type ImageInput =
  | { kind: "bytes"; data: Uint8Array; contentType: string }
  | { kind: "url"; url: string }
  | { kind: "fileId"; fileId: string };
