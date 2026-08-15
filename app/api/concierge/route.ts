import { runDeterministic, runRefineDeterministic } from "@/lib/concierge/deterministic";
import { runConcierge } from "@/lib/concierge/orchestrator";
import { runConciergeOpenAI } from "@/lib/concierge/openai";
import { parseConciergeRequest } from "@/lib/concierge/request-schema";
import { sanitizeEvent } from "@/lib/concierge/sanitize";
import type { AgenticBrain, ConciergeEvent, ConciergeMode } from "@/lib/concierge/types";
import { env } from "@/lib/env";
import { readCookie } from "@/lib/http/cookies";
import { createRateLimiter } from "@/lib/http/rate-limit";
import { LIVE_COOKIE_NAME, gateEnabled, liveAllowed } from "@/lib/auth/gate";
import { claim as claimLiveRun } from "@/lib/live/ledger";
import { withYouCamMode } from "@/lib/youcam/runtime";

// The concierge does long, multi-step generation — keep it on the Node runtime
// and allow a generous execution window.
export const runtime = "nodejs";
export const maxDuration = 300;

// Body-size ceiling (two ~12MB images inflate to ~32MB of base64 + JSON overhead).
const MAX_BODY_BYTES = 40 * 1024 * 1024;
// Prototype-grade in-memory per-IP rate limit (see lib/http/rate-limit).
const isRateLimited = createRateLimiter({ max: 20, windowMs: 60_000 });

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

  // --- who may spend money on this request, and how much is left ---
  //
  // Two schranken, because a code alone answers only WHO. The YouCam free tier is
  // finite and one full run costs four to five tasks, so an unlocked judge is also
  // metered. Claiming BEFORE the run means an exhausted budget degrades the run
  // instead of being discovered after the units are gone.
  const cookie = readCookie(req, LIVE_COOKIE_NAME);
  const unlocked = liveAllowed(cookie);
  let liveYouCam = false;
  let liveReason: string;
  if (!unlocked) {
    liveReason =
      "captured sample renders — the live YouCam path is behind a judge access code, so no visitor can spend units";
  } else if (env.youcamFixtures) {
    // An unlocked judge on a host whose default is replay: honour the default.
    // The operator turns YOUCAM_FIXTURES off when they want live runs available.
    liveReason = "captured sample renders — this host runs YOUCAM_FIXTURES=1";
  } else {
    const { granted, state } = claimLiveRun();
    liveYouCam = granted;
    liveReason = granted
      ? `live YouCam calls (run ${state.used} of ${state.budget})`
      : `the live-run budget of ${state.budget} is used up — showing captured samples instead`;
  }

  // Either LLM key unlocks the agentic engine; Claude is preferred when both
  // are present, GPT is the alternative brain (same tools, same event stream).
  // Gated the same way: an LLM call costs money, so a locked visitor never
  // reaches it however they set the toggle.
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY?.trim());
  const keyedBrain: AgenticBrain | undefined = hasAnthropic ? "claude" : hasOpenAI ? "gpt" : undefined;
  const brain: AgenticBrain | undefined = unlocked ? keyedBrain : undefined;
  const requested = body.mode && body.mode !== "auto" ? body.mode : undefined;
  const mode: ConciergeMode =
    requested === "deterministic"
      ? "deterministic"
      : brain
        ? "agentic"
        : "deterministic";
  // The user asked for agentic and did not get it: either no key is configured, or
  // the key exists but this request is not unlocked. Say which — a vague downgrade
  // notice sends a judge hunting for a missing key that is actually present.
  const downgraded = requested === "agentic" && !brain;
  const downgradeReason = !keyedBrain
    ? "(No agentic key configured — running in guided mode.)\n\n"
    : "(The AI-driven engine is behind a judge access code — running in guided mode.)\n\n";

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
            demo: !liveYouCam,
            ...(mode === "agentic" && brain ? { brain } : {}),
          });
          if (downgraded) {
            send(controller, {
              type: "narration",
              text: downgradeReason,
            });
          }
          // Never switch silently between live and replay: a captured render
          // presented as a live one is the integrity risk named first in
          // hackathon/config.json.
          if (gateEnabled() || !liveYouCam) {
            send(controller, { type: "narration", text: `(YouCam: ${liveReason}.)\n\n` });
          }
        }
        const engine = isRefine
          ? runRefineDeterministic
          : mode === "agentic"
            ? brain === "gpt"
              ? runConciergeOpenAI
              : runConcierge
            : runDeterministic;
        await withYouCamMode({ live: liveYouCam, reason: liveReason }, async () => {
          try {
            for await (const ev of engine(body)) send(controller, ev);
          } catch (err) {
            // THE AGENTIC ENGINE MUST NOT BE ABLE TO COST A JUDGE THEIR LOOK BOARD.
            //
            // Until review 003 this rethrew into the outer catch, which sent
            // {error} then {done} — no board, no plan, nothing. And it is the
            // DEFAULT path for an unlocked judge: mode "auto" resolves to agentic
            // whenever a key exists. /healthz was reporting the LLM probe as
            // key_present_unverified ("This operation was aborted") at the time, so
            // the most likely first impression was a blank result.
            //
            // The rule engine needs no key and produces the same event stream, so a
            // failure here is a downgrade, not an outage. It is announced, because a
            // silent switch would misattribute the guided engine's work to the LLM.
            if (isRefine || mode !== "agentic") throw err;
            const why = err instanceof Error ? err.message : String(err);
            send(controller, { type: "mode", mode: "deterministic", demo: !liveYouCam });
            send(controller, {
              type: "narration",
              text: `(The AI-driven engine did not finish — ${why}. Completing your plan with the guided engine instead; every YouCam render below is unchanged.)\n\n`,
            });
            for await (const ev of runDeterministic(body)) send(controller, ev);
          }
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
