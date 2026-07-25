import "server-only";

import { env } from "@/lib/env";
import { endpointsFor } from "@/lib/youcam/config";
import { resolveImage, runTaskAndWait } from "@/lib/youcam/client";
import { fixtureMakeup } from "@/lib/youcam/fixtures";
import { firstImageUrl } from "@/lib/youcam/util";
import type { ImageInput, RenderedImage } from "@/lib/youcam/types";

/** AI-Makeup success shape: data.results.url (fall back defensively). */
interface UrlResults {
  url?: string;
  output?: { url?: string }[];
}

/**
 * A soft, camera-ready "occasion" look: skin-smoothing + a single-color blush +
 * a satin lip. Kept to a minimal, schema-valid effects set (no shimmer/metallic
 * fields, plain pattern/shape names) so it renders predictably. The lip shade
 * shifts warm/cool with the user's undertone.
 *
 * NOTE(live): pattern/shape names ("1color1", "plump") match the tool schema's
 * examples but were not validated against the live catalog (the demo key 401s).
 * Confirm on a units-on pass with a valid key.
 */
function occasionMakeup(undertone?: string): Record<string, unknown>[] {
  const u = undertone?.toLowerCase() ?? "";
  const lip = u.includes("cool") ? "#B0335F" : "#B84A5A"; // cool berry vs warm rose
  return [
    { category: "skin_smooth", skinSmoothStrength: 55, skinSmoothColorIntensity: 45 },
    {
      category: "blush",
      pattern: { name: "1color1" },
      palettes: [{ color: "#E0928C", texture: "matte", colorIntensity: 45 }],
    },
    {
      category: "lip_color",
      shape: { name: "plump" },
      style: { type: "full" },
      palettes: [{ color: lip, texture: "satin", colorIntensity: 70 }],
    },
  ];
}

/**
 * YouCam AI Makeup Virtual Try-On: apply a curated occasion look to `person`.
 */
export async function applyMakeup(
  person: ImageInput,
  undertone?: string,
  opts?: { intervalMs?: number; timeoutMs?: number },
): Promise<RenderedImage> {
  if (env.youcamFixtures) return fixtureMakeup(person);
  const { file, task } = endpointsFor("makeup");
  const src = await resolveImage(person, file, "src");
  const results = await runTaskAndWait<UrlResults>(
    task,
    { ...src, effects: occasionMakeup(undertone), version: "1.0" },
    opts,
  );
  return { url: results.url ?? firstImageUrl(results), raw: results };
}
