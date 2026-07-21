import { GARMENT_CATALOG } from "@/lib/concierge/catalog";
import { analyzeColorProfile } from "@/lib/youcam/color";
import { analyzeSkin } from "@/lib/youcam/skin";
import { tryOnApparel } from "@/lib/youcam/apparel";

/**
 * DEV-ONLY vertical-slice harness (plan task #4). Verifies the YouCam REST
 * contract end-to-end and dumps raw + normalized payloads so we can pin the
 * exact v2 schema. Disabled outside development.
 *
 * Usage (after setting YOUCAM_API_KEY in .env.local and `npm run dev`):
 *   /api/dev/verify?image=<https selfie url>&garment=emerald-slip-dress&steps=skin,color,apparel
 */
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "disabled in production" }, { status: 404 });
  }

  const url = new URL(req.url);
  const image = url.searchParams.get("image");
  if (!image) {
    return Response.json(
      {
        error: "pass ?image=<https url of a selfie>",
        garments: GARMENT_CATALOG.map((g) => g.id),
      },
      { status: 400 },
    );
  }
  const steps = (url.searchParams.get("steps") ?? "skin").split(",").map((s) => s.trim());
  const garmentId = url.searchParams.get("garment") ?? GARMENT_CATALOG[0].id;

  const out: Record<string, unknown> = {};
  try {
    if (steps.includes("skin")) {
      out.skin = await analyzeSkin({ kind: "url", url: image });
    }
    if (steps.includes("color")) {
      out.color = await analyzeColorProfile({ kind: "url", url: image });
    }
    if (steps.includes("apparel")) {
      const g = GARMENT_CATALOG.find((x) => x.id === garmentId) ?? GARMENT_CATALOG[0];
      out.apparel = await tryOnApparel({
        person: { kind: "url", url: image },
        garment: { kind: "url", url: g.imageUrl },
        category: g.category,
      });
    }
    return Response.json({ ok: true, ...out });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message, partial: out }, { status: 500 });
  }
}
