import "server-only";

import type { ApparelCategory } from "@/lib/youcam/apparel";
import type { ColorProfile, RenderedImage, SkinAnalysis } from "@/lib/youcam/types";

/**
 * Replay fixtures — real captured YouCam outputs (see public/fixtures/*.jpg and
 * the scores/colors from a verified live run) served WITHOUT calling the API.
 * Gated by env.youcamFixtures (YOUCAM_FIXTURES=1). Lets dev + demo rehearsal
 * consume zero API units; the small delays keep the streaming UX realistic.
 */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fixtureSkin(): Promise<SkinAnalysis> {
  await delay(700);
  const scores: Record<string, number> = {
    dark_circle_v2: 59,
    firmness: 66,
    moisture: 69,
    texture: 71,
    pore: 74,
    wrinkle: 75,
    age_spot: 77,
    oiliness: 84,
    redness: 99,
    acne: 99,
  };
  return {
    concerns: Object.entries(scores).map(([name, score]) => ({ name, score })),
    overlayUrl: "/fixtures/skin-overlay.jpg",
    raw: { fixture: true },
  };
}

export async function fixtureColor(): Promise<ColorProfile> {
  await delay(500);
  return {
    undertone: "warm",
    depth: "medium",
    season: "Warm Spring",
    detected: { skin: "#a88670", eye: "#130f0a", eyeName: "Brown", lip: "#874e46", eyebrow: "#543931" },
    paletteHex: ["#C46A3F", "#D9A441", "#7E8B4E", "#8C4B2F", "#E9D6A8"],
    raw: { fixture: true },
  };
}

export async function fixtureApparel(category?: ApparelCategory): Promise<RenderedImage> {
  await delay(1500);
  // Show a captured render matching the garment category so the label matches
  // the image (a "Crisp White Tee" must not show a suit).
  const url =
    category === "dress"
      ? "/fixtures/apparel-gown.jpg"
      : category === "top"
        ? "/fixtures/apparel-top.jpg"
        : "/fixtures/apparel-suit.jpg";
  return { url, raw: { fixture: true } };
}

export async function fixtureLighting(): Promise<RenderedImage> {
  await delay(900);
  return { url: "/fixtures/finish.jpg", raw: { fixture: true } };
}
