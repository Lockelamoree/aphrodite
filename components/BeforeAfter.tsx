"use client";

import { useState } from "react";

import type { Phase } from "@/hooks/useConcierge";

/**
 * Draggable comparison of the user's photo vs. YouCam's skin-analysis overlay
 * ("what YouCam sees"). Honest: the "after" is a real YouCam output, never a
 * fabricated future-skin image. Shows no unbounded shimmer — while analyzing it
 * displays the real selfie with a subtle note; if no overlay ever arrives it
 * simply shows the selfie.
 */
export function BeforeAfter({
  before,
  after,
  phase,
  title = "Your skin, seen by YouCam",
  caption = "YouCam Skin Analysis · AR overlay",
  beforeLabel = "Your photo",
  afterLabel = "What YouCam sees",
  busyLabel = "Analyzing with YouCam Skin AI…",
  sliderLabel = "Drag to compare your photo with YouCam's analysis",
}: {
  before: string;
  after?: string;
  phase: Phase;
  /** Header + labels; default to the skin-analysis wording. */
  title?: string;
  caption?: string;
  beforeLabel?: string;
  afterLabel?: string;
  busyLabel?: string;
  /** Accessible label for the compare slider; override for non-skin renders. */
  sliderLabel?: string;
}) {
  const [pos, setPos] = useState(55);
  const [touched, setTouched] = useState(false);
  const analyzing = phase === "running" && !after;

  return (
    <div className="relative w-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h3 className="font-serif text-lg text-ink">{title}</h3>
        <span className="text-[11px] text-muted">{caption}</span>
      </div>
      <div className="relative aspect-[4/5] w-full select-none">
        {/* base selfie */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before} alt="Your selfie" className="absolute inset-0 h-full w-full object-cover" />

        {after && (
          <>
            {/* Full-size overlay clipped to the left `pos%` so it stays pixel-aligned
                with the base selfie underneath. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={after}
              alt={afterLabel}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
            />
            <div
              className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90 shadow"
              style={{ left: `${pos}%` }}
            />
            <input
              type="range"
              min={0}
              max={100}
              value={pos}
              onChange={(e) => {
                setPos(Number(e.target.value));
                setTouched(true);
              }}
              aria-label={sliderLabel}
              className="peer absolute inset-0 h-full w-full cursor-ew-resize touch-pan-y appearance-none bg-transparent focus:outline-none"
            />
            {/* Visible circular grip (keyboard focus ring driven by the range's peer state). */}
            <div
              className="pointer-events-none absolute top-1/2 z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-primary shadow-md ring-1 ring-black/10 peer-focus-visible:ring-2 peer-focus-visible:ring-primary"
              style={{ left: `${pos}%` }}
              aria-hidden
            >
              <span className="text-sm leading-none">⇔</span>
            </div>
            <span className="absolute left-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-medium text-white">
              {beforeLabel}
            </span>
            <span className="absolute right-3 top-3 rounded-full bg-primary/85 px-2.5 py-1 text-xs font-medium text-white">
              {afterLabel}
            </span>
            {!touched && (
              <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink/70 px-3 py-1 text-xs text-white">
                Drag to compare
              </span>
            )}
          </>
        )}

        {analyzing && (
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-surface/85 px-3 py-1 text-xs text-muted">
            {busyLabel}
          </span>
        )}
      </div>
    </div>
  );
}
