import "server-only";

import {
  completeTheLook,
  findGarment,
  GARMENT_CATALOG,
  garmentMatchesCut,
  garmentMatchesPreference,
  skincareSkuFor,
  type CatalogGarment,
  type Formality,
} from "@/lib/concierge/catalog";
import { prettyConcern } from "@/lib/concierge/format";
import { imageInputFromString } from "@/lib/concierge/image";
import { parseOccasion, type OccasionType } from "@/lib/concierge/occasion";
import { TOOL, labelFor } from "@/lib/concierge/tools";
import type {
  ConciergeEvent,
  ConciergeRequest,
  GarmentPreference,
  CountdownStep,
  LookBoard,
  RefineAdjust,
  ShoppingItem,
  SkinGoal,
  StyleTrack,
  CutPreference,
} from "@/lib/concierge/types";
import { analyzeColorProfile } from "@/lib/youcam/color";
import { analyzeSkin } from "@/lib/youcam/skin";
import { applyLighting } from "@/lib/youcam/lighting";
import { tryOnApparel } from "@/lib/youcam/apparel";
import type { ColorProfile, SkinConcern } from "@/lib/youcam/types";

/**
 * Deterministic, no-Claude concierge. Runs the same YouCam pipeline as the
 * agentic engine and emits the identical ConciergeEvent stream, but decides
 * everything with rules. Lets the app qualify and demo with only a YouCam key.
 *
 * Skin scores are 0–100 HEALTH (higher = healthier); the concerns needing
 * attention are the LOWEST-scoring ones.
 */
export async function* runDeterministic(
  req: ConciergeRequest,
): AsyncGenerator<ConciergeEvent> {
  const person = imageInputFromString(req.personImage);
  const hasBody = Boolean(req.bodyImage);
  const body = req.bodyImage ? imageInputFromString(req.bodyImage) : person;
  const { type, daysUntil } = parseOccasion(req.occasion);
  const track = req.track ?? "style";

  yield* say(`Hi, I'm Aphrodite ✨ For your ${stripLeadingArticle(req.occasion)}, let's get you ready to shine. First, a look at your skin with YouCam.`);

  // --- skin (focus = LOWEST-health concerns) ---
  let focus: SkinConcern[] = [];
  try {
    yield step(TOOL.analyzeSkin);
    const skin = await analyzeSkin(person);
    yield { type: "skin", analysis: skin };
    if (skin.overlayUrl) yield { type: "image", slot: "skinOverlay", url: skin.overlayUrl };
    focus = selectFocus(skin.concerns, req.skinGoal);
    if (focus.length) {
      yield* say(`${skinReadLead(focus)}; ${focusIntro(req.skinGoal, focus)}`);
    }
  } catch {
    yield* say(`(I couldn't complete the skin scan this time — I'll plan from occasion and color.)`);
  }

  // --- color (grooming track swaps color-season framing for grooming) ---
  let color: ColorProfile | undefined;
  if (track !== "grooming") {
    try {
      yield step(TOOL.analyzeColor);
      color = await analyzeColorProfile(person);
      yield { type: "color", profile: color };
      if (color.undertone) {
        yield* say(
          `YouCam's color analysis reads your undertone as ${color.undertone}${color.season ? ` (${color.season})` : ""} — best in the palette on the right.`,
        );
      }
    } catch {
      /* soft-skip */
    }
  }

  // --- apparel ---
  const garment = pickGarment(type, color?.undertone, {
    preference: req.garmentPreference ?? "surprise",
    cut: req.cutPreference ?? "any",
    track,
  });
  const occ = type ?? "special occasion";
  if (garment && hasBody) {
    yield* say(`I'd put you in the ${garment.name} — ${fitPhrase(garment.formality, type, occ)}${garmentColorClause(garment, color?.undertone)}.`);
    try {
      yield step(TOOL.tryOnApparel);
      const img = await tryOnApparel(
        {
          person: body,
          garment: { kind: "url", url: garment.imageUrl },
          category: garment.category,
          renderHint: garment.wardrobe,
        },
        // Fail fast (interactive budget) so a slow render doesn't block the
        // finish + board behind the full 120s poll timeout.
        { timeoutMs: 60_000 },
      );
      yield { type: "image", slot: "apparel", url: img.url };
    } catch {
      yield* say(`(The outfit render didn't come through — the rest of your look board is ready.)`);
    }
  } else if (garment) {
    yield* say(`For the outfit I'd choose the ${garment.name} — upload a full-body photo to see it rendered on you.`);
  }

  // --- occasion finishing pass: YouCam Photo-Lighting relight of the selfie ---
  try {
    yield { type: "tool_start", name: "finish", label: "YouCam Photo Lighting" };
    const lit = await applyLighting(person);
    yield { type: "image", slot: "finish", url: lit.url };
    yield* say(`A final YouCam lighting pass, so you're camera-ready for the day.`);
  } catch {
    /* finishing render is optional */
  }

  // --- assemble board ---
  yield step(TOOL.presentLookBoard);
  yield { type: "board", board: buildBoard(req.occasion, type, daysUntil, focus, color, garment, track, req.skinGoal) };
}

