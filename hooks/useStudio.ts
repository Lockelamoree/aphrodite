"use client";

import { useCallback, useRef, useState } from "react";

import type { ConciergeEvent, StudioKind } from "@/lib/concierge/types";
import type { SkinAnalysis } from "@/lib/youcam/types";

export interface StudioResult {
  kind: StudioKind;
  phase: "running" | "done" | "error";
  narration: string;
  /** Rendered image (hair/makeup) or skin overlay (skin_recheck). */
  imageUrl?: string;
  /** Present for skin_recheck. */
  skin?: SkinAnalysis;
  /** Server ran on captured fixtures rather than live YouCam. */
  demo?: boolean;
  error?: string;
}

/**
 * Drives the follow-on "studio" try-ons (hair color, hairstyle, makeup, skin
 * re-check). One render at a time: a new render aborts the previous. Streams
 * `/api/studio` and reuses the concierge SSE frame format.
 */
export function useStudio(personImage?: string, undertone?: string) {
  const [active, setActive] = useState<StudioResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const render = useCallback(
    async (kind: StudioKind) => {
      if (!personImage) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const timeout = setTimeout(() => controller.abort(), 150_000);
      setActive({ kind, phase: "running", narration: "" });

      const update = (patch: Partial<StudioResult>) =>
        setActive((cur) => (cur && cur.kind === kind ? { ...cur, ...patch } : cur));
      const apply = (ev: ConciergeEvent) => {
        switch (ev.type) {
          case "mode":
            update({ demo: ev.demo });
            break;
          case "narration":
            setActive((cur) =>
              cur && cur.kind === kind ? { ...cur, narration: cur.narration + ev.text } : cur,
            );
            break;
          case "image":
            update({ imageUrl: ev.url });
            break;
          case "skin":
            update({ skin: ev.analysis });
            break;
          case "error":
            update({ phase: "error", error: ev.message });
            break;
          case "done":
            update({ phase: "done" });
            break;
        }
      };

      try {
        const res = await fetch("/api/studio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, personImage, undertone }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          update({ phase: "error", error: `Request failed (${res.status})` });
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
            const line = chunk.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            try {
              apply(JSON.parse(line.slice(5).trim()) as ConciergeEvent);
            } catch {
              /* ignore malformed frame */
            }
          }
        }
      } catch (err) {
        const message =
          err instanceof DOMException && err.name === "AbortError"
            ? "" // superseded by a newer render; leave state to the new one
            : err instanceof Error
              ? err.message
              : String(err);
        if (message) update({ phase: "error", error: message });
      } finally {
        clearTimeout(timeout);
      }
    },
    [personImage, undertone],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setActive(null);
  }, []);

  return { active, render, reset };
}
