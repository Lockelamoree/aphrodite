import "server-only";

import type { ApparelCategory } from "@/lib/youcam/apparel";
import type { ColorProfile, ImageInput, RenderedImage, SkinAnalysis } from "@/lib/youcam/types";

/**
 * Replay fixtures — real captured YouCam outputs (see public/fixtures/*.jpg and
 * the scores/colors from a verified live run) served WITHOUT calling the API.
 * Gated by env.youcamFixtures (YOUCAM_FIXTURES=1). Lets dev + demo rehearsal
 * consume zero API units; the small delays keep the streaming UX realistic.
 *
 * TWO demo profiles so the app doesn't read identically for every photo: the
 * bundled "sample B" selfie (public/samples/selfie-2.jpg) fingerprints to a
 * distinct COOL "Cool Summer" profile (different scores + palette + undertone),
 * everything else uses the original WARM profile. The rendered face/body assets
 * are captured from the warm sample, so the cool profile is intentionally
 * selfie-only (no apparel render, no face-mask overlay) — it exercises the
 * honest "add a full-body photo" path instead of pasting one person's render
 * onto another.
 */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

type DemoProfile = "warm" | "cool";

/** FNV-1a fingerprint of public/samples/selfie-2.jpg (content-based, so it
 * survives renames; recompute if that asset is re-encoded). */
const SAMPLE_B_FNV = 3352317811;

function fnv1a(bytes: Uint8Array): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function profileFor(input?: ImageInput): DemoProfile {
  if (input?.kind === "bytes" && fnv1a(input.data) === SAMPLE_B_FNV) return "cool";
  return "warm";
}

const SKIN_SCORES: Record<DemoProfile, Record<string, number>> = {
  // Warm sample (public/samples/selfie.jpg) — lowest = dark circles.
  warm: {
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
  },
  // Cool sample (public/samples/selfie-2.jpg) — a different person, so a
  // genuinely different read: lowest = redness, then moisture.
  cool: {
    redness: 61,
    moisture: 64,
    pore: 70,
    texture: 73,
    oiliness: 76,
    dark_circle_v2: 80,
    firmness: 82,
    wrinkle: 85,
    age_spot: 88,
    acne: 95,
  },
};

const COLOR_PROFILE: Record<DemoProfile, ColorProfile> = {
  warm: {
    undertone: "warm",
    depth: "medium",
    season: "Warm Spring",
    detected: { skin: "#a88670", eye: "#130f0a", eyeName: "Brown", lip: "#874e46", eyebrow: "#543931" },
    paletteHex: ["#C46A3F", "#D9A441", "#7E8B4E", "#8C4B2F", "#E9D6A8"],
    raw: { fixture: true },
  },
  cool: {
    undertone: "cool",
    depth: "light",
    season: "Cool Summer",
    detected: { skin: "#dcbcae", eye: "#5b6b62", eyeName: "Hazel", lip: "#b56f78", eyebrow: "#6b4f43" },
    paletteHex: ["#6C8EBF", "#9AA7C7", "#B47B9E", "#5E7E8C", "#D8DCE8"],
    raw: { fixture: true },
  },
};

export async function fixtureSkin(input?: ImageInput): Promise<SkinAnalysis> {
  await delay(700);
  const profile = profileFor(input);
  const scores = SKIN_SCORES[profile];
  return {
    concerns: Object.entries(scores).map(([name, score]) => ({ name, score })),
    // Only the warm sample has a captured AR mask that matches its face; the
    // cool sample shows the selfie alone (no fabricated overlay).
    overlayUrl: profile === "warm" ? "/fixtures/skin-overlay.jpg" : undefined,
    raw: { fixture: true },
  };
}

export async function fixtureColor(input?: ImageInput): Promise<ColorProfile> {
  await delay(500);
  return COLOR_PROFILE[profileFor(input)];
}

export async function fixtureApparel(
  category?: ApparelCategory,
  renderHint?: string,
): Promise<RenderedImage> {
  await delay(1500);
  // Prefer the WARDROBE render hint so the fixture matches what the garment
  // actually is (a "separates" blazer set must not show the grey men's suit,
  // even though its VTO category is "full"); fall back to category.
  const byWardrobe =
    renderHint === "dresses"
      ? "/fixtures/apparel-gown.jpg"
      : renderHint === "separates"
        ? "/fixtures/apparel-top.jpg"
        : renderHint === "suits"
          ? "/fixtures/apparel-suit.jpg"
          : undefined;
  const byCategory =
    category === "dress"
      ? "/fixtures/apparel-gown.jpg"
      : category === "top"
        ? "/fixtures/apparel-top.jpg"
        : "/fixtures/apparel-suit.jpg";
  return { url: byWardrobe ?? byCategory, raw: { fixture: true } };
}

export async function fixtureLighting(input?: ImageInput): Promise<RenderedImage> {
  await delay(900);
  // The finish is a relit version of the selfie. The cool sample has no captured
  // relight — so rather than pass off the untouched upload as a "relight" (which
  // would undercut the honesty story on the very journey that showcases it), we
  // signal "no lighting pass this run" and let the UI show its honest empty state.
  if (profileFor(input) === "cool") {
    throw new Error("fixture: no captured relight for this sample");
  }
  return { url: "/fixtures/finish.jpg", raw: { fixture: true } };
}
