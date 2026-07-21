"use client";

import { useEffect, useRef, useState } from "react";

import { BeforeAfter } from "@/components/BeforeAfter";
import { AphroditeMark, CompanionBubble, NextWithAphrodite } from "@/components/Companion";
import { Palette } from "@/components/Palette";
import { useConcierge, type ConciergeState, type Phase } from "@/hooks/useConcierge";
import { prettyConcern } from "@/lib/concierge/format";
import type {
  ConciergeRequest,
  LookBoard,
  RefineAdjust,
  ShoppingItem,
  SkinGoal,
  StyleTrack,
} from "@/lib/concierge/types";
import type { SkinAnalysis } from "@/lib/youcam/types";

const PRESETS: { occasion: string; label: string; descriptor: string }[] = [
  { occasion: "An evening wedding in 3 weeks", label: "Wedding", descriptor: "Multi-week glow arc" },
  { occasion: "A job interview tomorrow", label: "Interview", descriptor: "Same-day, camera-ready" },
  { occasion: "A first date on Friday", label: "First date", descriptor: "Elevated, this week" },
  { occasion: "A gala next month", label: "Gala", descriptor: "Black-tie polish" },
];

/** The agentic (Claude) engine only works when the server has an Anthropic key.
 * Expose that to the client so we never steer a judge into a broken toggle. */
const AGENTIC_ENABLED = process.env.NEXT_PUBLIC_HAS_ANTHROPIC === "1";

