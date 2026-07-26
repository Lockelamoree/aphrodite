"use client";

import { type ReactNode } from "react";

import { BeforeAfter } from "@/components/BeforeAfter";
import { prettyConcern } from "@/lib/concierge/format";
import type { StudioKind } from "@/lib/concierge/types";
import { useStudio, type StudioResult } from "@/hooks/useStudio";

/** Aphrodite's emblem — a five-petal cherry blossom, theme-tinted, no image asset. */
export function AphroditeMark({ size = 28 }: { size?: number }) {
  const petals = [0, 72, 144, 216, 288];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="Aphrodite">
      <g transform="translate(20 20)">
        {petals.map((a) => (
          <ellipse
            key={a}
            cx="0"
            cy="-10"
            rx="5"
            ry="8"
            transform={`rotate(${a})`}
            fill="var(--color-primary)"
            opacity="0.85"
          />
        ))}
        <circle r="3.6" fill="var(--color-gold)" />
      </g>
    </svg>
  );
}

/** A small speech bubble from Aphrodite — gives the assistant a face + voice. */
export function CompanionBubble({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "soft";
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0">
        <AphroditeMark size={34} />
      </span>
      <div
        className={`max-w-2xl rounded-2xl rounded-tl-sm border border-line px-4 py-2.5 text-[15px] leading-relaxed text-ink ${
          tone === "soft" ? "bg-paper" : "bg-surface"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

/** The follow-on YouCam experiences Aphrodite can render on the same selfie —
 * the cross-product + retention surface. Each tap runs a real YouCam feature. */
interface Experience {
  key: StudioKind;
  label: string;
  api: string;
  /** Labels for the before/after compare of the render. */
  title: string;
  beforeLabel: string;
  afterLabel: string;
}

const EXPERIENCES: Experience[] = [
  { key: "hair_color", label: "New hair color", api: "YouCam AI Hair Color", title: "Your new hair color", beforeLabel: "Your shade", afterLabel: "New color" },
  { key: "hairstyle", label: "Try a hairstyle", api: "YouCam AI Hairstyle Generator", title: "Your new hairstyle", beforeLabel: "Your hair", afterLabel: "New style" },
  { key: "makeup", label: "Makeup look", api: "YouCam AI Makeup Try-On", title: "Your occasion makeup", beforeLabel: "Bare face", afterLabel: "With makeup" },
  { key: "skin_recheck", label: "Track my glow", api: "YouCam AI Skin Analysis", title: "Your skin, re-read by YouCam", beforeLabel: "Your photo", afterLabel: "What YouCam sees" },
];

export function NextWithAphrodite({
  selfie,
  undertone,
  demo,
}: {
  selfie?: string;
  undertone?: string;
  demo?: boolean;
}) {
  const { active, render } = useStudio(selfie, undertone);

  return (
    <div className="aura-no-print rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <h3 className="font-serif text-xl text-ink">What&apos;s next with Aphrodite</h3>
      <p className="mb-3 mt-1 text-xs text-muted">
        Tap an experience — each is a real YouCam product.{" "}
        {demo
          ? "In demo the skin re-check runs on captured data; hair, color, and makeup render on your own photo once you add a YouCam key."
          : "I’ll render it on your selfie the same way as your outfit."}
      </p>

      <div className="flex flex-wrap gap-2">
        {EXPERIENCES.map((x) => {
          const on = active?.kind === x.key;
          const running = on && active?.phase === "running";
          return (
            <button
              key={x.key}
              onClick={() => render(x.key)}
              disabled={!selfie || running}
              aria-pressed={on}
              title={x.api}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60 ${
                on
                  ? "border-primary bg-primary text-white"
                  : "border-line text-ink hover:border-primary hover:text-primary"
              }`}
            >
              {running && (
                <span
                  aria-hidden
                  className="h-3 w-3 animate-spin rounded-full border border-white/70 border-t-transparent"
                />
              )}
              {x.label}
            </button>
          );
        })}
      </div>

      {!selfie ? (
        <p className="mt-4 text-xs text-muted">
          Build your look first, then try any of these on your selfie.
        </p>
      ) : active ? (
        <StudioPanel active={active} selfie={selfie} />
      ) : (
        <p className="mt-4 text-xs text-muted">
          Nothing tried yet — tap an experience above
          {demo ? " (the skin re-check renders in demo)" : " to see it rendered on you"}.
        </p>
      )}
    </div>
  );
}

function StudioPanel({ active, selfie }: { active: StudioResult; selfie: string }) {
  const exp = EXPERIENCES.find((x) => x.key === active.kind)!;
  const reply = active.narration.trim();
  const hasRender = Boolean(active.imageUrl);

  return (
    <div className="mt-4 space-y-3">
      {reply && <CompanionBubble tone="soft">{reply}</CompanionBubble>}

      {active.phase === "error" ? (
        <p className="text-sm text-primary">
          {active.error ?? "That didn't come through — try again in a moment."}
        </p>
      ) : hasRender ? (
        <>
          <BeforeAfter
            before={selfie}
            after={active.imageUrl}
            phase={active.phase === "running" ? "running" : "done"}
            title={exp.title}
            caption={`${exp.api}${active.demo ? " · sample render" : " · rendered on you"}`}
            beforeLabel={exp.beforeLabel}
            afterLabel={exp.afterLabel}
            busyLabel={`Rendering with ${exp.api}…`}
            sliderLabel={`Drag to compare ${exp.beforeLabel} with ${exp.afterLabel}`}
          />
          {active.kind === "skin_recheck" && active.skin && <GlowSummary skin={active.skin} />}
        </>
      ) : active.phase === "running" ? (
        <div className="flex items-center gap-2 text-sm text-muted">
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-primary/60 border-t-transparent"
          />
          Rendering with {exp.api}…
        </div>
      ) : (
        // Done, but no render (honest demo/degrade state — the narration explains why).
        active.kind === "skin_recheck" && active.skin ? (
          <GlowSummary skin={active.skin} />
        ) : null
      )}
    </div>
  );
}

/** The 2 lowest-health areas from a re-check, so "track my glow" is concrete. */
function GlowSummary({ skin }: { skin: { concerns: { name: string; score: number }[] } }) {
  const lowest = [...skin.concerns].sort((a, b) => a.score - b.score).slice(0, 2);
  if (!lowest.length) return null;
  return (
    <p className="text-xs text-muted">
      Lowest right now:{" "}
      {lowest.map((c, i) => (
        <span key={c.name}>
          {i > 0 ? ", " : ""}
          <span className="text-ink">{prettyConcern(c.name)}</span> ({Math.round(c.score)}/100)
        </span>
      ))}
      . Re-check after a week on your plan to see your progress.
    </p>
  );
}
