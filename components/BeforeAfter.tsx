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
  beforeAlt = "Your selfie",
  headingLevel = "h3",
  aspectClass = "aspect-[4/5]",
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
  /** Alt text for the base image — it isn't always the user's own selfie. */
  beforeAlt?: string;
  /** So the same component can sit under different parents without breaking the
   *  document outline (the hero needs an h2, the results grid an h3). */
  headingLevel?: "h2" | "h3";
  /** Frame shape. The results grid wants a 4:5 portrait; the hero needs a shorter
   *  frame on phones so it stays proof rather than a wall between the visitor and
   *  the form. */
  aspectClass?: string;
}) {
  const Heading = headingLevel;
  const [pos, setPos] = useState(55);
  const [touched, setTouched] = useState(false);
  const analyzing = phase === "running" && !after;

  return (
    <div className="relative w-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <Heading className="font-serif text-lg text-ink">{title}</Heading>
        <span className="text-[11px] text-muted">{caption}</span>
      </div>
      <div className={`relative w-full select-none ${aspectClass}`}>
        {/* base selfie */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before} alt={beforeAlt} className="absolute inset-0 h-full w-full object-cover" />

        {after && (
          <>
            {/* Full-size overlay clipped to the RIGHT of the divider so it stays
                pixel-aligned with the base selfie underneath — and so it sits on the
                side its own label is pinned to.

                This used to clip to inset(0 (100-pos)% 0 0), i.e. the overlay was
                revealed on the LEFT while beforeLabel sat left-3 and afterLabel
                right-3. Every frame therefore labelled the YouCam render "the photo"
                and the untouched original "YouCam render" — the provenance pills read
                backwards on the hero card whose caption is "Not an illustration, not
                a stock pair." Labels stay where they are (left = before, right =
                after, and the pill contrast was tuned in those positions); the clip
                moved to match them. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={after}
              alt={afterLabel}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
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
            <span // Opaque, not /85: over a light photo the translucent pill composited to
            // 4.21:1 against its own white label, under AA for 12px text.
            className="absolute right-3 top-3 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-white">
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
