import "server-only";

import { env } from "@/lib/env";
import { endpointsFor } from "@/lib/youcam/config";
import { resolveImage, runTaskAndWait } from "@/lib/youcam/client";
import { fixtureHairColor } from "@/lib/youcam/fixtures";
import { firstImageUrl } from "@/lib/youcam/util";
import type { ImageInput, RenderedImage } from "@/lib/youcam/types";

/** AI-Hair-Color success shape: data.results.url (fall back defensively). */
interface UrlResults {
  url?: string;
  output?: { url?: string }[];
}

/**
 * YouCam AI Hair Color: recolor the hair in `person` to a named preset (e.g.
 * "Copper Red", "Ash Gray"). One of the simplest YouCam features — a single
 * `preset` string, reliable on a head-and-shoulders selfie.
 */
export async function tryOnHairColor(
  person: ImageInput,
  preset: string,
  opts?: { intervalMs?: number; timeoutMs?: number },
): Promise<RenderedImage> {
  if (env.youcamFixtures) return fixtureHairColor(person);
  const { file, task } = endpointsFor("hairColor");
  const src = await resolveImage(person, file, "src");
  const results = await runTaskAndWait<UrlResults>(task, { ...src, preset }, opts);
  return { url: results.url ?? firstImageUrl(results), raw: results };
}
