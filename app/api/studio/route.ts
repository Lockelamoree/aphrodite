import { runStudio } from "@/lib/concierge/studio";
import { sanitizeEvent } from "@/lib/concierge/sanitize";
import type { ConciergeEvent, StudioKind, StudioRequest } from "@/lib/concierge/types";
import { env } from "@/lib/env";

// One YouCam render per request; keep it on the Node runtime with a generous
// window (matches the main concierge route).
export const runtime = "nodejs";
export const maxDuration = 120;

// A single selfie (~12MB) inflates to ~16MB of base64 + JSON overhead.
const MAX_BODY_BYTES = 20 * 1024 * 1024;

const KINDS: readonly StudioKind[] = ["hair_color", "hairstyle", "makeup", "skin_recheck"];

function parse(raw: unknown): StudioRequest | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const kind = o.kind;
  const personImage = o.personImage;
  if (typeof kind !== "string" || !KINDS.includes(kind as StudioKind)) return undefined;
  if (typeof personImage !== "string" || personImage.length === 0) return undefined;
  return {
    kind: kind as StudioKind,
    personImage,
    undertone: typeof o.undertone === "string" ? o.undertone : undefined,
  };
}

export async function POST(req: Request): Promise<Response> {
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return Response.json({ error: "Payload too large." }, { status: 413 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const body = parse(raw);
  if (!body) {
    return Response.json({ error: "Invalid studio request." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, ev: ConciergeEvent) =>
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(sanitizeEvent(ev))}\n\n`));

  const stream = new ReadableStream({
    async start(controller) {
      try {
        send(controller, { type: "mode", mode: "deterministic", demo: env.youcamFixtures });
        for await (const ev of runStudio(body)) send(controller, ev);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send(controller, { type: "error", message });
      } finally {
        send(controller, { type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
