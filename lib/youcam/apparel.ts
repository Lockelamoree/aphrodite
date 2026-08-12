import "server-only";

import { fixturesActive } from "@/lib/youcam/runtime";
import { endpointsFor } from "@/lib/youcam/config";
import { resolveImage, runTaskAndWait } from "@/lib/youcam/client";
import { fixtureApparel } from "@/lib/youcam/fixtures";
import { firstImageUrl } from "@/lib/youcam/util";
import type { ImageInput, RenderedImage } from "@/lib/youcam/types";

export type ApparelCategory = "top" | "bottom" | "dress" | "full";

/** Verified AI-Cloth (cloth-v3) success shape: data.results.url. */
interface ClothResults {
  url?: string;
  output?: { url?: string }[];
}

/** Map our category to YouCam AI-Cloth's `garment_category` enum. */
function mapCategory(c?: ApparelCategory): string {
  switch (c) {
    case "top":
      return "upper_body";
    case "bottom":
      return "lower_body";
    case "dress":
    case "full":
      return "full_body";
    default:
      return "auto";
  }
}

/**
 * Generative Apparel Virtual Try-On (AI-Cloth): render `garment` (ref) onto
 * `person` (src). Both may be byte/url/fileId inputs.
 */
export async function tryOnApparel(
  args: {
    person: ImageInput;
    garment: ImageInput;
    category?: ApparelCategory;
    /** Demo-only: which captured fixture render to serve (by wardrobe kind).
     * Ignored by the live API. */
    renderHint?: string;
    /** Demo-only: the catalogue id, so a captured render is served ONLY for the
     * person-and-garment pair it was actually captured for. Ignored live. */
    garmentId?: string;
  },
  opts?: { intervalMs?: number; timeoutMs?: number },
): Promise<RenderedImage> {
  if (fixturesActive())
    return fixtureApparel({
      person: args.person,
      garmentId: args.garmentId,
      category: args.category,
      renderHint: args.renderHint,
    });
  const { file, task } = endpointsFor("apparelVto");
  const [src, ref] = await Promise.all([
    resolveImage(args.person, file, "src"),
    resolveImage(args.garment, file, "ref"),
  ]);
  const results = await runTaskAndWait<ClothResults>(
    task,
    {
      ...src,
      ...ref,
      garment_category: mapCategory(args.category),
    },
    opts,
  );
  // Verified cloth-v3 success shape: data.results.url. Fall back defensively.
  return { url: results.url ?? firstImageUrl(results), raw: results };
}
