import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { env } from "@/lib/env";
import { executeTool, type RunContext } from "@/lib/concierge/agent-tools";
import { imageInputFromString } from "@/lib/concierge/image";
import { SYSTEM_PROMPT, buildUserMessage } from "@/lib/concierge/prompt";
import { CUSTOM_TOOL_DEFS, labelFor } from "@/lib/concierge/tools";
import type { ConciergeEvent, ConciergeRequest } from "@/lib/concierge/types";

const MODEL = "claude-opus-4-8";
const MAX_TURNS = 12;

/**
 * Claude-driven concierge run. Yields ConciergeEvents (narration deltas +
 * domain results) as the agentic loop progresses. Tool execution is shared
 * with the GPT engine (lib/concierge/agent-tools.ts) so both brains drive the
 * identical YouCam pipeline. Requires ANTHROPIC_API_KEY + YOUCAM_API_KEY.
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
    garmentPreference: req.garmentPreference ?? "surprise",
  };

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: buildUserMessage(req.occasion, req.skinGoal, req.track, req.garmentPreference) },
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

// ---- helpers ----
function textDelta(ev: unknown): string | undefined {
  const e = ev as { type?: string; delta?: { type?: string; text?: string } };
  if (e.type === "content_block_delta" && e.delta?.type === "text_delta") {
    return e.delta.text;
  }
  return undefined;
}
