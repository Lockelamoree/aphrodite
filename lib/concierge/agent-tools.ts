import "server-only";

import {
  completeTheLook,
  findGarment,
  garmentMatchesPreference,
  SKINCARE_SKUS,
  skincareSkuFor,
  type CatalogGarment,
} from "@/lib/concierge/catalog";
import { TOOL } from "@/lib/concierge/tools";
import type {
  ConciergeEvent,
  CountdownStep,
  GarmentPreference,
  LookBoard,
  StyleTrack,
} from "@/lib/concierge/types";
import { analyzeColorProfile } from "@/lib/youcam/color";
import { analyzeSkin } from "@/lib/youcam/skin";
import { applyLighting } from "@/lib/youcam/lighting";
import { tryOnApparel } from "@/lib/youcam/apparel";
import type { ImageInput } from "@/lib/youcam/types";

/**
 * Provider-agnostic tool execution for the agentic engines.
 *
 * Both agentic brains (Claude in orchestrator.ts, GPT in openai.ts) drive the
 * SAME four YouCam tools through this module, so their behavior — YouCam calls,
 * emitted UI events, board assembly — is identical by construction. Only the
 * reasoning loop differs.
 */

export interface RunContext {
  person: ImageInput;
  body: ImageInput;
  /** Whether a real full-body photo was provided (apparel needs one). */
  hasBody: boolean;
  /** Self-selected styling track. */
  track: StyleTrack;
  /** Explicit silhouette preference supplied by the shopper. */
  garmentPreference: GarmentPreference;
  /** The garment actually rendered, carried into the shop-the-look board. */
  rendered?: CatalogGarment;
}

export interface ToolOutcome {
  events: ConciergeEvent[];
  /** Text/JSON returned to the model as the tool result. */
  resultForModel: string;
  board?: LookBoard;
  finish?: boolean;
  isError?: boolean;
}

