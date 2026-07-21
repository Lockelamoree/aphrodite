"use client";

import { useCallback, useReducer, useRef } from "react";

import type {
  ConciergeEvent,
  ConciergeMode,
  ConciergeRequest,
  ImageSlot,
  LookBoard,
  RefineAdjust,
} from "@/lib/concierge/types";
import type { ColorProfile, SkinAnalysis } from "@/lib/youcam/types";

export type Phase = "idle" | "running" | "done" | "error";

export interface ConciergeState {
  phase: Phase;
  mode?: ConciergeMode;
  /** Server told us this run used captured fixtures (demo) rather than live YouCam calls. */
  demo?: boolean;
  narration: string;
  steps: { name: string; label: string }[];
  skin?: SkinAnalysis;
  color?: ColorProfile;
  images: Partial<Record<ImageSlot, string>>;
  board?: LookBoard;
  /** Original selfie data URL, for before/after comparison. */
  selfie?: string;
  /** Whether the user supplied a full-body photo (drives honest apparel states). */
  hasBody?: boolean;
  error?: string;
}

const initialState: ConciergeState = {
  phase: "idle",
  narration: "",
  steps: [],
  images: {},
};

type Action =
  | ConciergeEvent
  | { type: "start"; selfie: string; hasBody: boolean }
  | { type: "refine_start" }
  | { type: "reset" };

function reducer(state: ConciergeState, action: Action): ConciergeState {
  switch (action.type) {
    case "reset":
      return initialState;
    case "start":
      return {
        ...initialState,
        phase: "running",
        selfie: action.selfie,
        hasBody: action.hasBody,
      };
    case "refine_start":
      // Re-styling in place: keep the board, renders, skin + color ON SCREEN so
      // the deliverable and refine controls don't vanish; streaming events
      // overwrite the outfit + board when the new look arrives.
      return { ...state, phase: "running", error: undefined, narration: "", steps: [] };
    case "mode":
      return { ...state, mode: action.mode, demo: action.demo ?? state.demo };
    case "narration":
      return { ...state, narration: state.narration + action.text };
    case "tool_start":
      return {
        ...state,
        steps: [...state.steps, { name: action.name, label: action.label }],
      };
    case "skin":
      return { ...state, skin: action.analysis };
    case "color":
      return { ...state, color: action.profile };
    case "image":
      return { ...state, images: { ...state.images, [action.slot]: action.url } };
    case "board":
      return { ...state, board: action.board };
    case "error":
      return { ...state, phase: "error", error: action.message };
    case "done":
      return { ...state, phase: state.phase === "error" ? "error" : "done" };
    default:
      return state;
  }
}

export function useConcierge() {
  const [state, dispatch] = useReducer(reducer, initialState);
  // Latest state + base request, read by refine() without stale closures.
  const stateRef = useRef(state);
  stateRef.current = state;
  const lastReq = useRef<ConciergeRequest | null>(null);

  const streamRun = useCallback(async (req: ConciergeRequest) => {
    // Wall-clock guard so a stalled connection can't spin the UI forever.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 240_000);
    try {
      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        dispatch({ type: "error", message: await safeError(res) });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          try {
            dispatch(JSON.parse(dataLine.slice(5).trim()) as ConciergeEvent);
          } catch {
            /* ignore malformed frame */
          }
        }
      }
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "AbortError"
          ? "This took longer than expected — please try again."
          : err instanceof Error
            ? err.message
            : String(err);
      dispatch({ type: "error", message });
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  const run = useCallback(
    async (req: ConciergeRequest) => {
      lastReq.current = req;
      dispatch({ type: "reset" });
      dispatch({ type: "start", selfie: req.personImage, hasBody: Boolean(req.bodyImage) });
      await streamRun(req);
    },
    [streamRun],
  );

  /** Re-style the current look in place (reusing the prior skin/color reads). */
  const refine = useCallback(
    async (adjust: RefineAdjust) => {
      const base = lastReq.current;
      const s = stateRef.current;
      if (!base || s.phase === "running") return;
      dispatch({ type: "refine_start" });
      await streamRun({
        occasion: base.occasion,
        personImage: base.personImage,
        bodyImage: base.bodyImage,
        mode: base.mode,
        skinGoal: base.skinGoal,
        track: base.track,
        refine: {
          adjust,
          currentGarmentId: s.board?.garmentId,
          undertone: s.color?.undertone,
          concerns: s.skin?.concerns.map((c) => ({ name: c.name, score: c.score })),
        },
      });
    },
    [streamRun],
  );

  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  return { state, run, refine, reset };
}

async function safeError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    return j.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}
