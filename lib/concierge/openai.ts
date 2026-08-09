import "server-only";

import { env } from "@/lib/env";
import { executeTool, type RunContext } from "@/lib/concierge/agent-tools";
import { imageInputFromString } from "@/lib/concierge/image";
import { SYSTEM_PROMPT, buildUserMessage } from "@/lib/concierge/prompt";
import { CUSTOM_TOOL_DEFS, labelFor } from "@/lib/concierge/tools";
import type { ConciergeEvent, ConciergeRequest } from "@/lib/concierge/types";

const MAX_TURNS = 12;
const REQUEST_TIMEOUT_MS = 120_000;

/**
 * GPT-driven concierge run (OpenAI chat completions + function calling).
 * The alternative agentic brain: same system prompt, same four YouCam tools,
 * same ConciergeEvent stream as the Claude engine — tool execution is shared
 * via lib/concierge/agent-tools.ts, so behavior is identical by construction.
 * Requires OPENAI_API_KEY + YOUCAM_API_KEY. Plain fetch, no SDK dependency.
 */
export async function* runConciergeOpenAI(
  req: ConciergeRequest,
): AsyncGenerator<ConciergeEvent> {
  const person = imageInputFromString(req.personImage);
  const ctx: RunContext = {
    person,
    body: req.bodyImage ? imageInputFromString(req.bodyImage) : person,
    hasBody: Boolean(req.bodyImage),
    track: req.track ?? "style",
    garmentPreference: req.garmentPreference ?? "surprise",
    cutPreference: req.cutPreference ?? "any",
  };

  const tools = CUSTOM_TOOL_DEFS.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));

  const messages: OpenAIMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserMessage(req.occasion, req.skinGoal, req.track, req.garmentPreference) },
  ];

  let presented = false;
  outer: for (let turn = 0; turn < MAX_TURNS; turn++) {
    const turnResult = await streamCompletion(messages, tools);
    let assistantText = "";
    for await (const piece of turnResult.textStream) {
      assistantText += piece;
      yield { type: "narration", text: piece };
    }
    const { toolCalls, finishReason } = await turnResult.done;

    messages.push({
      role: "assistant",
      content: assistantText || null,
      ...(toolCalls.length
        ? {
            tool_calls: toolCalls.map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: { name: tc.name, arguments: tc.arguments },
            })),
          }
        : {}),
    });

    if (finishReason !== "tool_calls" || toolCalls.length === 0) break;

    for (const tc of toolCalls) {
      yield { type: "tool_start", name: tc.name, label: labelFor(tc.name) };
      let input: unknown = {};
      try {
        input = tc.arguments ? JSON.parse(tc.arguments) : {};
      } catch {
        /* defensive: malformed arguments treated as empty input */
      }
      const outcome = await executeTool(tc.name, input, ctx);
      for (const e of outcome.events) yield e;
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: outcome.resultForModel,
      });
      if (outcome.board) yield { type: "board", board: outcome.board };
      if (outcome.finish) {
        presented = true;
        break outer;
      }
    }
  }

  if (!presented) {
    yield {
      type: "error",
      message:
        "The concierge didn't finish assembling your look board this time — please try again.",
    };
  }
}

/* ---------------- OpenAI streaming plumbing ---------------- */

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

interface AccumulatedToolCall {
  id: string;
  name: string;
  arguments: string;
}

interface TurnResult {
  /** Async iterator of narration text deltas, live as they stream. */
  textStream: AsyncGenerator<string>;
  /** Resolves once the stream is fully consumed. */
  done: Promise<{ toolCalls: AccumulatedToolCall[]; finishReason: string | undefined }>;
}

async function streamCompletion(
  messages: OpenAIMessage[],
  tools: unknown[],
): Promise<TurnResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const res = await fetch(`${env.openaiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: env.openaiModel,
      stream: true,
      messages,
      tools,
    }),
    signal: controller.signal,
  }).catch((err) => {
    clearTimeout(timer);
    throw err instanceof Error ? err : new Error(String(err));
  });

  if (!res.ok || !res.body) {
    clearTimeout(timer);
    const detail = await res.text().catch(() => "");
    throw new Error(
      `OpenAI request failed (${res.status}): ${truncate(extractApiError(detail) ?? detail, 200)}`,
    );
  }

  const toolCalls: AccumulatedToolCall[] = [];
  let finishReason: string | undefined;
  let resolveDone!: (v: { toolCalls: AccumulatedToolCall[]; finishReason: string | undefined }) => void;
  let rejectDone!: (e: unknown) => void;
  const done = new Promise<{ toolCalls: AccumulatedToolCall[]; finishReason: string | undefined }>(
    (res2, rej2) => {
      resolveDone = res2;
      rejectDone = rej2;
    },
  );

  async function* textStream(): AsyncGenerator<string> {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for (;;) {
        const { done: eof, value } = await reader.read();
        if (eof) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          let chunk: OpenAIStreamChunk;
          try {
            chunk = JSON.parse(payload) as OpenAIStreamChunk;
          } catch {
            continue;
          }
          const choice = chunk.choices?.[0];
          if (!choice) continue;
          if (choice.finish_reason) finishReason = choice.finish_reason;
          const delta = choice.delta;
          if (!delta) continue;
          if (typeof delta.content === "string" && delta.content) yield delta.content;
          for (const tc of delta.tool_calls ?? []) {
            const idx = tc.index ?? 0;
            if (!toolCalls[idx]) toolCalls[idx] = { id: "", name: "", arguments: "" };
            if (tc.id) toolCalls[idx].id = tc.id;
            if (tc.function?.name) toolCalls[idx].name += tc.function.name;
            if (tc.function?.arguments) toolCalls[idx].arguments += tc.function.arguments;
          }
        }
      }
      clearTimeout(timer);
      resolveDone({ toolCalls: toolCalls.filter((t) => t.id && t.name), finishReason });
    } catch (err) {
      clearTimeout(timer);
      rejectDone(err);
      throw err;
    }
  }

  return { textStream: textStream(), done };
}

interface OpenAIStreamChunk {
  choices?: {
    delta?: {
      content?: string | null;
      tool_calls?: {
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
    finish_reason?: string | null;
  }[];
}

function extractApiError(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    return parsed.error?.message;
  } catch {
    return undefined;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
