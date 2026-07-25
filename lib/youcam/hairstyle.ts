import "server-only";

import { env } from "@/lib/env";
import { endpointsFor } from "@/lib/youcam/config";
import { resolveImage, runTaskAndWait } from "@/lib/youcam/client";
import { fixtureHairstyle } from "@/lib/youcam/fixtures";
import { firstImageUrl } from "@/lib/youcam/util";
import type { ImageInput, RenderedImage } from "@/lib/youcam/types";

/** AI-Hairstyle-Generator success shape: data.results.url (fall back defensively). */
interface UrlResults {
  url?: string;
  output?: { url?: string }[];
}

/**
 * YouCam AI Hairstyle Generator: restyle the hair in `person` to a predefined
 * template (a catalog id from the Hairstyle-Generator-Templates list).
 *
 * TODO(live): `HAIRSTYLE_TEMPLATE_ID` is UNVERIFIED — the template catalog is
 * gated behind a valid YOUCAM_API_KEY (the demo key 401s). Confirm a real id by
 * listing templates with a live key, then pin it here. Fixtures mode does not
 * use it, so the demo/build is unaffected.
 */
const HAIRSTYLE_TEMPLATE_ID = "";

export async function tryOnHairstyle(
  person: ImageInput,
  templateId: string = HAIRSTYLE_TEMPLATE_ID,
  opts?: { intervalMs?: number; timeoutMs?: number },
): Promise<RenderedImage> {
  if (env.youcamFixtures) return fixtureHairstyle(person);
  if (!templateId) {
    throw new Error("Hairstyle template not configured (set a live YouCam template_id).");
  }
  const { file, task } = endpointsFor("hairstyle");
  const src = await resolveImage(person, file, "src");
  const results = await runTaskAndWait<UrlResults>(task, { ...src, template_id: templateId }, opts);
  return { url: results.url ?? firstImageUrl(results), raw: results };
}
