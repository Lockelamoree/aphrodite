/**
 * Custom tool definitions the concierge (Claude) can call. These are our
 * deterministic bridge to the YouCam REST backbone — the route executes them
 * and feeds results back, emitting UI events as each completes.
 *
 * The person/body images live server-side and are referenced by the executors,
 * so no tool takes an image argument. Every listed tool maps to a real,
 * verified YouCam capability (no dead tools).
 */

export const TOOL = {
  analyzeSkin: "analyze_skin",
  analyzeColor: "analyze_color",
  tryOnApparel: "try_on_apparel",
  presentLookBoard: "present_look_board",
} as const;

export type ToolName = (typeof TOOL)[keyof typeof TOOL];

/** Human-friendly chip label leading with the YouCam capability in use. */
export function labelFor(name: string): string {
  switch (name) {
    case TOOL.analyzeSkin:
      return "YouCam Skin Analysis";
    case TOOL.analyzeColor:
      return "YouCam Color Analysis";
    case TOOL.tryOnApparel:
      return "YouCam Apparel Try-On";
    case TOOL.presentLookBoard:
      return "Finalizing your look board";
    default:
      return name;
  }
}

/** JSON-Schema tool definitions (Anthropic Messages API `tools` entries). */
export const CUSTOM_TOOL_DEFS = [
  {
    name: TOOL.analyzeSkin,
    description:
      "Run YouCam AI Skin Analysis on the user's selfie. Returns a 0–100 HEALTH score per concern (higher = healthier skin) and a mask-overlay image showing what the AI detected.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: TOOL.analyzeColor,
    description:
      "Run YouCam Facial Color Tones analysis. Returns the user's detected skin/eye/lip colors, a derived undertone, and a recommended palette.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: TOOL.tryOnApparel,
    description:
      "Render a catalog garment on the user via YouCam generative apparel try-on. Pass the garment id from the catalog.",
    input_schema: {
      type: "object",
      properties: {
        garment_id: { type: "string", description: "id from the garment catalog" },
      },
      required: ["garment_id"],
      additionalProperties: false,
    },
  },
  {
    name: TOOL.presentLookBoard,
    description:
      "Present the finished Occasion Look Board. Call this exactly once, last, with the assembled plan.",
    input_schema: {
      type: "object",
      properties: {
        headline: { type: "string" },
        narrative: {
          type: "string",
          description: "2–4 sentences tying skin + style together for this occasion.",
        },
        days_until: { type: "integer", description: "days until the event, if inferable" },
        countdown: {
          type: "array",
          items: {
            type: "object",
            properties: {
              when: { type: "string" },
              action: { type: "string" },
              product_category: { type: "string" },
            },
            required: ["when", "action"],
            additionalProperties: false,
          },
        },
        shopping: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { type: "string" },
              why: { type: "string" },
            },
            required: ["category", "why"],
            additionalProperties: false,
          },
        },
      },
      required: ["headline", "narrative", "countdown", "shopping"],
      additionalProperties: false,
    },
  },
] as const;
