"use client";

import type { ColorProfile } from "@/lib/youcam/types";

/** Renders the derived undertone/season, YouCam's detected colors, and the
 * recommended apparel palette. */
export function Palette({ profile }: { profile: ColorProfile }) {
  const detected: { label: string; hex?: string }[] = [
    { label: "Skin", hex: profile.detected?.skin },
    { label: profile.detected?.eyeName ? `Eyes · ${profile.detected.eyeName}` : "Eyes", hex: profile.detected?.eye },
    { label: "Lips", hex: profile.detected?.lip },
  ].filter((d) => d.hex);

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-serif text-xl text-ink">Your colors</h3>
        {profile.season && (
          <span className="text-sm font-medium text-primary">{profile.season}</span>
        )}
        {profile.undertone && (
          <span className="text-sm text-muted">
            · {profile.depth ? `${profile.depth}, ` : ""}
            {profile.undertone} undertone
          </span>
        )}
      </div>
      <p className="mb-3 text-xs text-muted">Detected by YouCam Color Analysis</p>

      {detected.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-3">
          {detected.map((d) => (
            <div key={d.label} className="flex items-center gap-2">
              <span
                className="h-6 w-6 rounded-full border border-line shadow-sm"
                style={{ backgroundColor: d.hex }}
                title={d.hex}
              />
              <span className="text-xs text-muted">{d.label}</span>
            </div>
          ))}
        </div>
      )}

      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
        Recommended palette
      </p>
      <div className="flex flex-wrap gap-2">
        {profile.paletteHex.map((hex) => (
          <div key={hex} className="flex flex-col items-center gap-1">
            <span
              className="h-11 w-11 rounded-full border border-line shadow-sm"
              style={{ backgroundColor: hex }}
              title={hex}
            />
            <span className="text-[11px] uppercase tracking-wide text-muted">{hex}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
