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
  const [selected, setSelected] = useState<string[]>([]);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const toggle = (key: string) => {
    setCopied(false);
    setSelected((cur) => {
      const has = cur.includes(key);
      if (!has) setLastAdded(key);
      else if (lastAdded === key) setLastAdded(null);
      return has ? cur.filter((k) => k !== key) : [...cur, key];
    });
  };

  const chosen = NEXT.filter((n) => selected.includes(n.key));
  const reply = NEXT.find((n) => n.key === lastAdded)?.reply;

  const copyPlan = async () => {
    const text =
      "My next session with Aphrodite ✨\n" +
      chosen.map((n) => `• ${n.label} — powered by ${n.api}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      return;
    } catch {
      // Clipboard API can be unavailable (older browsers, non-focused tab) — fall back.
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const clear = () => {
    setSelected([]);
    setLastAdded(null);
    setCopied(false);
  };

  return (
    <div className="aura-no-print rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <h3 className="font-serif text-xl text-ink">What&apos;s next with Aphrodite</h3>
      <p className="mb-3 mt-1 text-xs text-muted">
        Tap the experiences you want next and I&apos;ll line them up for your next visit — each is a
        real YouCam product I can guide you through.
      </p>
      <div className="flex flex-wrap gap-2">
        {NEXT.map((n) => {
          const on = selected.includes(n.key);
          return (
            <button
              key={n.key}
              onClick={() => toggle(n.key)}
              aria-pressed={on}
              title={n.api}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                on
                  ? "border-primary bg-primary text-white"
                  : "border-line text-ink hover:border-primary hover:text-primary"
              }`}
            >
              <span aria-hidden className={on ? "opacity-100" : "opacity-0"}>
                &#10003;
              </span>
              {n.label}
            </button>
          );
        })}
      </div>

      {reply && (
        <div className="mt-4">
          <CompanionBubble tone="soft">{reply}</CompanionBubble>
        </div>
      )}

      {chosen.length > 0 ? (
        <div className="mt-4 rounded-xl border border-line bg-paper p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink">
              Lined up for next time
              <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-xs text-primary">
                {chosen.length}
              </span>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={copyPlan}
                className="rounded-full border border-primary px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary hover:text-white"
              >
                {copied ? "Copied ✓" : "Copy my plan"}
              </button>
              <button
                onClick={clear}
                className="rounded-full border border-line px-3 py-1 text-xs text-muted transition hover:text-ink"
              >
                Clear
              </button>
            </div>
          </div>
          <ul className="mt-3 space-y-1.5">
            {chosen.map((n) => (
              <li
                key={n.key}
                className="flex items-center justify-between gap-3 border-t border-line pt-1.5 text-sm text-ink first:border-t-0 first:pt-0"
              >
                <span>{n.label}</span>
                <span className="text-xs text-muted">{n.api}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted">
          Nothing lined up yet — tap an experience above to add it to your next session.
        </p>
      )}
    </div>
  );
}
