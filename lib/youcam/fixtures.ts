import "server-only";

import type { ApparelCategory } from "@/lib/youcam/apparel";
import type { ColorProfile, ImageInput, RenderedImage, SkinAnalysis } from "@/lib/youcam/types";

/**
 * Replay fixtures — captured YouCam outputs served WITHOUT calling the API.
 * Gated by env.youcamFixtures (YOUCAM_FIXTURES=1), so dev and demo rehearsal cost
 * zero units; the small delays keep the streaming UX realistic.
 *
 * TWO demo profiles so the app doesn't read identically for every photo: the bundled
 * "sample B" selfie (public/samples/selfie-2.jpg) fingerprints to a COOL profile,
 * everything else uses the WARM profile.
 *
 * PROVENANCE — which of these numbers are real. Checked 2026-08-10 against the live
 * API, receipts committed under hackathon/receipts/:
 *
 *   COOL skin scores     CAPTURED. A real skin-analysis run on samples/selfie-2.jpg.
 *   COOL overlay         CAPTURED. That same run's dark-circle mask, of that same
 *                        face — public/fixtures/skin-overlay-cool.jpg.
 *   WARM colour profile  CAPTURED. A real skin-tone run on samples/full-body.jpg
 *                        (skin #b7947d, hair "Auburn"). Undertone, depth and palette
 *                        are derived from that hex by the app's own rules.
 *   WARM skin scores     ILLUSTRATIVE, not captured. The live API rejects
 *                        samples/selfie.jpg with error_src_face_too_small, so no real
 *                        read of that face exists.
 *   COOL colour profile  ILLUSTRATIVE, not captured. The API rejects selfie-2.jpg for
 *                        skin-tone with error_face_not_forward_facing.
 *
 * WARM HAS NO OVERLAY ON PURPOSE. public/fixtures/skin-overlay.jpg was a DIFFERENT
 * PERSON's face. Serving it next to samples/selfie.jpg made the comparator label one
 * man "your photo" and another "what YouCam sees" — a picture that asserts the API
 * changed someone's face. Removed 2026-08-10. The comparator already degrades to the
 * selfie alone, and an honest empty state beats a lie that looks like a match.
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
  // Cool sample (public/samples/selfie-2.jpg) — CAPTURED, not composed. These are the
  // ui_score values a real skin-analysis run returned for this exact photo on
  // 2026-08-10; see hackathon/receipts/. Lowest two are dark circles and moisture,
  // which is what the plan then prioritises.
  cool: {
    dark_circle_v2: 68,
    moisture: 68,
    wrinkle: 82,
    firmness: 83,
    pore: 84,
    texture: 86,
    age_spot: 91,
    acne: 99,
    oiliness: 99,
    redness: 99,
  },
};

const COLOR_PROFILE: Record<DemoProfile, ColorProfile> = {
  // CAPTURED. Real skin-tone run on samples/full-body.jpg, 2026-08-10 — the API
  // returned skin #b7947d, eye #000000, lip #986861, eyebrow #3e3834, hair "Auburn",
  // with face_quality good on every axis. Receipt in hackathon/receipts/.
  warm: {
    undertone: "warm",
    depth: "medium",
    season: "Warm Spring",
    detected: { skin: "#b7947d", eye: "#000000", eyeName: "Brown", lip: "#986861", eyebrow: "#3e3834" },
    paletteHex: ["#C46A3F", "#D9A441", "#7E8B4E", "#8C4B2F", "#E9D6A8"],
    raw: { fixture: true, captured: "2026-08-10 skin-tone-analysis on samples/full-body.jpg" },
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
    // Only the COOL sample has a mask captured from its own face. The warm sample gets
    // none — see the provenance note at the top of this file. Never serve a mask taken
    // from a different person beside a photo labelled "your photo".
    overlayUrl: profile === "cool" ? "/fixtures/skin-overlay-cool.jpg" : undefined,
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

/**
 * Studio-experience fixtures (hair color / hairstyle / makeup). Each needs a
 * REAL captured render of the warm sample selfie — none are captured yet (the
 * demo YouCam key 401s, so we can't generate them here). Until then these return
 * an EMPTY url so the studio flow shows an honest "connect YouCam to try this"
 * state — never a fabricated render, and never the warm person's render pasted
 * onto another face. Once public/fixtures/studio-*.jpg exist (captured with a
 * valid key), flip HAS_STUDIO_RENDERS to true to light them up in demo mode.
 */
const HAS_STUDIO_RENDERS = false;

async function studioFixture(input: ImageInput | undefined, file: string): Promise<RenderedImage> {
  await delay(1400);
  if (!HAS_STUDIO_RENDERS || profileFor(input) !== "warm") return { url: "", raw: { fixture: true } };
  return { url: file, raw: { fixture: true } };
}

export function fixtureHairColor(input?: ImageInput): Promise<RenderedImage> {
  return studioFixture(input, "/fixtures/studio-hair-color.jpg");
}

export function fixtureHairstyle(input?: ImageInput): Promise<RenderedImage> {
  return studioFixture(input, "/fixtures/studio-hairstyle.jpg");
}

export function fixtureMakeup(input?: ImageInput): Promise<RenderedImage> {
  return studioFixture(input, "/fixtures/studio-makeup.jpg");
}