const REFINE_LEAD: Record<RefineAdjust, string> = {
  less_formal: "Dialing it back a notch — restyling your outfit.",
  more_formal: "Taking it up a notch — restyling your outfit.",
  cooler: "Shifting to cooler tones — restyling your outfit.",
  warmer: "Shifting to warmer tones — restyling your outfit.",
  reroll: "Trying a different direction — restyling your outfit.",
};

/**
 * What to say when a refine ran — checked against what actually changed.
 *
 * The tone leads above were previously said unconditionally, so pressing "Cooler"
 * announced "Shifting to cooler tones" even when the wardrobe had nothing cooler
 * and the replacement garment was warm or neutral. That is a claim about the
 * result, made before checking the result, and it is the same class of error as
 * claiming an undertone match the catalogue cannot satisfy.
 *
 * A tone refine now only claims the shift when the chosen garment really does
 * flatter the requested tone. Otherwise it says what is true: the direction was
 * understood, the wardrobe cannot honour it, here is the closest thing.
 */
export function refineLead(adjust: RefineAdjust, garment: CatalogGarment | undefined): string {
  if (adjust !== "cooler" && adjust !== "warmer") return REFINE_LEAD[adjust];
  const wanted = adjust === "cooler" ? "cool" : "warm";
  if (garment && (garment.flatters === wanted || garment.flatters === "neutral")) {
    return REFINE_LEAD[adjust];
  }
  return `I don't have anything ${wanted}er that still suits the occasion — here's the closest match instead.`;
}

/**
 * Refinement pass: re-style the OUTFIT only, reusing the prior skin/color that
 * the client passes back — so it's fast and doesn't re-spend units on the
 * unchanged reads. Emits no skin/color events (the client keeps them) and
 * patches the board in place. Rule-based, so it runs identically in any mode.
 */
export async function* runRefineDeterministic(
  req: ConciergeRequest,
): AsyncGenerator<ConciergeEvent> {
  const refine = req.refine;
  if (!refine) return;
  const person = imageInputFromString(req.personImage);
  const hasBody = Boolean(req.bodyImage);
  const body = req.bodyImage ? imageInputFromString(req.bodyImage) : person;
  const { type, daysUntil } = parseOccasion(req.occasion);
  const track = req.track ?? "style";
  const undertone = refine.undertone;
  const focus = refine.concerns ? selectFocus(refine.concerns, req.skinGoal) : [];
  // On a tone refine, don't cite the user's original undertone (they asked to
  // shift AWAY from it) — the requested direction is already narrated below.
  const toneRefine = refine.adjust === "cooler" || refine.adjust === "warmer";
  const color: ColorProfile | undefined =
    undertone && !toneRefine ? { undertone, paletteHex: [] } : undefined;
  const currentId = refine.currentGarmentId;

  const toneAdjust = refine.adjust === "cooler" || refine.adjust === "warmer";
  const currentGarment = currentId ? findGarment(currentId) : undefined;
  const garment = pickGarment(type, undertone, {
    adjust: refine.adjust,
    exclude: refine.adjust === "reroll" ? currentId : undefined,
    preference: req.garmentPreference ?? "surprise",
    cut: req.cutPreference ?? "any",
    track,
    // A tone shift shouldn't change the KIND of garment — keep dresses as dresses.
    keepWardrobe: toneAdjust ? currentGarment?.wardrobe : undefined,
  });
  const changed = Boolean(garment && garment.id !== currentId);

  if (garment && !changed) {
    // The rules already had this as the best match — say so honestly (don't
    // promise a restyle we won't deliver) and keep the current render.
    yield* say(`That's already the strongest match for your ${type ?? "occasion"} — I'll keep this look.`);
  } else if (garment && hasBody) {
    yield* say(refineLead(refine.adjust, garment));
    yield* say(`This time: the ${garment.name} (${garment.formality}).`);
    try {
      yield step(TOOL.tryOnApparel);
      const img = await tryOnApparel(
        { person: body, garment: { kind: "url", url: garment.imageUrl }, category: garment.category, renderHint: garment.wardrobe },
        { timeoutMs: 60_000 },
      );
      yield { type: "image", slot: "apparel", url: img.url };
    } catch {
      yield* say(`(The new outfit render didn't come through — the rest of your board is updated.)`);
    }
  } else if (garment) {
    yield* say(refineLead(refine.adjust, garment));
    yield* say(`I'd switch you to the ${garment.name} — add a full-body photo to see it on you.`);
  }

  // No relight on refine: the selfie is unchanged, so the prior "finish" render
  // still applies (the client keeps it) — re-running would waste a unit.

  yield step(TOOL.presentLookBoard);
  yield { type: "board", board: buildBoard(req.occasion, type, daysUntil, focus, color, garment, track, req.skinGoal) };
}

