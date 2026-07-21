"use client";

import { useState, type ReactNode } from "react";

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
  children: React.ReactNode;
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

/** More YouCam experiences Aphrodite can guide the user through next — the
 * cross-product + retention surface. Framed honestly as "next time" invitations
 * (each names the real YouCam product); tapping gives a warm companion reply. */
const NEXT: { key: string; label: string; api: string; reply: string }[] = [
  { key: "hair-color", label: "New hair color", api: "YouCam AI Hair Color", reply: "A fresh shade — love it. Next time we'll find the color that lights you up ✨" },
  { key: "hairstyle", label: "Try a hairstyle", api: "YouCam AI Hairstyle Generator", reply: "Let's play with a new cut next — I'll pull the shapes that flatter your face." },
  { key: "makeup", label: "Makeup look", api: "YouCam AI Makeup Try-On", reply: "A makeup look in your palette? Say the word and I'll paint it on you." },
  { key: "nails", label: "Nails", api: "YouCam AI Nail Try-On", reply: "Nails to finish the whole look — noted for next time 💅" },
  { key: "jewelry", label: "Jewelry", api: "YouCam AI Jewelry Try-On", reply: "Earrings and a necklace, rendered on you — let's make it sparkle next." },
  { key: "track", label: "Track my glow", api: "YouCam AI Skin Analysis", reply: "Come back in a week and I'll re-read your skin so you can watch your progress." },
];

export function NextWithAphrodite() {
  const [picked, setPicked] = useState<string | null>(null);
  const chosen = NEXT.find((n) => n.key === picked);
  return (
    <div className="aura-no-print rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <h3 className="font-serif text-xl text-ink">What&apos;s next with Aphrodite</h3>
      <p className="mb-3 mt-1 text-xs text-muted">
        More YouCam experiences I can guide you through — pick one to line up for next time.
      </p>
      <div className="flex flex-wrap gap-2">
        {NEXT.map((n) => (
          <button
            key={n.key}
            onClick={() => setPicked(n.key)}
            aria-pressed={picked === n.key}
            title={n.api}
            className={`rounded-full border px-3 py-1.5 text-xs transition focus-visible:ring-2 focus-visible:ring-primary ${
              picked === n.key
                ? "border-primary bg-primary text-white"
                : "border-line text-ink hover:border-primary hover:text-primary"
            }`}
          >
            {n.label}
          </button>
        ))}
      </div>
      {chosen && (
        <div className="mt-4">
          <CompanionBubble tone="soft">
            {chosen.reply}
            <span className="mt-1 block text-xs text-muted">Powered by {chosen.api}</span>
          </CompanionBubble>
        </div>
      )}
    </div>
  );
}
