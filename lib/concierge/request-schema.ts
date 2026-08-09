import "server-only";

import { z } from "zod";

import type { ConciergeRequest } from "@/lib/concierge/types";

/**
 * Request validation for POST /api/concierge. Constrains sizes, enums, and image
 * shape so the prototype fails closed on malformed/oversized input rather than
 * forwarding it to the LLM/YouCam. Kept separate from the route so it is unit-testable.
 */

/** Max decoded image bytes accepted in a data URL (≈ a large phone photo). */
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export function isValidImageRef(s: string): boolean {
  if (/^https:\/\/\S+$/i.test(s)) return true;
  const m = /^data:image\/(?:jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(s);
  if (!m) return false;
  const decoded = Math.floor((m[1].length * 3) / 4);
  return decoded > 0 && decoded <= MAX_IMAGE_BYTES;
}

const imageRef = z
  .string()
  .min(1)
  .max(24_000_000) // base64 of a 12MB image is ~16MB; leave headroom
  .refine(isValidImageRef, "must be an https URL or a jpeg/png/webp data URL within the size limit");

export const conciergeRequestSchema = z
  .object({
    occasion: z.string().trim().min(1, "occasion is required").max(300, "occasion is too long"),
    personImage: imageRef,
    bodyImage: imageRef.optional(),
    mode: z.enum(["auto", "agentic", "deterministic"]).optional(),
    skinGoal: z.enum(["balanced", "glow", "firm", "clear", "even"]).optional(),
    track: z.enum(["style", "grooming"]).optional(),
    garmentPreference: z.enum(["surprise", "dresses", "suits", "separates"]).optional(),
    cutPreference: z.enum(["any", "feminine", "masculine"]).optional(),
    refine: z
      .object({
        adjust: z.enum(["less_formal", "more_formal", "cooler", "warmer", "reroll"]),
        currentGarmentId: z.string().max(100).optional(),
        undertone: z.string().max(40).optional(),
        concerns: z
          .array(z.object({ name: z.string().max(60), score: z.number().min(0).max(100) }))
          .max(40)
          .optional(),
      })
      .optional(),
  })
  .strip(); // ignore unknown keys rather than 400 on a harmless extra field

export type ParsedConciergeRequest = z.infer<typeof conciergeRequestSchema>;

export interface ParseResult {
  ok: boolean;
  data?: ConciergeRequest;
  error?: string;
}

/** Parse + validate an unknown body into a ConciergeRequest, or an error message. */
export function parseConciergeRequest(body: unknown): ParseResult {
  const result = conciergeRequestSchema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.join(".");
    return { ok: false, error: `${path ? `${path}: ` : ""}${first?.message ?? "invalid request"}` };
  }
  return { ok: true, data: result.data as ConciergeRequest };
}
