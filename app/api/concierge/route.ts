import { runDeterministic, runRefineDeterministic } from "@/lib/concierge/deterministic";
import { runConcierge } from "@/lib/concierge/orchestrator";
import { runConciergeOpenAI } from "@/lib/concierge/openai";
import { parseConciergeRequest } from "@/lib/concierge/request-schema";
import { sanitizeEvent } from "@/lib/concierge/sanitize";
import type { AgenticBrain, ConciergeEvent, ConciergeMode } from "@/lib/concierge/types";
import { env } from "@/lib/env";

// The concierge does long, multi-step generation — keep it on the Node runtime
// and allow a generous execution window.
export const runtime = "nodejs";
export const maxDuration = 300;

// Body-size ceiling (two ~12MB images inflate to ~32MB of base64 + JSON overhead).
const MAX_BODY_BYTES = 40 * 1024 * 1024;
// Prototype-grade in-memory per-IP rate limit (not multi-instance safe).
const RL_MAX = 20;
const RL_WINDOW_MS = 60_000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(req: Request): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RL_MAX;
}

export async function POST(req: Request): Promise<Response> {
  // Reject oversized payloads before buffering the body.
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
  const parsed = parseConciergeRequest(raw);
  if (!parsed.ok || !parsed.data) {
    return Response.json({ error: parsed.error ?? "Invalid request." }, { status: 400 });
  }
  const body = parsed.data;

  // Either LLM key unlocks the agentic engine; Claude is preferred when both
  // are present, GPT is the alternative brain (same tools, same event stream).
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY?.trim());
  const brain: AgenticBrain | undefined = hasAnthropic ? "claude" : hasOpenAI ? "gpt" : undefined;
  const requested = body.mode && body.mode !== "auto" ? body.mode : undefined;
  const mode: ConciergeMode =
    requested === "deterministic"
      ? "deterministic"
      : brain
        ? "agentic"
        : "deterministic";
  // If the user asked for agentic but no key is configured, we downgraded above.
  const downgraded = requested === "agentic" && !brain;

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, ev: ConciergeEvent) =>
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(sanitizeEvent(ev))}\n\n`));

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // A refinement re-styles an existing look (rule-based, any mode) and
        // preserves the client's current badge — so no mode event is re-sent.
        const isRefine = Boolean(body.refine);
        if (!isRefine) {
          send(controller, {
            type: "mode",
            mode,
            demo: env.youcamFixtures,
            ...(mode === "agentic" && brain ? { brain } : {}),
          });
          if (downgraded) {
            send(controller, {
              type: "narration",
              text: "(No agentic key configured — running in guided mode.)\n\n",
            });
          }
        }
        const engine = isRefine
          ? runRefineDeterministic
          : mode === "agentic"
            ? brain === "gpt"
              ? runConciergeOpenAI
              : runConcierge
            : runDeterministic;
        for await (const ev of engine(body)) send(controller, ev);
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
