import "server-only";

import { fixturesActive } from "@/lib/youcam/runtime";
import { endpointsFor } from "@/lib/youcam/config";
import { resolveImage, runTaskAndWait } from "@/lib/youcam/client";
import { fixtureLighting } from "@/lib/youcam/fixtures";
import { firstImageUrl } from "@/lib/youcam/util";
import type { ImageInput, RenderedImage } from "@/lib/youcam/types";

interface LightingResults {
  url?: string;
  output?: { url?: string }[];
}

/**
 * AI Photo Lighting — a final camera-ready relight pass. Verified: accepts
 * `src_file_url`/`src_file_id` alone and returns `data.results.url`.
 * Used as the occasion "finishing" render on top of the apparel result.
 */
export async function applyLighting(input: ImageInput): Promise<RenderedImage> {
  if (fixturesActive()) return fixtureLighting(input);
  const { file, task } = endpointsFor("lighting");
  const source = await resolveImage(input, file, "src");
  const results = await runTaskAndWait<LightingResults>(task, { ...source });
  return { url: results.url ?? firstImageUrl(results), raw: results };
}
