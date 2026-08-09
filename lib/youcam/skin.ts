import "server-only";

import { fixturesActive } from "@/lib/youcam/runtime";
import { endpointsFor } from "@/lib/youcam/config";
import { resolveImage, runTaskAndWait } from "@/lib/youcam/client";
import { fixtureSkin } from "@/lib/youcam/fixtures";
import type { ImageInput, SkinAnalysis, SkinConcern } from "@/lib/youcam/types";

// Real SD action enums (verified against the live API). SD and HD concern sets
// cannot be mixed in one request — keep this all-SD.
export const DEFAULT_SKIN_CONCERNS = [
  "wrinkle",
  "acne",
  "dark_circle_v2",
  "age_spot",
  "redness",
  "oiliness",
  "pore",
  "texture",
  "firmness",
  "moisture",
] as const;

/** Verified result shape: data.results.output[] items. */
interface SkinResults {
  output?: {
    type: string;
    ui_score?: number;
    raw_score?: number;
    mask_urls?: string[];
    url?: string | null;
  }[];
}

/** Run AI Skin Analysis and normalize the 0–100 concern scores. */
export async function analyzeSkin(
  input: ImageInput,
  concerns: readonly string[] = DEFAULT_SKIN_CONCERNS,
): Promise<SkinAnalysis> {
  if (fixturesActive()) return fixtureSkin(input);
  const { file, task } = endpointsFor("skinAnalysis");
  const source = await resolveImage(input, file, "src");
  const results = await runTaskAndWait<SkinResults>(task, {
    ...source,
    dst_actions: [...concerns],
    format: "json",
    // Blend the detection masks onto the face so overlayUrl is a striking
    // "what YouCam sees" AR image (not a raw transparent mask).
    miniserver_args: { enable_mask_overlay: true },
  });
  return normalizeSkinAnalysis(results, concerns);
}

function normalizeSkinAnalysis(
  results: SkinResults,
  requested: readonly string[],
): SkinAnalysis {
  // The API returns extra meta rows (all, skin_age, resize_image); keep only
  // the concerns we asked for.
  const all = results?.output ?? [];
  const wanted = new Set(requested.map(String));
  const output = all.filter((o) => wanted.has(o.type));
  const concerns: SkinConcern[] = output.map((o) => ({
    name: o.type,
    score: typeof o.ui_score === "number" ? o.ui_score : (o.raw_score ?? 0),
    maskUrl: o.mask_urls?.[0],
  }));
  // Overlay for the "what YouCam sees" hero: prefer the LOWEST-health concern's
  // mask so the AR image matches the concern the plan actually names; else a
  // composite 'all' mask; else any available mask.
  const composite = all.find((o) => o.type === "all" && o.mask_urls?.[0])?.mask_urls?.[0];
  const lowest = [...concerns]
    .filter((c) => c.maskUrl)
    .sort((a, b) => a.score - b.score)[0]?.maskUrl;
  const anyMask = output.find((o) => o.mask_urls?.[0])?.mask_urls?.[0];
  return { concerns, overlayUrl: lowest ?? composite ?? anyMask, raw: results };
}