/* ---------------- rule tables ---------------- */

interface Advice {
  action: string;
  category: string;
  why: string;
}

const CONCERN_ADVICE: Record<string, Advice> = {
  acne: { action: "spot-treat blemishes nightly and avoid picking", category: "spot treatment", why: "Clears active breakouts before the day." },
  wrinkle: { action: "layer a peptide serum at night", category: "peptide serum", why: "Softens fine lines over the run-up." },
  dark_circle_v2: { action: "pat on a caffeine eye cream morning and night", category: "caffeine eye cream", why: "Brightens and de-puffs the under-eye." },
  age_spot: { action: "use a vitamin C serum each morning", category: "vitamin C serum", why: "Evens tone and adds glow." },
  redness: { action: "calm flushing with a centella/cica moisturizer", category: "soothing moisturizer", why: "Keeps skin even and camera-ready." },
  oiliness: { action: "balance oil with a niacinamide serum", category: "niacinamide serum", why: "Controls shine for photos." },
  pore: { action: "refine pores with a BHA exfoliant twice a week", category: "BHA exfoliant", why: "Smooths the surface for makeup." },
  texture: { action: "smooth texture with a gentle AHA exfoliant twice a week", category: "AHA exfoliant", why: "Gives an even makeup base." },
  firmness: { action: "support firmness with a peptide moisturizer", category: "firming moisturizer", why: "Adds bounce and lift." },
  moisture: { action: "boost hydration with a hyaluronic acid serum twice daily", category: "hydrating serum", why: "Plumps and preps the skin." },
  radiance: { action: "bring back glow with vitamin C daily", category: "brightening serum", why: "Delivers lit-from-within radiance." },
  eye_bag: { action: "de-puff with a chilled roller and caffeine eye cream", category: "caffeine eye cream", why: "Reduces morning puffiness." },
};

function adviceFor(name: string): Advice {
  return (
    CONCERN_ADVICE[name] ?? {
      action: `care for ${prettyConcern(name)} with a targeted serum`,
      category: `${prettyConcern(name)} treatment`,
      why: "Improves this area before the day.",
    }
  );
}

/* ---------------- selection + builders ---------------- */

const OCCASION_FORMALITY: Record<string, Formality> = {
  wedding: "formal",
  gala: "formal",
  interview: "formal",
  work: "smart",
  date: "smart",
  party: "smart",
  brunch: "casual",
};

const FORMALITY_ORDER: Formality[] = ["casual", "smart", "formal"];
function shiftFormality(f: Formality | undefined, dir: -1 | 1): Formality | undefined {
  if (!f) return f;
  const i = FORMALITY_ORDER.indexOf(f);
  return FORMALITY_ORDER[Math.max(0, Math.min(FORMALITY_ORDER.length - 1, i + dir))];
}