export function Concierge() {
  const { state, run, refine, reset } = useConcierge();
  const [occasion, setOccasion] = useState("");
  const [selfie, setSelfie] = useState<string>();
  const [body, setBody] = useState<string>();
  const [mode, setMode] = useState<NonNullable<ConciergeRequest["mode"]>>(
    AGENTIC_ENABLED ? "auto" : "deterministic",
  );
  const [skinGoal, setSkinGoal] = useState<SkinGoal>("balanced");
  const [track, setTrack] = useState<StyleTrack>("style");

  const canSubmit = occasion.trim().length > 2 && !!selfie && state.phase !== "running";

  function submit() {
    if (!selfie) return;
    run({ occasion: occasion.trim(), personImage: selfie, bodyImage: body, mode, skinGoal, track });
  }

  function startOver() {
    reset();
    setOccasion("");
    setSelfie(undefined);
    setBody(undefined);
  }

  // Load a bundled sample (as data URLs, so it behaves exactly like a real
  // upload in both fixture and live mode). Two distinct people so the demo
  // isn't identical every run: "wedding" = full-body, warm read; "date" =
  // selfie-only, cool read (exercises the no-full-body path honestly).
  async function loadSample(which: "wedding" | "date") {
    try {
      if (which === "wedding") {
        const [s, b] = await Promise.all([
          fetch("/samples/selfie.jpg").then((r) => r.blob()).then(fileToDataUrl),
          fetch("/samples/full-body.jpg").then((r) => r.blob()).then(fileToDataUrl),
        ]);
        setSelfie(s);
        setBody(b);
        if (!occasion.trim()) setOccasion("An evening wedding in 3 weeks");
      } else {
        const s = await fetch("/samples/selfie-2.jpg").then((r) => r.blob()).then(fileToDataUrl);
        setSelfie(s);
        setBody(undefined);
        if (!occasion.trim()) setOccasion("A first date on Friday");
      }
    } catch {
      /* sample load failed — ignore */
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:py-16">
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AphroditeMark size={26} />
          <span className="font-serif text-2xl tracking-tight text-primary">Aphrodite</span>
          <span className="hidden text-sm text-muted sm:inline">occasion concierge</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted sm:inline">
            Powered by <span className="font-medium text-primary">YouCam AI</span>
          </span>
          {state.phase !== "idle" && (
            <button
              onClick={startOver}
              className="rounded-full border border-line px-4 py-1.5 text-sm text-ink transition hover:bg-white focus-visible:ring-2 focus-visible:ring-primary"
            >
              Start over
            </button>
          )}
        </div>
      </header>

      {state.phase === "idle" ? (
        <section className="aura-fade-up">
          <h1 className="max-w-2xl font-serif text-4xl leading-tight text-ink sm:text-5xl">
            Tell me the occasion.
            <br />
            I&apos;ll get your skin and your look ready for it.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted">
            One selfie. Aphrodite reads your skin and your colors, then plans a skincare
            countdown timed to the day. Add a full-body photo and it renders the outfit
            on you.
          </p>
          <p className="mt-3 text-sm text-muted">
            Powered by <span className="font-medium text-primary">YouCam AI</span> — Skin
            Analysis · Color Analysis · Apparel Try-On · Photo Lighting
          </p>

          <div className="mt-6 max-w-xl">
            <CompanionBubble>
              Hi, I&apos;m <span className="font-medium text-primary">Aphrodite</span>, your beauty
              companion. Tell me the occasion and share a selfie — I&apos;ll read your skin and your
              colors and get you ready to shine. ✨
            </CompanionBubble>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
              <label className="text-sm font-medium text-ink">What&apos;s the occasion?</label>
              <textarea
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                rows={2}
                placeholder="e.g. An evening wedding in 3 weeks"
                className="mt-2 w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-primary"
              />
              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted">
                Or start from an occasion
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {PRESETS.map((p) => {
                  const active = occasion.trim() === p.occasion;
                  return (
                    <button
                      key={p.label}
                      onClick={() => setOccasion(p.occasion)}
                      aria-pressed={active}
                      className={`rounded-lg border px-3 py-2 text-left transition focus-visible:ring-2 focus-visible:ring-primary ${
                        active ? "border-primary bg-primary-soft" : "border-line hover:border-primary"
                      }`}
                    >
                      <span className="block text-sm font-medium text-ink">{p.label}</span>
                      <span className="block text-xs text-muted">{p.descriptor}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Uploader label="Selfie" required value={selfie} onChange={setSelfie} />
                <Uploader label="Full-body (optional)" value={body} onChange={setBody} />
              </div>
              <p className="mt-3 text-xs text-muted">
                For the skin read, use a clear, front-facing close-up. Photos are processed to
                generate your look and are not stored by Aphrodite.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="text-xs text-muted">No photo handy? Try a sample:</span>
                <button
                  type="button"
                  onClick={() => loadSample("wedding")}
                  className="text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Wedding · full-body →
                </button>
                <button
                  type="button"
                  onClick={() => loadSample("date")}
                  className="text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-primary"
                >
                  First date · selfie only →
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-x-10 gap-y-6">
            <div>
              <span className="text-sm text-muted">Skin focus</span>
              <div className="mt-2">
                <FocusToggle value={skinGoal} onChange={setSkinGoal} />
              </div>
            </div>
            <div>
              <span className="text-sm text-muted">Styling</span>
              <div className="mt-2">
                <TrackToggle value={track} onChange={setTrack} />
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted">Engine</span>
            <ModeToggle value={mode} onChange={setMode} />
          </div>
          <p className="mt-2 text-xs text-muted">{modeHint(mode)}</p>

          <button
            onClick={submit}
            disabled={!canSubmit}
            className="mt-6 rounded-full bg-primary px-7 py-3 text-base font-medium text-white shadow-sm transition enabled:hover:bg-[#8c3556] focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            Build my look
          </button>
        </section>
      ) : (
        <Results state={state} occasion={occasion} refine={refine} />
      )}
    </main>
  );
}

/* ---------------- results view ---------------- */

function Results({
  state,
  occasion,
  refine,
}: {
  state: ConciergeState;
  occasion: string;
  refine: (adjust: RefineAdjust) => void;
}) {
  const board = state.board;
  const boardRef = useRef<HTMLDivElement>(null);

  // Reveal: when the finished board arrives, scroll it into view.
  useEffect(() => {
    if (board && boardRef.current) {
      boardRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [board]);

  const headline =
    board?.headline ??
    (state.phase === "done" || state.phase === "error"
      ? "We couldn't finish your look board"
      : "Putting your plan together…");

  const apparelEmpty = state.hasBody
    ? "The outfit render didn't come through this time."
    : "Add a full-body photo to see the outfit rendered on you.";

  // The finish is a YouCam Photo-Lighting relight of the selfie — a warm,
  // camera-ready pass. (It re-lights; it doesn't re-crop into a headshot, so we
  // don't claim one.)
  const finishTitle = "Occasion lighting";
  const finishCaption = "YouCam AI Photo Lighting · warm relight";

  return (
    <section className="aura-fade-up space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm uppercase tracking-wide text-muted">{occasion}</p>
          {state.mode && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                state.mode === "agentic" ? "bg-primary text-white" : "border border-line text-muted"
              }`}
            >
              {state.mode === "agentic" ? "YouCam AI · orchestrated by Claude" : "YouCam AI · guided"}
            </span>
          )}
        </div>
        <h2 className="mt-1 font-serif text-3xl text-ink">{headline}</h2>
        <StatStrip state={state} />
        {board && <BoardActions board={board} occasion={occasion} />}
      </div>

      <StreamPanel state={state} />

      {state.error && (
        <div className="rounded-[var(--radius-card)] border border-rose/50 bg-rose/10 p-4 text-sm font-medium text-rose">
          {state.error}
        </div>
      )}

      {/* The deliverable leads once it exists. */}
      {board && (
        <div ref={boardRef} className="space-y-4">
          <CompanionBubble>
            Here&apos;s your look for {board.occasion || occasion || "the day"} — I&apos;m rather proud of
            this one ✨ Tweak the outfit below if you like, and save it to come back to.
          </CompanionBubble>
          <LookBoardPanel board={board} demo={state.demo} />
          <RefineBar refine={refine} disabled={state.phase === "running"} hasColor={!!state.color} />
        </div>
      )}

      {/* Supporting evidence — the YouCam renders behind the plan. */}
      <div className="space-y-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
          The details, seen &amp; rendered by YouCam
        </h3>
        <ApiLedger state={state} />
        <div className="grid gap-6 lg:grid-cols-2">
          {/* skin track */}
          <div className="space-y-6">
            {state.selfie && (
              <BeforeAfter before={state.selfie} after={state.images.skinOverlay} phase={state.phase} />
            )}
            {state.skin ? (
              <SkinConcerns skin={state.skin} />
            ) : (
              state.phase === "running" && <CardSkeleton title="Skin health scores" rows={5} />
            )}
          </div>

          {/* style track */}
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-1 lg:gap-6">
              <RenderSlot
                title="Your outfit"
                url={state.images.apparel}
                phase={state.phase}
                busyLabel="Rendering your outfit with YouCam…"
                emptyLabel={apparelEmpty}
                caption="YouCam Apparel Try-On · see it on before you buy"
                fit="contain"
              />
              <RenderSlot
                title={finishTitle}
                url={state.images.finish}
                phase={state.phase}
                busyLabel="Adding YouCam occasion lighting…"
                emptyLabel="No lighting pass this run."
                caption={finishCaption}
              />
            </div>
            {state.color ? (
              <Palette profile={state.color} />
            ) : (
              state.phase === "running" && <CardSkeleton title="Your colors" rows={3} />
            )}
          </div>
        </div>
      </div>

      {board && <NextWithAphrodite />}

      <p className="aura-print-only mt-6 text-center text-xs text-muted">
        Generated by Aphrodite · powered by YouCam AI
        {state.demo ? " · demo mode (sample renders)" : " · outfit & lighting rendered on you by YouCam AI"}
      </p>
    </section>
  );
}

function BoardActions({ board, occasion }: { board: LookBoard; occasion: string }) {
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const summary = boardSummary(board, occasion);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — no-op */
    }
  };
  const share = () => {
    navigator.share?.({ title: `Aphrodite — ${board.headline}`, text: summary }).catch(() => {});
  };

  const btn =
    "rounded-full border border-line px-4 py-1.5 text-sm text-ink transition hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-primary";
  return (
    <div className="aura-no-print mt-3 flex flex-wrap gap-2">
      <button onClick={() => window.print()} className={btn}>
        Save as PDF
      </button>
      <button onClick={copy} className={btn}>
        {copied ? "Copied ✓" : "Copy summary"}
      </button>
      {canShare && (
        <button onClick={share} className={btn}>
          Share
        </button>
      )}
    </div>
  );
}

function boardSummary(board: LookBoard, occasion: string): string {
  const lines: string[] = [`Aphrodite — ${board.headline}`, occasion, ""];
  if (board.narrative) lines.push(board.narrative, "");
  if (board.countdown.length) {
    lines.push("Skin-prep countdown:");
    board.countdown.forEach((s) => lines.push(`• ${s.when}: ${s.action}`));
    lines.push("");
  }
  if (board.shopping.length) {
    lines.push("Shop the look:");
    board.shopping.forEach((s) => lines.push(`• ${s.category}${s.price ? ` — $${s.price}` : ""}`));
    const total = board.shopping.reduce((n, s) => n + (s.price ?? 0), 0);
    if (total) lines.push(`Total: $${total}`);
    lines.push("");
  }
  lines.push("Powered by YouCam AI");
  return lines.join("\n");
}

const REFINEMENTS: { adjust: RefineAdjust; label: string }[] = [
  { adjust: "reroll", label: "Try another" },
  { adjust: "less_formal", label: "Less formal" },
  { adjust: "more_formal", label: "More formal" },
  { adjust: "cooler", label: "Cooler colors" },
  { adjust: "warmer", label: "Warmer colors" },
];

function RefineBar({
  refine,
  disabled,
  hasColor,
}: {
  refine: (adjust: RefineAdjust) => void;
  disabled: boolean;
  hasColor: boolean;
}) {
  // Cooler/Warmer only make sense if we actually read color — the grooming
  // track skips color analysis, so those controls would narrate a tone shift
  // with no basis. Hide them there.
  const refinements = hasColor
    ? REFINEMENTS
    : REFINEMENTS.filter((r) => r.adjust !== "cooler" && r.adjust !== "warmer");
  return (
    <div className="aura-no-print mt-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
        Not quite it? Refine the outfit
      </p>
      <div className="flex flex-wrap gap-2">
        {refinements.map((r) => (
          <button
            key={r.adjust}
            disabled={disabled}
            onClick={() => refine(r.adjust)}
            className="rounded-full border border-line px-3 py-1.5 text-xs text-ink transition hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatStrip({ state }: { state: ConciergeState }) {
  const stats: string[] = [];
  if (state.skin) stats.push(`${state.skin.concerns.length} skin concerns scored`);
  if (typeof state.board?.daysUntil === "number") {
    stats.push(state.board.daysUntil <= 0 ? "same-day plan" : `${state.board.daysUntil}-day plan`);
  } else if (state.board) {
    stats.push("multi-week plan");
  }
  if (state.board) stats.push(`${state.board.shopping.length} products`);
  if (state.color?.undertone) stats.push(`${state.color.undertone} undertone`);
  if (stats.length === 0) return null;
  return <p className="mt-2 text-sm text-primary">{stats.join(" · ")}</p>;
}

function StreamPanel({ state }: { state: ConciergeState }) {
  const last = state.steps.length - 1;
  return (
    <div className="aura-no-print rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <div className="mb-3 flex flex-wrap gap-2">
        {state.steps.map((s, i) => {
          const active = state.phase === "running" && i === last;
          const failed =
            s.name === "try_on_apparel" && state.phase === "done" && !state.images.apparel;
          const cls = failed
            ? "bg-rose/10 text-rose"
            : active
              ? "bg-primary text-white"
              : "bg-primary-soft text-primary";
          return (
            <span
              key={`${s.name}-${i}`}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${cls}`}
            >
              {failed ? <span aria-hidden>✗</span> : active ? <Dot light /> : <span aria-hidden>✓</span>}
              {s.label}
            </span>
          );
        })}
      </div>
      <p
        aria-live="polite"
        className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink"
      >
        {state.narration || "Aphrodite is reviewing your photo…"}
      </p>
    </div>
  );
}

const API_ROWS: { key: "skin" | "color" | "apparel" | "finish"; label: string; step: string }[] = [
  { key: "skin", label: "Skin Analysis", step: "analyze_skin" },
  { key: "color", label: "Color / Skin-Tone", step: "analyze_color" },
  { key: "apparel", label: "Apparel Try-On", step: "try_on_apparel" },
  { key: "finish", label: "Photo Lighting", step: "finish" },
];

type LedgerStatus = "done" | "running";

/** Honest provenance derived from what's actually on screen (data present), not
 * just the live step log — so it stays accurate after an in-place refine that
 * keeps the skin/color reads without re-emitting them. */
function ApiLedger({ state }: { state: ConciergeState }) {
  const present = {
    skin: !!state.skin,
    color: !!state.color,
    apparel: !!state.images.apparel,
    finish: !!state.images.finish,
  };
  const activeStep =
    state.phase === "running" ? state.steps[state.steps.length - 1]?.name : undefined;
  const rows = API_ROWS.flatMap((r) => {
    if (present[r.key]) return [{ label: r.label, status: "done" as LedgerStatus }];
    if (activeStep === r.step) return [{ label: r.label, status: "running" as LedgerStatus }];
    return [];
  });
  if (rows.length === 0) return null;
  const count = rows.filter((r) => r.status === "done").length;
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
        Powered by <span className="text-primary">YouCam AI</span> — {count} Perfect Corp{" "}
        {count === 1 ? "API" : "APIs"} this run
      </p>
      <div className="flex flex-wrap gap-2">
        {rows.map((r, i) => (
          <span
            key={i}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              r.status === "done"
                ? "bg-primary-soft text-primary"
                : r.status === "running"
                  ? "bg-primary text-white"
                  : "border border-line text-muted"
            }`}
          >
            {r.status === "done" ? (
              <span aria-hidden>✓</span>
            ) : r.status === "running" ? (
              <Dot light />
            ) : (
              <span aria-hidden>–</span>
            )}
            {r.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function SkinConcerns({ skin }: { skin: SkinAnalysis }) {
  // Lowest health = most room; show those first.
  const total = skin.concerns.length;
  const focus = [...skin.concerns].sort((a, b) => a.score - b.score).slice(0, 6);
  if (focus.length === 0) return null;
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <h3 className="mb-1 font-serif text-xl text-ink">Skin health scores</h3>
      <p className="mb-3 text-xs text-muted">
        Your {focus.length} priority areas{total > focus.length ? ` — the lowest of ${total} YouCam scored` : ""} ·
        0–100, higher is healthier · YouCam Skin Analysis
      </p>
      <ul className="space-y-2.5">
        {focus.map((c) => {
          const s = clamp(c.score);
          const strong = s >= 75;
          const watch = !strong && s >= 55;
          const tone = strong ? "bg-leaf" : watch ? "bg-gold" : "bg-primary";
          const word = strong ? "Strong" : watch ? "Watch" : "Focus";
          // Keep the label calm and on-brand (no alarm-red "Focus"): the bar
          // still carries the health signal; the chip never shames.
          const wordCls = strong
            ? "bg-leaf/20 text-ink"
            : watch
              ? "bg-gold/25 text-ink"
              : "bg-primary/15 text-ink";
          return (
            <li key={c.name} aria-label={`${prettyConcern(c.name)}: skin health ${Math.round(c.score)} out of 100 — ${word}`}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="capitalize text-ink">{prettyConcern(c.name)}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${wordCls}`}>
                    {word}
                  </span>
                </span>
                <span className="text-muted">
                  {Math.round(c.score)}
                  <span className="text-xs">/100</span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden>
                <div className={`h-full rounded-full ${tone}`} style={{ width: `${s}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RenderSlot({
  title,
  url,
  phase,
  busyLabel,
  emptyLabel,
  caption,
  fit = "cover",
}: {
  title: string;
  url?: string;
  phase: Phase;
  busyLabel: string;
  emptyLabel: string;
  caption?: string;
  fit?: "cover" | "contain";
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h3 className="font-serif text-lg text-ink">{title}</h3>
        {caption && url && (
          <span className="truncate text-right text-[11px] text-muted">{caption}</span>
        )}
      </div>
      <div className="relative aspect-[4/5] w-full bg-paper">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={title}
            className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"}`}
          />
        ) : phase === "running" ? (
          <div className="aura-skeleton flex h-full items-center justify-center">
            <span className="rounded-full bg-surface/80 px-3 py-1 text-xs text-muted">{busyLabel}</span>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="px-4 text-center text-xs text-muted">{emptyLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function LookBoardPanel({ board, demo }: { board: LookBoard; demo?: boolean }) {
  const products = board.shopping.filter((s) => typeof s.price === "number");
  const total = products.reduce((sum, p) => sum + (p.price ?? 0), 0);
  return (
    <div className="aura-reveal space-y-6 rounded-[var(--radius-card)] border border-primary/25 bg-surface p-6 shadow-sm">
      {board.narrative && (
        <p className="max-w-3xl font-serif text-lg leading-relaxed text-ink">{board.narrative}</p>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        {board.countdown.length > 0 && (
          <div>
            <h3 className="mb-4 font-serif text-xl text-ink">Skin-prep countdown</h3>
            <ol className="relative space-y-4 border-l border-line pl-5">
              {board.countdown.map((s, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-primary-soft" />
                  <p className="text-sm font-medium text-primary">{s.when}</p>
                  <p className="text-[15px] text-ink">{s.action}</p>
                  {s.productCategory && <p className="text-xs text-muted">→ {s.productCategory}</p>}
                </li>
              ))}
            </ol>
          </div>
        )}

        {board.shopping.length > 0 && (
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <h3 className="font-serif text-xl text-ink">Shop the look</h3>
              {total > 0 && (
                <span className="text-sm text-muted">
                  Complete the look · <span className="font-medium text-ink">${total}</span>
                </span>
              )}
            </div>
            <p className="mb-4 text-xs text-muted">
              Skincare, outfit &amp; accessories in one basket · your outfit is rendered on you with
              YouCam AI; the rest are curated to match.
            </p>
            <ul className="space-y-3">
              {board.shopping.map((item, i) => (
                <ShopItem key={i} item={item} />
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-line pt-4">
        <p className="text-xs text-muted">
          {demo ? (
            <>
              <span className="font-medium text-primary">Demo mode</span> — these are sample{" "}
              <span className="font-medium text-primary">YouCam AI</span> renders. Add your own photo
              with live keys and Aphrodite generates them on you.
            </>
          ) : (
            <>
              Your outfit and lighting are rendered on you by{" "}
              <span className="font-medium text-primary">YouCam AI</span>; your skin scores and colors
              read straight from YouCam&apos;s analysis.
            </>
          )}
        </p>
        <details className="aura-no-print text-sm">
          <summary className="cursor-pointer font-medium text-ink">Retail impact</summary>
          <ul className="mt-2 space-y-1 text-muted">
            <li>
              Basket: {board.shopping.length} items ·{" "}
              <span className="font-medium text-ink">${total}</span> across skincare, fashion &amp;
              accessories
            </li>
            <li>
              The outfit is rendered on the shopper before purchase — Perfect Corp reports AR/AI
              try-on lifting conversion and reducing returns.
            </li>
            <li>
              First-party signal captured: occasion
              {typeof board.daysUntil === "number" ? ` · ${board.daysUntil}-day timeline` : ""}
            </li>
          </ul>
        </details>
      </div>
    </div>
  );
}

function ShopItem({ item }: { item: ShoppingItem }) {
  const isSku = typeof item.price === "number";
  return (
    <li className="flex items-center gap-3 rounded-lg border border-line bg-paper p-3">
      {item.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt={item.category} className="h-14 w-14 rounded-md object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{item.category}</p>
        <p className="truncate text-sm text-muted">{item.why}</p>
        {item.retailer && (
          <p className="text-xs text-muted">
            {item.retailer}
            {isSku && <span className="text-ink"> · ${item.price}</span>}
          </p>
        )}
      </div>
      {isSku && item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#8c3556]"
        >
          Shop
        </a>
      )}
    </li>
  );
}

/* ---------------- small pieces ---------------- */

function Uploader({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value?: string;
  onChange: (dataUrl: string) => void;
  required?: boolean;
}) {
  const [drag, setDrag] = useState(false);
  const take = async (f?: File | null) => {
    if (f && f.type.startsWith("image/")) onChange(await fileToDataUrl(f));
  };
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        void take(e.dataTransfer.files?.[0]);
      }}
      className={`group relative flex aspect-[4/5] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed text-center transition ${
        drag ? "border-primary bg-primary-soft" : "border-line bg-paper hover:border-primary"
      }`}
    >
      {value ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="h-full w-full object-cover" />
          <span className="absolute inset-x-0 bottom-0 bg-ink/60 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
            Replace
          </span>
        </>
      ) : (
        <span className="px-2 text-xs text-muted">
          {label}
          {required && <span className="text-rose"> *</span>}
          <br />
          <span className="text-primary group-hover:underline">upload or drop</span>
        </span>
      )}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void take(e.target.files?.[0])}
      />
    </label>
  );
}

type ModeValue = NonNullable<ConciergeRequest["mode"]>;

function modeHint(mode: ModeValue): string {
  if (!AGENTIC_ENABLED && (mode === "agentic" || mode === "auto")) {
    return "Agentic (Claude) needs an Anthropic key — this build runs the guided engine.";
  }
  if (mode === "agentic") return "Claude reasons over YouCam's outputs and drives each API.";
  if (mode === "auto") return "Uses Claude when a key is configured, otherwise the guided engine.";
  return "Rule-based — runs on the YouCam key alone, no Anthropic key needed.";
}

function ModeToggle({ value, onChange }: { value: ModeValue; onChange: (v: ModeValue) => void }) {
  const opts: { v: ModeValue; label: string; disabled?: boolean }[] = [
    { v: "auto", label: "Auto" },
    { v: "agentic", label: "Agentic", disabled: !AGENTIC_ENABLED },
    { v: "deterministic", label: "Guided" },
  ];
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-line">
      {opts.map((o) => (
        <button
          key={o.v}
          disabled={o.disabled}
          title={o.disabled ? "Needs an Anthropic key" : undefined}
          onClick={() => !o.disabled && onChange(o.v)}
          className={`px-3.5 py-2 text-sm transition ${
            value === o.v ? "bg-primary text-white" : "bg-surface text-muted hover:text-ink"
          } ${o.disabled ? "cursor-not-allowed opacity-40" : ""}`}
        >
          {o.label}
          {o.v === "agentic" && !AGENTIC_ENABLED && <span className="ml-1 text-[10px]">· needs key</span>}
        </button>
      ))}
    </div>
  );
}

const SKIN_GOALS: { v: SkinGoal; label: string }[] = [
  { v: "balanced", label: "Balanced" },
  { v: "glow", label: "Glow" },
  { v: "firm", label: "Smooth & firm" },
  { v: "clear", label: "Clear" },
  { v: "even", label: "Even tone" },
];

function FocusToggle({ value, onChange }: { value: SkinGoal; onChange: (v: SkinGoal) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {SKIN_GOALS.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          className={`rounded-full border px-3 py-1.5 text-xs transition focus-visible:ring-2 focus-visible:ring-primary ${
            value === o.v
              ? "border-primary bg-primary text-white"
              : "border-line text-muted hover:border-primary hover:text-primary"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const TRACKS: { v: StyleTrack; label: string }[] = [
  { v: "style", label: "Outfit & color" },
  { v: "grooming", label: "Grooming" },
];

function TrackToggle({ value, onChange }: { value: StyleTrack; onChange: (v: StyleTrack) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-line">
      {TRACKS.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          className={`px-3.5 py-2 text-sm transition ${
            value === o.v ? "bg-primary text-white" : "bg-surface text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CardSkeleton({ title, rows }: { title: string; rows: number }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <h3 className="mb-3 font-serif text-xl text-ink">{title}</h3>
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="aura-skeleton h-3 rounded-full" style={{ width: `${90 - i * 6}%` }} />
        ))}
      </div>
    </div>
  );
}

function Dot({ light }: { light?: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 animate-pulse rounded-full ${light ? "bg-white" : "bg-primary"}`}
    />
  );
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
