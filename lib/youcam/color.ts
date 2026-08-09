import "server-only";

import { fixturesActive } from "@/lib/youcam/runtime";
import { endpointsFor } from "@/lib/youcam/config";
import { resolveImage, runTaskAndWait } from "@/lib/youcam/client";
import { fixtureColor } from "@/lib/youcam/fixtures";
import type { ColorProfile, ImageInput } from "@/lib/youcam/types";

/**
 * AI Facial Color Tones Analysis. Verified live result shape:
 *   data.results.color = { skin_color, eye_color, eye_color_name, lip_color, eyebrow_color }  (hex)
 *   data.results.face_quality = { has_face, area, frontal, lighting, faceangle }
 * There is no undertone/season field — we DERIVE undertone from the detected
 * skin-color hex and build the recommended palette from that.
 */
interface ColorResults {
  color?: {
    skin_color?: string;
    eye_color?: string;
    eye_color_name?: string;
    lip_color?: string;
    eyebrow_color?: string;
  };
  face_quality?: Record<string, unknown>;
}

export async function analyzeColorProfile(input: ImageInput): Promise<ColorProfile> {
  if (fixturesActive()) return fixtureColor(input);
  const { file, task } = endpointsFor("colorTone");
  const source = await resolveImage(input, file, "src");
  const results = await runTaskAndWait<ColorResults>(task, { ...source });

  const c = results?.color ?? {};
  const undertone = undertoneFromHex(c.skin_color);
  const depth = depthFromHex(c.skin_color);
  return {
    undertone,
    depth,
    season: seasonFrom(undertone, depth),
    detected: {
      skin: c.skin_color,
      eye: c.eye_color,
      eyeName: c.eye_color_name,
      lip: c.lip_color,
      eyebrow: c.eyebrow_color,
    },
    paletteHex: recommendPalette(undertone, depth),
    raw: results,
  };
}

/** Parse "#rrggbb" → [r,g,b] (0–255). */
function toRgb(hex?: string): [number, number, number] | undefined {
  if (!hex) return undefined;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return undefined;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Relative luminance 0–1 from an RGB triple. */
function luma([r, g, b]: [number, number, number]): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Warm vs cool from the detected skin hex — a cosmetic heuristic, NOT a
 * diagnosis. The old rule used the absolute red-minus-blue gap, which shrinks
 * as skin darkens and wrongly pushed deep skin toward "cool". We instead
 * normalize the r−b gap by the tone's own brightness, so the warm/cool split
 * holds across light AND deep skin (a small de-bias, not a perfect fix).
 */
function undertoneFromHex(hex?: string): string | undefined {
  const rgb = toRgb(hex);
  if (!rgb) return undefined;
  const [r, g, b] = rgb;
  const mean = Math.max(1, (r + g + b) / 3);
  const warmthRatio = (r - b) / mean; // brightness-independent
  if (warmthRatio >= 0.22) return "warm";
  if (warmthRatio <= 0.1) return "cool";
  return "neutral";
}

/** Tonal depth as its own axis, so palettes suit deep skin as well as light. */
function depthFromHex(hex?: string): string | undefined {
  const rgb = toRgb(hex);
  if (!rgb) return undefined;
  const l = luma(rgb);
  if (l >= 0.62) return "light";
  if (l >= 0.42) return "medium";
  return "deep";
}

/** Seasonal label from undertone + depth. */
function seasonFrom(undertone?: string, depth?: string): string | undefined {
  if (!undertone) return undefined;
  const deep = depth === "deep";
  if (undertone === "warm") return deep ? "Deep Autumn" : "Warm Spring";
  if (undertone === "cool") return deep ? "Deep Winter" : "Cool Summer";
  return deep ? "Soft Autumn" : "Soft Summer";
}

/**
 * Recommended apparel palette by undertone AND depth: deeper skin gets richer,
 * more saturated hues that hold their own; lighter skin gets softer versions.
 */
function recommendPalette(undertone?: string, depth?: string): string[] {
  const palettes = {
    warm: {
      light: ["#C46A3F", "#D9A441", "#7E8B4E", "#8C4B2F", "#E9D6A8"],
      medium: ["#B85A34", "#D9A441", "#71803E", "#7E3A22", "#EBCF95"],
      deep: ["#A83E1F", "#E0A100", "#5E7022", "#6E2410", "#F0C86A"],
    },
    cool: {
      light: ["#0F5F4E", "#3F5C6B", "#7A3B5D", "#2E3A59", "#D8DEE9"],
      medium: ["#0D6B54", "#365A82", "#84335A", "#253358", "#CFD8E6"],
      deep: ["#0A7A5C", "#2E5FA3", "#8E2C5E", "#1C2B52", "#C6D2E6"],
    },
    neutral: {
      light: ["#6B6459", "#9C8B7A", "#4A5859", "#B0857A", "#E4DCD0"],
      medium: ["#5A5148", "#8A7867", "#3F4E4E", "#9C6F62", "#DED2C2"],
      deep: ["#4A4038", "#7C6A57", "#354444", "#8E5F52", "#D8CBB9"],
    },
  };
  const key = undertone === "warm" ? "warm" : undertone === "cool" ? "cool" : "neutral";
  const tier = depth === "deep" ? "deep" : depth === "medium" ? "medium" : "light";
  return palettes[key][tier];
}
