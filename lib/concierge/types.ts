import type { ColorProfile, SkinAnalysis } from "@/lib/youcam/types";

/** Which rendered-image slot a generated image belongs to on the Look Board.
 * "studio" is a follow-on try-on (hair/makeup/skin re-check) shown after the plan. */
export type ImageSlot = "skinOverlay" | "apparel" | "finish" | "studio";

/** A single step in the day-by-day skin-prep countdown. */
export interface CountdownStep {
  /** e.g. "3 weeks out", "Night before". */
  when: string;
  /** What to do. */
  action: string;
  /** Optional product category to shop for this step. */
  productCategory?: string;
}

/** The final assembled "Occasion Look Board". */
export interface LookBoard {
  occasion: string;
  /** Days until the event, if the concierge could infer one. */
  daysUntil?: number;
  headline: string;
  /** Concierge's written plan tying skin + style together. */
  narrative: string;
  countdown: CountdownStep[];
  shopping: ShoppingItem[];
  /** Catalog id of the rendered garment (drives "try another" refinement). */
  garmentId?: string;
}

/** A "shop the look" line — a product category or a specific catalog SKU. */
export interface ShoppingItem {
  /** Stable catalog key used by the interactive basket. */
  id?: string;
  category: string;
  why: string;
  kind?: "beauty" | "apparel" | "accessory";
  /** Present for a concrete catalog SKU (the retail loop). */
  price?: number;
  retailer?: string;
  url?: string;
  imageUrl?: string;
  sizes?: string[];
  inStock?: boolean;
}

/** Which engine drives the run. */
export type ConciergeMode = "agentic" | "deterministic";

/** Which LLM drives an agentic run (claude = Anthropic, gpt = OpenAI). */
export type AgenticBrain = "claude" | "gpt";

/** Which skin outcome the user cares about most; reweights the concern focus. */
export type SkinGoal = "balanced" | "glow" | "firm" | "clear" | "even";

/** Self-selected styling track (never inferred from the face). "grooming" swaps
 * makeup + color-season framing for beard/hair/skin grooming with a suit. */
export type StyleTrack = "style" | "grooming";

/** The silhouette the shopper explicitly wants to try. */
export type GarmentPreference = "surprise" | "dresses" | "suits" | "separates";

/**
 * Which tailoring cuts to consider. "any" is the honest default: until the
 * shopper says, the app must not make a presentation-defining choice for them.
 *
 * This is NEVER inferred from the photo — guessing someone's presentation from
 * their face is both wrong and unnecessary, because asking costs one tap. A
 * "masculine" or "feminine" value only ever comes from an explicit control or
 * from a bundled sample that ships with its own answer.
 */
export type CutPreference = "any" | "feminine" | "masculine";

/** A one-tap refinement of an existing look (re-styles the outfit in place). */
export type RefineAdjust = "less_formal" | "more_formal" | "cooler" | "warmer" | "reroll";

/** Input to the concierge run. Images are base64 data URLs or https URLs. */
export interface ConciergeRequest {
  occasion: string;
  /** Selfie (required). */
  personImage: string;
  /** Optional full-body photo for apparel VTO. */
  bodyImage?: string;
  /** Force a mode. Omit for "auto" (agentic if an Anthropic key is present). */
  mode?: ConciergeMode | "auto";
  /** What the user most wants from their skin; reweights which concerns to focus. */
  skinGoal?: SkinGoal;
  /** Self-selected styling track (default "style"). */
  track?: StyleTrack;
  /** Explicit wardrobe preference; never inferred from the user's photo. */
  garmentPreference?: GarmentPreference;
  /** Explicit cut/presentation preference; never inferred from the user's photo. */
  cutPreference?: CutPreference;
  /**
   * When present, this is a refinement of a prior look: re-style the outfit only,
   * reusing the prior skin/color (passed here) instead of re-analyzing — so it's
   * fast and doesn't re-spend units on the unchanged reads.
   */
  refine?: {
    adjust: RefineAdjust;
    /** The garment currently shown — excluded on "try another"; used to detect
     * a no-op so we never claim a change that didn't happen. */
    currentGarmentId?: string;
    /** Prior undertone, so we don't re-run color analysis. */
    undertone?: string;
    /** Prior skin concerns, so we don't re-run skin analysis. */
    concerns?: { name: string; score: number }[];
  };
}

/** A follow-on "studio" experience the user can try after their plan is built —
 * each maps to one YouCam feature rendered on the same selfie. */
export type StudioKind = "hair_color" | "hairstyle" | "makeup" | "skin_recheck";

/** Input to a single studio-experience render (reuses the selfie, no re-upload
 * of a full-body photo). Streams the same ConciergeEvent shapes as a run. */
export interface StudioRequest {
  kind: StudioKind;
  /** Selfie (base64 data URL or https URL). */
  personImage: string;
  /** Prior undertone, so hair-color / makeup pick a flattering shade (optional). */
  undertone?: string;
}

/** Server-Sent-Event payloads streamed to the client during a run. */
export type ConciergeEvent =
  | { type: "mode"; mode: ConciergeMode; demo?: boolean; brain?: AgenticBrain }
  | { type: "narration"; text: string }
  | { type: "tool_start"; name: string; label: string }
  | { type: "skin"; analysis: SkinAnalysis }
  | { type: "color"; profile: ColorProfile }
  | { type: "image"; slot: ImageSlot; url: string }
  | { type: "board"; board: LookBoard }
  | { type: "error"; message: string }
  | { type: "done" };