interface PickHint {
  adjust?: RefineAdjust;
  exclude?: string;
  preference?: GarmentPreference;
  /** Tone refines keep the current garment's wardrobe (a gown stays a gown). */
  keepWardrobe?: string;
  /** Self-selected styling track; "grooming" forces a masculine-cut suit. */
  track?: StyleTrack;
  /** Explicit cut preference. "any"/undefined = the shopper hasn't said. */
  cut?: CutPreference;
}

export function pickGarment(
  type: OccasionType | undefined,
  undertone?: string,
  hint?: PickHint,
): CatalogGarment | undefined {
  let flatters = undertone?.toLowerCase().includes("warm")
    ? "warm"
    : undertone?.toLowerCase().includes("cool")
      ? "cool"
      : undefined;
  let wantFormality = type ? OCCASION_FORMALITY[type] : undefined;

  // Refinement adjustments override the natural preference.
  const typePool = type ? GARMENT_CATALOG.filter((g) => g.occasions.includes(type)) : GARMENT_CATALOG;
  let broaden = typePool.length === 0;
  const formalityAdjust = hint?.adjust === "less_formal" || hint?.adjust === "more_formal";
  switch (hint?.adjust) {
    case "cooler":
    case "warmer":
      flatters = hint.adjust === "cooler" ? "cool" : "warm";
      // Broaden only if the occasion pool can't honor the requested tone.
      if (!typePool.some((g) => g.flatters === flatters)) broaden = true;
      break;
    case "less_formal":
      wantFormality = shiftFormality(wantFormality, -1);
      broaden = true; // catalog-wide so a different-formality piece can surface
      break;
    case "more_formal":
      wantFormality = shiftFormality(wantFormality, 1);
      broaden = true;
      break;
    case "reroll":
      broaden = true; // "try another" needs the whole catalog to have options
      break;
  }

  let candidates = broaden ? GARMENT_CATALOG : typePool;
  // Grooming is a masculine-presenting track: always a suit, and never a
  // women's cut. It overrides any wardrobe preference the shopper set.
  const grooming = hint?.track === "grooming";
  const preference = grooming ? "suits" : (hint?.preference ?? "surprise");
  // The effective cut preference. Grooming implies "masculine" even when the
  // shopper never touched the cut control; otherwise only an explicit choice
  // counts. Nothing here looks at the photo.
  const cutPref: CutPreference = grooming ? "masculine" : (hint?.cut ?? "any");
  if (preference !== "surprise") {
    const preferred = candidates.filter((g) => garmentMatchesPreference(g, preference));
    candidates = preferred.length
      ? preferred
      : GARMENT_CATALOG.filter((g) => garmentMatchesPreference(g, preference));
  }
  if (cutPref !== "any") {
    // Applies on EVERY track, not just grooming. Previously the cut filter was
    // gated on `track === "grooming"`, so a shopper on the default styling track
    // could be dressed in any cut — and because the catalog is overwhelmingly
    // feminine, a masculine-presenting person was reliably handed a gown.
    const matching = candidates.filter((g) => garmentMatchesCut(g, cutPref));
    candidates = matching.length
      ? matching
      : GARMENT_CATALOG.filter((g) => garmentMatchesCut(g, cutPref));
  }
  if (hint?.exclude) {
    const filtered = candidates.filter((g) => g.id !== hint.exclude);
    if (filtered.length) candidates = filtered;
  }

  // Score: formality-fit for the occasion DOMINATES, then undertone match is a
  // tie-breaker. Occasion-appropriateness must win — a warm undertone can't put
  // a formal gown on a casual date. Explicit formality shifts weight even higher
  // (6) so the button can never invert.
  const wf = wantFormality ? FORMALITY_ORDER.indexOf(wantFormality) : -1;
  const scored = candidates.map((g) => {
    // Undertone match; the neutral "versatile" nudge only applies when we
    // actually read an undertone — otherwise (e.g. the grooming track, which
    // skips color) it wrongly lets a neutral piece outrank an undertone-matched
    // one purely on the bonus (a women's neutral pantsuit beating the men's suit).
    const undertoneScore =
      (flatters && g.flatters === flatters ? 2 : 0) + (flatters && g.flatters === "neutral" ? 0.5 : 0);
    const dist = wf < 0 ? 0 : Math.abs(FORMALITY_ORDER.indexOf(g.formality) - wf);
    const weight = formalityAdjust ? 6 : 4;
    const formalityScore = wf < 0 ? 0 : weight * Math.max(0, 1 - dist * 0.9);
    // Cycle 3 added an unconditional lean toward dresses/separates on "Surprise
    // me" so a cool-undertone woman wouldn't default into the men's suit. That
    // fix is still right for its case and is kept — but it must not survive an
    // explicit "masculine", or the lean would push a masculine shopper straight
    // back off the only menswear suit in the catalog.
    //
    // Note what this means: with no stated cut, the lean IS a soft feminine
    // default. That is defensible only because the catalog is 9 feminine to 1
    // masculine — so the UI asks for the cut before the first result instead of
    // relying on it. "any" is not a neutral option here, and pretending it is was
    // the root of the masculine-sample-in-a-gown bug.
    const defaultLean =
      preference === "surprise" && cutPref !== "masculine" && g.wardrobe !== "suits" ? 0.1 : 0;
    // Tone-only refines (cooler/warmer) keep the same KIND of garment, so a gown
    // stays a gown instead of flipping into a suit on a score tie.
    const continuity = hint?.keepWardrobe && g.wardrobe === hint.keepWardrobe ? 3 : 0;
    return { g, score: undertoneScore + formalityScore + defaultLean + continuity };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.g;
}

function buildBoard(
  occasion: string,
  type: OccasionType | undefined,
  daysUntil: number | undefined,
  focus: SkinConcern[],
  color: ColorProfile | undefined,
  garment: CatalogGarment | undefined,
  track: StyleTrack = "style",
  goal?: SkinGoal,
): LookBoard {
  // Build the countdown once and hand it to buildShopping so every "→ category"
  // pointer the countdown shows resolves to a real basket row (no orphan chips).
  const countdown = buildCountdown(focus, daysUntil, track);
  return {
    occasion: occasion.trim(),
    daysUntil,
    headline: type ? `Your ${titleCase(type)} Look` : "Your Occasion Look",
    narrative: buildNarrative(type, daysUntil, focus, color, garment, track, goal),
    countdown,
    shopping: buildShopping(focus, garment, color, daysUntil, track, countdown),
    garmentId: garment?.id,
  };
}

/** How far away the event is — governs countdown KIND, narrative, and shopping. */
type Horizon = "long" | "mid" | "near" | "imminent";
function horizonBucket(daysUntil?: number): Horizon {
  const d = daysUntil ?? 21;
  if (d >= 15) return "long";
  if (d >= 5) return "mid";
  if (d >= 3) return "near";
  return "imminent";
}

/** "a"/"an" for the following word. */
function articleFor(word: string): string {
  return /^[aeiou]/i.test(word.trim()) ? "an" : "a";
}

/** Drop a leading article so a raw occasion reads cleanly after "your"/"for". */
function stripLeadingArticle(s: string): string {
  return s.trim().replace(/^(an?|the)\s+/i, "");
}

/** An HONEST color clause: only claim an undertone match when the garment
 * actually flatters it; a neutral piece gets a versatile framing; a mismatch
 * says nothing about color (so we never tell a warm user a cool suit is "warm").
 * Returns a leading-space fragment, or "" when nothing truthful can be said. */
function garmentColorClause(g: CatalogGarment, undertone?: string): string {
  if (!undertone) return "";
  const u = undertone.toLowerCase();
  if ((g.flatters === "warm" && u.includes("warm")) || (g.flatters === "cool" && u.includes("cool"))) {
    return ` in ${undertone} tones that flatter you`;
  }
  if (g.flatters === "neutral") return ` in a versatile shade that works with your coloring`;
  return "";
}

/** Describe how a garment's formality fits the occasion, without the old
 * "formal enough for a date" contradiction (a gown is not "formal enough" for
 * a date — it's a step up). */
function fitPhrase(f: Formality, type: OccasionType | undefined, occ: string): string {
  const art = articleFor(occ);
  const want = type ? OCCASION_FORMALITY[type] : undefined;
  if (!want) return `a fitting choice for ${art} ${occ}`;
  const gi = FORMALITY_ORDER.indexOf(f);
  const wi = FORMALITY_ORDER.indexOf(want);
  if (gi > wi) return `an elevated, dressed-up choice for ${art} ${occ}`;
  if (gi < wi) return `an easy, relaxed choice for ${art} ${occ}`;
  return `right for ${art} ${occ}`;
}

/**
 * Choose the 2–3 concerns to focus on. By default that's the lowest-health
 * (most room) concerns; a skin GOAL reweights "room" so the same scores can
 * prioritize e.g. firmness for "smooth & firm" or breakouts for "clear".
 */
const GOAL_WEIGHTS: Record<Exclude<SkinGoal, "balanced">, Record<string, number>> = {
  glow: { moisture: 1.7, radiance: 1.8, oiliness: 1.4, redness: 1.3, texture: 1.2 },
  firm: { firmness: 1.8, wrinkle: 1.6, texture: 1.3, pore: 1.2 },
  clear: { acne: 1.8, oiliness: 1.5, pore: 1.4, redness: 1.3 },
  even: { age_spot: 1.8, redness: 1.5, texture: 1.2, dark_circle_v2: 1.2 },
};

function selectFocus(concerns: SkinConcern[], goal?: SkinGoal): SkinConcern[] {
  const weights = goal && goal !== "balanced" ? GOAL_WEIGHTS[goal] : undefined;
  return [...concerns]
    .map((c) => ({ c, room: (100 - c.score) * (weights?.[c.name] ?? 1) }))
    .sort((a, b) => b.room - a.room)
    .slice(0, 3)
    .map((x) => x.c);
}

function buildNarrative(
  type: OccasionType | undefined,
  daysUntil: number | undefined,
  focus: SkinConcern[],
  color: ColorProfile | undefined,
  garment: CatalogGarment | undefined,
  track: StyleTrack = "style",
  goal?: SkinGoal,
): string {
  const bucket = horizonBucket(daysUntil);
  const treatable = bucket === "long" || bucket === "mid";
  const lowest = focus[0]
    ? `${prettyConcern(focus[0].name)} (${Math.round(focus[0].score)}/100)`
    : undefined;
  const span =
    daysUntil === undefined ? "the next few weeks" : `the next ${horizonLabel(daysUntil)}`;

  let skinBit: string;
  if (lowest && treatable) {
    skinBit = `${skinReadLead(focus)} — we'll use ${span} to support your priority area, ${lowest}`;
  } else if (lowest) {
    const toGo =
      daysUntil !== undefined && daysUntil <= 0
        ? "with the event today"
        : daysUntil === 1
          ? "with only a day to go"
          : `with only ${horizonLabel(daysUntil ?? 0)} to go`;
    skinBit = `${skinReadLead(focus)} — ${toGo}, we'll protect and support your priority area, ${lowest}, rather than start anything new`;
  } else {
    skinBit = `We'll keep your skin hydrated and calm over ${span}`;
  }

  const styleBit = garment
    ? `, and dress you in the ${garment.name}${garmentColorClause(garment, color?.undertone)}`
    : "";
  const close =
    track === "grooming" ? "groomed, sharp, and put-together" : goalClose(goal, treatable);
  const assumed =
    daysUntil === undefined
      ? " (I planned for about three weeks — tell me the date for a tighter countdown.)"
      : "";
  return `${skinBit}${styleBit}. Follow the plan below and you'll walk in looking ${close}.${assumed}`;
}

/**
 * Countdown that differs in KIND by how far away the event is — the whole point
 * of the "occasion" framing. Short horizons forbid new actives and pivot to
 * hydration + soft complexion prep; long horizons front-load the lowest-health concern.
 */
function buildCountdown(
  focus: SkinConcern[],
  daysUntil?: number,
  track: StyleTrack = "style",
): CountdownStep[] {
  const primary = focus[0] ? adviceFor(focus[0].name) : adviceFor("moisture");
  const secondary = focus[1] ? adviceFor(focus[1].name) : undefined;
  const focusLabel = focus[0]
    ? `${prettyConcern(focus[0].name)} (${Math.round(focus[0].score)}/100)`
    : "hydration";
  const d = daysUntil ?? 21;

  // Each step carries an `order` = roughly days-before-the-event, so the final
  // list is sorted strictly chronologically regardless of what we push (the
  // grooming step used to land out of order on short horizons).
  // Each step carries an `order` = roughly days-before-the-event so the final
  // list sorts strictly chronologically. `productCategory` is set ONLY on steps
  // that point at something the basket actually sells (buildShopping unions
  // these in); behaviour steps ("get a full night's sleep", "trim your beard")
  // carry no chip, so no "→ product" pointer ever dangles.
  const items: { order: number; step: CountdownStep }[] = [];
  const push = (order: number, when: string, action: string, productCategory?: string) =>
    items.push({ order, step: { when, action, ...(productCategory ? { productCategory } : {}) } });

  if (d >= 15) {
    push(
      d,
      `${horizonLabel(d)} out`,
      `Front-load your priority area, ${focusLabel}: ${primary.action}${secondary ? `; also ${secondary.action}` : ""}.`,
      primary.category,
    );
    push(
      7,
      "1 week out",
      "Keep the routine, add a hydrating mask twice this week, and stop any strong actives 3 days out.",
      "hydrating mask",
    );
  } else if (d >= 5) {
    push(
      d,
      `${horizonLabel(d)} out`,
      `Gently target ${focusLabel} — ${primary.action} — and lock your routine in now.`,
      primary.category,
    );
    push(
      2.5,
      "A few days out",
      "Keep it consistent and stop any strong actives 2 days before, so skin is calm on the day.",
    );
  } else if (d >= 3) {
    push(
      d,
      "Now",
      `Too close to start new actives — double down on hydration and calming to soothe ${focusLabel}; no experiments.`,
      "soothing moisturizer",
    );
  } else {
    push(
      Math.max(d, 1.2),
      d <= 0 ? "Today" : "The final day or two",
      `No skincare changes this close — hydrate, de-puff, and we'll soften the look of ${focusLabel} on the day.`,
      "hydrating sheet mask",
    );
  }

  if (track === "grooming") {
    // Behaviour step (the kit itself is already in the basket) — no chip.
    if (d >= 3) {
      push(2, "2 days before", "Sharpen up: trim and tidy your beard and hairline, and exfoliate so skin looks fresh, not shiny.");
    } else {
      push(0.8, "The night before", "Sharpen up: trim and tidy your beard and hairline so you look fresh, not shiny.");
    }
  }

  // A distinct "Night before" step only when the event isn't already imminent:
  // for d<3 the final-day step covers tonight, so a second night-before would
  // duplicate it (and tell someone with an event *today* to get a full night's
  // sleep). Behaviour step — no chip.
  if (d >= 3) {
    push(0.5, "Night before", "Hydrate, get a full night's sleep, and don't try any new product.");
  }

  push(
    0,
    d <= 0 ? "A few hours before" : "Event day",
    track === "grooming"
      ? "Cleanse, moisturize, and apply SPF — a matte finish keeps skin looking fresh, not shiny."
      : "Cleanse, moisturize, apply SPF, then a smoothing primer for an even, camera-ready base.",
    track === "grooming" ? "matte moisturizer" : "primer + SPF",
  );

  return items.sort((a, b) => b.order - a.order).map((i) => i.step);
}

function buildShopping(
  focus: SkinConcern[],
  garment: CatalogGarment | undefined,
  color: ColorProfile | undefined,
  daysUntil: number | undefined,
  track: StyleTrack = "style",
  countdown: CountdownStep[] = [],
): ShoppingItem[] {
  const items: ShoppingItem[] = [];
  const seen = new Set<string>();
  // Each skincare row resolves to a priced SKU so the retail basket is legible.
  const add = (category: string, why: string) => {
    if (seen.has(category)) return;
    seen.add(category);
    const sku = skincareSkuFor(category);
    items.push({
      id: itemId("beauty", sku.category),
      kind: "beauty",
      category: sku.category,
      why,
      price: sku.price,
      retailer: sku.retailer,
      url: sku.url,
      imageUrl: sku.imageUrl,
      inStock: true,
    });
  };

  const bucket = horizonBucket(daysUntil);
  if (bucket === "near" || bucket === "imminent") {
    // Too close for new actives — recommend only the day-of kit the countdown
    // actually endorses, never the active treatments it tells you not to start.
    add("hydrating sheet mask", "Plumps and preps skin the night before.");
    add("de-puff roller", "Chilled — de-puffs the under-eye fast.");
    add("primer + SPF", "A smooth, protected base for the day.");
    if (track === "grooming") {
      add("matte moisturizer", "Keeps skin looking fresh, not shiny, on the day.");
    } else {
      add("perfecting concealer", "Evens things out for a smooth, photo-ready finish on the day.");
    }
  } else {
    for (const c of focus) {
      const a = adviceFor(c.name);
      add(a.category, a.why);
    }
    add("primer + SPF", "A smooth base and protection for the day.");
  }

  // Coherence: make sure every product the countdown points at is buyable here,
  // so no "→ category" chip dangles without a matching basket row.
  for (const s of countdown) {
    if (s.productCategory) add(s.productCategory, "Called for in your countdown plan.");
  }

  if (garment) {
    const clause = garmentColorClause(garment, color?.undertone).trim();
    items.push({
      id: garment.id,
      kind: "apparel",
      category: garment.name,
      why: clause ? `${titleCase(clause)}, cut for the occasion.` : "Cut for the occasion.",
      price: garment.price,
      retailer: garment.retailer,
      url: garment.url,
      imageUrl: garment.imageUrl,
      sizes: garment.sizes,
      inStock: garment.inStock,
    });
    // Complete the look: accessories matched to the ACTUAL garment (a suit gets
    // a watch + shoes, not earrings), each a priced SKU — turns a single garment
    // into a coherent cross-category basket.
    for (const a of completeTheLook(garment, track)) {
      items.push({
        ...a,
        id: itemId("accessory", a.category),
        kind: "accessory",
        inStock: true,
      });
    }
  }
  return items;
}

/* ---------------- small helpers ---------------- */

function step(name: string): ConciergeEvent {
  return { type: "tool_start", name, label: labelFor(name) };
}

async function* say(text: string): AsyncGenerator<ConciergeEvent> {
  yield { type: "narration", text: `${text}\n\n` };
  await sleep(140);
}

function skinReadLead(items: SkinConcern[]): string {
  const lowest = Math.min(...items.map((item) => item.score));
  if (lowest >= 75) return "YouCam found a strong-looking baseline";
  if (lowest >= 55) return "YouCam found a steady baseline with a few areas to support";
  return "YouCam found a few areas that may benefit from extra cosmetic support";
}

/** Introduce the focus concerns. When a skin GOAL is set, name it so the
 * goal-weighted selection doesn't read as a mis-ordered "most room" list. */
function focusIntro(goal: SkinGoal | undefined, focus: SkinConcern[]): string {
  if (goal && goal !== "balanced") {
    return `for your ${goalLabel(goal)} goal I'll focus on ${listConcernsWithScores(focus)}.`;
  }
  return `the most room is on ${listConcernsWithScores(focus)} — I'll focus your cosmetic prep there.`;
}

function goalLabel(goal: SkinGoal): string {
  switch (goal) {
    case "glow":
      return "glow";
    case "firm":
      return "smooth-and-firm";
    case "clear":
      return "clear-skin";
    case "even":
      return "even-tone";
    default:
      return "balanced";
  }
}

/** Goal-specific narrative close so the chosen skin goal is acknowledged (not
 * silently applied). Falls back to the horizon-appropriate generic close. */
function goalClose(goal: SkinGoal | undefined, treatable: boolean): string {
  switch (goal) {
    case "glow":
      return "lit-from-within and camera-ready";
    case "firm":
      return "smooth, firm, and camera-ready";
    case "clear":
      return "clear, fresh, and camera-ready";
    case "even":
      return "even-toned and camera-ready";
    default:
      return treatable ? "rested, refreshed, and put-together" : "rested, even, and camera-ready";
  }
}

function itemId(kind: string, name: string): string {
  return `${kind}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}

function listConcernsWithScores(items: SkinConcern[]): string {
  const parts = items.map((c) => `${prettyConcern(c.name)} (${Math.round(c.score)}/100)`);
  if (parts.length <= 1) return parts[0] ?? "hydration";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function horizonLabel(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  if (days < 7) return `${days} days`;
  const weeks = Math.round(days / 7);
  return weeks <= 1 ? "1 week" : `${weeks} weeks`;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
