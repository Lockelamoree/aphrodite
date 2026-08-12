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
 *   WARM RELIGHT         CAPTURED 2026-08-12. A real lighting run on samples/full-body.jpg
 *                        (receipts/002). Replaces the deleted finish.jpg, which showed a
 *                        fourth person.
 *   COOL TRY-ON          CAPTURED 2026-08-12. A real cloth-v3 run putting the Sky Wrap
 *                        Maxi Dress on samples/selfie-2.jpg (receipts/003) — the second
 *                        face, wearing what its own colour read selects.
 *
 * WARM HAS NO OVERLAY ON PURPOSE. public/fixtures/skin-overlay.jpg was a DIFFERENT
 * PERSON's face. Serving it next to samples/selfie.jpg made the comparator label one
 * man "your photo" and another "what YouCam sees" — a picture that asserts the API
 * changed someone's face. Removed 2026-08-10. The comparator already degrades to the
 * selfie alone, and an honest empty state beats a lie that looks like a match.
 */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

type DemoProfile = "warm" | "cool";

/**
 * WHO is in the photo, by content fingerprint.
 *
 * Scores and palettes can be labelled illustrative and still be useful. A RENDER
 * cannot: a picture of a face is a claim about whose face it is. So every captured
 * render is keyed to the person it actually depicts, and an unrecognised photo gets
 * no render at all — the honest empty state — instead of a stranger's.
 *
 * Fingerprints are content-based, so they survive a rename; recompute them if an
 * asset is re-encoded.
 */
type SamplePerson = "sampleA" | "sampleSelfie" | "sampleB" | "unknown";

const FNV = {
  /** public/samples/full-body.jpg — the "Wedding · full-body" preset. */
  sampleA: 3557748833,
  /** public/samples/selfie.jpg — bundled, no longer used by a preset. */
  sampleSelfie: 2573357407,
  /** public/samples/selfie-2.jpg — the selfie-only preset. */
  sampleB: 3352317811,
} as const;

function fnv1a(bytes: Uint8Array): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function personOf(input?: ImageInput): SamplePerson {
  if (input?.kind !== "bytes") return "unknown";
  const h = fnv1a(input.data);
  for (const [who, fp] of Object.entries(FNV) as [SamplePerson, number][]) {
    if (h === fp) return who;
  }
  return "unknown";
}

function profileFor(input?: ImageInput): DemoProfile {
  return personOf(input) === "sampleB" ? "cool" : "warm";
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

/**
 * Every captured try-on render, keyed to BOTH the person and the garment.
 *
 * Keying on the garment kind alone was the bug: `renderHint: "dresses"` served a
 * render of a stranger in a red gown to whoever asked, under the title "Your
 * outfit" and the caption "see it on before you buy". Three of the four render
 * fixtures depicted three different people, none of whom was the visitor — the
 * same defect class as public/fixtures/skin-overlay.jpg, deleted 2026-08-10 for
 * showing another man's face beside a photo labelled "your photo", and the P0 that
 * review 001 raised for uploads and that was only half closed.
 *
 * One captured pair survives, because one is all that was ever captured: the
 * wedding sample wearing the Slate Blue Three-Piece Suit. That table has exactly
 * as many rows as there are real renders, and the empty states elsewhere are the
 * honest shape of a demo built on one captured VTO.
 */
const CAPTURED_APPAREL: { person: SamplePerson; garmentId: string; url: string; provenance: string }[] = [
  {
    person: "sampleA",
    garmentId: "slate-suit",
    url: "/fixtures/apparel-suit.jpg",
    provenance: "live cloth-v3 render of samples/full-body.jpg, receipts/000-misaimed-attempt",
  },
  {
    // Captured 2026-08-12 on approval, for the tiebreaker: two faces have to be seen
    // producing two different garments, not merely described as doing so. This is the
    // second face wearing the dress her own colour read selects.
    person: "sampleB",
    garmentId: "sky-wrap-maxi",
    url: "/fixtures/apparel-sky-maxi.jpg",
    provenance: "live cloth-v3 render of samples/selfie-2.jpg, receipts/003, sha256 40ba8d1d…",
  },
];

/**
 * Every captured relight, keyed to the person.
 *
 * public/fixtures/finish.jpg was a FOURTH stranger and carried the whole board as
 * its editorial hero, under alt text reading "Your finished look, relit for the
 * occasion". Deleted. What replaces it is the relight YouCam actually returned on
 * 2026-08-10 — the bytes committed at hackathon/receipts/001/photo_lighting.render.jpg
 * — served only to the face it belongs to.
 */
const CAPTURED_LIGHTING: { person: SamplePerson; url: string; provenance: string }[] = [
  {
    person: "sampleSelfie",
    url: "/fixtures/finish-selfie.jpg",
    provenance: "live lighting render of samples/selfie.jpg, receipts/001, sha256 44cd13b0…",
  },
  {
    // Captured 2026-08-12 on approval. This is the render the deleted finish.jpg
    // pretended to be: the fourth API, on the face the flagship sample actually sends.
    person: "sampleA",
    url: "/fixtures/finish-wedding.jpg",
    provenance: "live lighting render of samples/full-body.jpg, receipts/002, sha256 28237262…",
  },
];

export async function fixtureApparel(
  args: { person?: ImageInput; garmentId?: string; category?: ApparelCategory; renderHint?: string },
): Promise<RenderedImage> {
  await delay(1500);
  const who = personOf(args.person);
  const hit = CAPTURED_APPAREL.find((r) => r.person === who && r.garmentId === args.garmentId);
  if (!hit) {
    // Refuse rather than substitute. The caller turns this into "no captured
    // render for this photo", which is true, where a substituted render would be
    // a picture asserting the API dressed someone it never saw.
    throw new Error("fixture: no captured try-on render for this photo and garment");
  }
  return { url: hit.url, raw: { fixture: true, captured: hit.provenance } };
}

export async function fixtureLighting(input?: ImageInput): Promise<RenderedImage> {
  await delay(900);
  const hit = CAPTURED_LIGHTING.find((r) => r.person === personOf(input));
  if (!hit) {
    throw new Error("fixture: no captured relight for this photo");
  }
  return { url: hit.url, raw: { fixture: true, captured: hit.provenance } };
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
