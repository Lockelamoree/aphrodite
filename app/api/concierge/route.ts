import { runDeterministic, runRefineDeterministic } from "@/lib/concierge/deterministic";
import { runConcierge } from "@/lib/concierge/orchestrator";
import type { ConciergeEvent, ConciergeMode, ConciergeRequest } from "@/lib/concierge/types";

// The concierge does long, multi-step generation — keep it on the Node runtime
// and allow a generous execution window.
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request): Promise<Response> {
  let body: ConciergeRequest;
  try {
    body = (await req.json()) as ConciergeRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.occasion || !body?.personImage) {
    return Response.json(
      { error: "Both `occasion` and `personImage` are required." },
      { status: 400 },
    );
  }

  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const requested = body.mode && body.mode !== "auto" ? body.mode : undefined;
  const mode: ConciergeMode =
    requested === "deterministic"
      ? "deterministic"
      : hasAnthropic
        ? "agentic"
        : "deterministic";
  // If the user asked for agentic but no key is configured, we downgraded above.
  const downgraded = requested === "agentic" && !hasAnthropic;

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, ev: ConciergeEvent) =>
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // A refinement re-styles an existing look (rule-based, any mode) and
        // preserves the client's current badge — so no mode event is re-sent.
        const isRefine = Boolean(body.refine);
        if (!isRefine) {
          send(controller, { type: "mode", mode });
          if (downgraded) {
            send(controller, {
              type: "narration",
              text: "(No Anthropic key configured — running in guided mode.)\n\n",
            });
          }
        }
        const engine = isRefine
          ? runRefineDeterministic
          : mode === "agentic"
            ? runConcierge
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
