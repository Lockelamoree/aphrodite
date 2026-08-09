import { isValidImageRef } from "@/lib/concierge/request-schema";
import { runStudio } from "@/lib/concierge/studio";
import { sanitizeEvent } from "@/lib/concierge/sanitize";
import type { ConciergeEvent, StudioKind, StudioRequest } from "@/lib/concierge/types";
import { env } from "@/lib/env";
import { createRateLimiter } from "@/lib/http/rate-limit";
import { LIVE_COOKIE_NAME, liveAllowed } from "@/lib/auth/gate";
import { claim as claimLiveRun } from "@/lib/live/ledger";
import { withYouCamMode } from "@/lib/youcam/runtime";

// One YouCam render per request; keep it on the Node runtime with a generous
// window (matches the main concierge route).
export const runtime = "nodejs";
export const maxDuration = 120;

// A single selfie (~12MB) inflates to ~16MB of base64 + JSON overhead.
const MAX_BODY_BYTES = 20 * 1024 * 1024;

const KINDS: readonly StudioKind[] = ["hair_color", "hairstyle", "makeup", "skin_recheck"];

// Every studio call renders one YouCam feature, so run a tighter per-IP budget
// than the main concierge flow (see lib/http/rate-limit).
const isRateLimited = createRateLimiter({ max: 12, windowMs: 60_000 });

function parse(raw: unknown): StudioRequest | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const kind = o.kind;
  const personImage = o.personImage;
  if (typeof kind !== "string" || !KINDS.includes(kind as StudioKind)) return undefined;
  // Same image contract as /api/concierge: an https URL or a bounded jpeg/png/webp
  // data URL — fail closed before forwarding anything to YouCam.
  if (typeof personImage !== "string" || !isValidImageRef(personImage)) return undefined;
  return {
    kind: kind as StudioKind,
    personImage,
    undertone: typeof o.undertone === "string" && o.undertone.length <= 40 ? o.undertone : undefined,
  };
}

export async function POST(req: Request): Promise<Response> {
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return Response.json({ error: "Payload too large." }, { status: 413 });
  }
  if (isRateLimited(req)) {
    return Response.json({ error: "Too many requests — please wait a moment." }, { status: 429 });
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

  // Same two schranken as /api/concierge: a code says who, the ledger says how
  // many. A studio try-on is a YouCam task like any other.
  const cookie = readCookie(req, LIVE_COOKIE_NAME);
  const unlocked = liveAllowed(cookie);
  let liveYouCam = false;
  let liveReason =
    "captured sample renders — the live path is behind a judge access code";
  if (unlocked && !env.youcamFixtures) {
    const { granted, state } = claimLiveRun();
    liveYouCam = granted;
    liveReason = granted
      ? `live YouCam calls (run ${state.used} of ${state.budget})`
      : `the live-run budget of ${state.budget} is used up — showing captured samples instead`;
  } else if (unlocked) {
    liveReason = "captured sample renders — this host runs YOUCAM_FIXTURES=1";
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        send(controller, { type: "mode", mode: "deterministic", demo: !liveYouCam });
        await withYouCamMode({ live: liveYouCam, reason: liveReason }, async () => {
          for await (const ev of runStudio(body)) send(controller, ev);
        });
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

/** Read one cookie without pulling in a parser. */
function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}
