import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { env } from "@/lib/env";
import {
  completeTheLook,
  findGarment,
  SKINCARE_SKUS,
  skincareSkuFor,
  type CatalogGarment,
} from "@/lib/concierge/catalog";
import { imageInputFromString } from "@/lib/concierge/image";
import { SYSTEM_PROMPT, buildUserMessage } from "@/lib/concierge/prompt";
import { CUSTOM_TOOL_DEFS, TOOL, labelFor } from "@/lib/concierge/tools";
import type {
  ConciergeEvent,
  ConciergeRequest,
  CountdownStep,
  LookBoard,
  StyleTrack,
} from "@/lib/concierge/types";
import { analyzeColorProfile } from "@/lib/youcam/color";
import { analyzeSkin } from "@/lib/youcam/skin";
import { applyLighting } from "@/lib/youcam/lighting";
import { tryOnApparel } from "@/lib/youcam/apparel";
import type { ImageInput } from "@/lib/youcam/types";

const MODEL = "claude-opus-4-8";
const MAX_TURNS = 12;

interface RunContext {
  person: ImageInput;
  body: ImageInput;
  /** Whether a real full-body photo was provided (apparel needs one). */
  hasBody: boolean;
  /** Self-selected styling track. */
  track: StyleTrack;
  /** The garment actually rendered, carried into the shop-the-look board. */
  rendered?: CatalogGarment;
}

interface ToolOutcome {
  events: ConciergeEvent[];
  /** Text/JSON returned to the model as the tool_result. */
  resultForModel: string;
  board?: LookBoard;
  finish?: boolean;
  isError?: boolean;
}

/**
 * Drive the concierge run. Yields ConciergeEvents (narration deltas + domain
 * results) as the agentic loop progresses. Requires ANTHROPIC_API_KEY and
 * YOUCAM_API_KEY at runtime.
 */
export async function* runConcierge(
  req: ConciergeRequest,
): AsyncGenerator<ConciergeEvent> {
  const client = new Anthropic({ apiKey: env.anthropicApiKey });
  const person = imageInputFromString(req.personImage);
  const ctx: RunContext = {
    person,
    body: req.bodyImage ? imageInputFromString(req.bodyImage) : person,
    hasBody: Boolean(req.bodyImage),
    track: req.track ?? "style",
  };

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: buildUserMessage(req.occasion, req.skinGoal, req.track) },
  ];

  let presented = false;
  outer: for (let turn = 0; turn < MAX_TURNS; turn++) {
    const params = {
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort: "high" },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      // Drive everything through our custom tools (each emits UI events). We do
      // NOT also expose the MCP toolset: MCP tools execute server-side and would
      // bypass the event stream, leaving the board blank.
      tools: [...CUSTOM_TOOL_DEFS],
      messages,
    } satisfies Record<string, unknown>;

    const stream = client.beta.messages.stream(
      params as unknown as Parameters<typeof client.beta.messages.stream>[0],
    );

    for await (const ev of stream) {
      const text = textDelta(ev);
      if (text) yield { type: "narration", text };
    }
    const msg = await stream.finalMessage();
    messages.push({ role: "assistant", content: msg.content });

    const toolUses = msg.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
    );
    if (msg.stop_reason !== "tool_use" || toolUses.length === 0) break;

    const toolResults: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      yield { type: "tool_start", name: tu.name, label: labelFor(tu.name) };
      const outcome = await executeTool(tu.name, tu.input, ctx);
      for (const e of outcome.events) yield e;
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: outcome.resultForModel,
        ...(outcome.isError ? { is_error: true } : {}),
      });
      if (outcome.board) yield { type: "board", board: outcome.board };
      if (outcome.finish) {
        presented = true;
        break outer;
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  // The model exhausted its turns (or stopped early) without presenting a
  // board — surface it instead of ending on a silent, board-less "done".
  if (!presented) {
    yield {
      type: "error",
      message:
        "The concierge didn't finish assembling your look board this time — please try again.",
    };
  }
}

async function executeTool(
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
function textDelta(ev: unknown): string | undefined {
  const e = ev as { type?: string; delta?: { type?: string; text?: string } };
  if (e.type === "content_block_delta" && e.delta?.type === "text_delta") {
    return e.delta.text;
  }
  return undefined;
}

function stringProp(input: unknown, key: string): string | undefined {
  const v = (input as Record<string, unknown> | null)?.[key];
  return typeof v === "string" ? v : undefined;
}

function toLookBoard(input: unknown): LookBoard {
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
            category: sku.category,
            why,
            price: sku.price,
            retailer: sku.retailer,
            url: sku.url,
            imageUrl: sku.imageUrl,
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
function appendRenderedGarment(board: LookBoard, g: CatalogGarment | undefined): void {
  if (!g) return;
  board.garmentId = g.id;
  if (board.shopping.some((s) => s.category === g.name)) return;
  board.shopping.push({
    category: g.name,
    why: "Rendered on you via YouCam Apparel Try-On.",
    price: g.price,
    retailer: g.retailer,
    url: g.url,
    imageUrl: g.imageUrl,
  });
}

/** Complete the look with occasion-matched accessories + makeup (priced SKUs). */
function appendCompleteTheLook(
  board: LookBoard,
  g: CatalogGarment | undefined,
  track: StyleTrack,
): void {
  if (!g) return;
  for (const a of completeTheLook(g.formality, track)) {
    if (!board.shopping.some((s) => s.category === a.category)) board.shopping.push({ ...a });
  }
}
