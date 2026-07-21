/**
 * Defensive helpers for pulling image URLs out of YouCam task results.
 * Result envelopes vary by endpoint; these walk common shapes. Verify/trim
 * against the live API once the exact schema is confirmed.
 */

export function maybeImageUrl(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const direct = obj.url ?? obj.image_url ?? obj.dst_url ?? obj.output_url;
  if (typeof direct === "string") return direct;
  const list = (obj.data ?? obj.results ?? obj.files ?? obj.dst_ids) as unknown;
  if (Array.isArray(list)) {
    for (const item of list) {
      const u = maybeImageUrl(item);
      if (u) return u;
    }
  }
  return undefined;
}

export function firstImageUrl(raw: unknown): string {
  const url = maybeImageUrl(raw);
  if (!url) throw new Error("No image URL found in task result");
  return url;
}