export async function executeTool(
  name: string,
  input: unknown,
  ctx: RunContext,
): Promise<ToolOutcome> {
  try {
    switch (name) {
      case TOOL.analyzeSkin: {
        const analysis = await analyzeSkin(ctx.person);
        const events: ConciergeEvent[] = [{ type: "skin", analysis }];
        if (analysis.overlayUrl) {
          events.push({ type: "image", slot: "skinOverlay", url: analysis.overlayUrl });
        }
        return {
          events,
          resultForModel: JSON.stringify({
            note: "scores are 0-100 skin HEALTH (higher = healthier); prioritize the LOWEST-scoring concerns.",
            concerns: analysis.concerns.map((c) => ({ name: c.name, health: c.score })),
          }),
        };
      }
      case TOOL.analyzeColor: {
        const profile = await analyzeColorProfile(ctx.person);
        return {
          events: [{ type: "color", profile }],
          resultForModel: JSON.stringify({
            undertone: profile.undertone,
            season: profile.season,
            detected: profile.detected,
            palette: profile.paletteHex,
          }),
        };
      }
      case TOOL.tryOnApparel: {
        const garmentId = stringProp(input, "garment_id");
        const garment = garmentId ? findGarment(garmentId) : undefined;
        if (!garment) {
          return {
            events: [],
            resultForModel: `Unknown garment_id "${garmentId ?? ""}". Pick one from the catalog.`,
            isError: true,
          };
        }
        if (!garmentMatchesPreference(garment, ctx.garmentPreference)) {
          return {
            events: [],
            resultForModel: `Garment "${garment.id}" does not match the shopper wardrobe preference "${ctx.garmentPreference}". Pick a matching catalog item.`,
            isError: true,
          };
        }
        if (!ctx.hasBody) {
          // Apparel needs a full-body photo; a head-and-shoulders selfie renders
          // poorly. Skip gracefully (not an error) so the model narrates it and
          // the UI shows the terminal "not rendered" state.
          ctx.rendered = garment; // still recommend it in shop-the-look
          return {
            events: [],
            resultForModel: JSON.stringify({
              rendered: false,
              reason: "No full-body photo provided, so I recommended the outfit without a try-on render.",
              garment: garment.name,
            }),
          };
        }
        const img = await tryOnApparel(
          {
            person: ctx.body,
            garment: { kind: "url", url: garment.imageUrl },
            category: garment.category,
          },
          { timeoutMs: 60_000 },
        );
        ctx.rendered = garment;
        return {
          events: [{ type: "image", slot: "apparel", url: img.url }],
          resultForModel: JSON.stringify({ rendered: true, garment: garment.name }),
        };
      }
      case TOOL.presentLookBoard: {
        const board = toLookBoard(input);
        appendRenderedGarment(board, ctx.rendered);
        appendCompleteTheLook(board, ctx.rendered, ctx.track);
        // Occasion finishing pass: a real YouCam Photo-Lighting relight of the
        // selfie (face-prominent → reliable). Optional; degrades if it fails.
        const events: ConciergeEvent[] = [];
        try {
          const lit = await applyLighting(ctx.person);
          events.push({ type: "image", slot: "finish", url: lit.url });
        } catch {
          /* finishing render is optional */
        }
        return { events, resultForModel: "Look board presented.", board, finish: true };
      }
      default:
        return { events: [], resultForModel: `Unknown tool: ${name}`, isError: true };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { events: [{ type: "error", message }], resultForModel: `Error: ${message}`, isError: true };
  }
}

// ---- helpers ----

export function stringProp(input: unknown, key: string): string | undefined {
  const v = (input as Record<string, unknown> | null)?.[key];
  return typeof v === "string" ? v : undefined;
}

export function toLookBoard(input: unknown): LookBoard {
  const o = (input ?? {}) as Record<string, unknown>;
  const countdown: CountdownStep[] = Array.isArray(o.countdown)
    ? (o.countdown as Record<string, unknown>[]).map((s) => ({
        when: String(s.when ?? ""),
        action: String(s.action ?? ""),
        productCategory: typeof s.product_category === "string" ? s.product_category : undefined,
      }))
    : [];
  const shopping = Array.isArray(o.shopping)
    ? (o.shopping as Record<string, unknown>[]).map((s) => {
        const category = String(s.category ?? "");
        const why = String(s.why ?? "");
        // Price recognized skincare categories so the basket is legible; leave
        // unrecognized suggestions as plain (unpriced) rows.
        if (SKINCARE_SKUS[category]) {
          const sku = skincareSkuFor(category);
          return {
            id: slug("beauty", sku.category),
            kind: "beauty" as const,
            category: sku.category,
            why,
            price: sku.price,
            retailer: sku.retailer,
            url: sku.url,
            imageUrl: sku.imageUrl,
            inStock: true,
          };
        }
        return { category, why };
      })
    : [];
  return {
    occasion: typeof o.occasion === "string" ? o.occasion : "",
    daysUntil: typeof o.days_until === "number" ? o.days_until : undefined,
    headline: String(o.headline ?? "Your Occasion Look"),
    narrative: String(o.narrative ?? ""),
    countdown,
    shopping,
  };
}

/** Ensure the rendered garment appears as a priced SKU in shop-the-look. */
export function appendRenderedGarment(board: LookBoard, g: CatalogGarment | undefined): void {
  if (!g) return;
  board.garmentId = g.id;
  if (board.shopping.some((s) => s.category === g.name)) return;
  board.shopping.push({
    id: g.id,
    kind: "apparel",
    category: g.name,
    why: "Rendered on you via YouCam Apparel Try-On.",
    price: g.price,
    retailer: g.retailer,
    url: g.url,
    imageUrl: g.imageUrl,
    sizes: g.sizes,
    inStock: g.inStock,
  });
}

/** Complete the look with accessories matched to the garment's WARDROBE type (a
 * suit — worn by anyone — gets gender-neutral tailoring + makeup, a dress gets
 * jewellery), each carrying retail metadata like the deterministic path. */
export function appendCompleteTheLook(
  board: LookBoard,
  g: CatalogGarment | undefined,
  track: StyleTrack,
): void {
  if (!g) return;
  for (const a of completeTheLook(g, track)) {
    if (!board.shopping.some((s) => s.category === a.category)) {
      board.shopping.push({ ...a, id: slug("accessory", a.category), kind: "accessory", inStock: true });
    }
  }
}

/** Stable slug id for a shopping row (mirrors the deterministic engine's itemId). */
function slug(kind: string, name: string): string {
  return `${kind}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}
