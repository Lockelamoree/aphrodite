import "server-only";

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Hard ceiling on live runs.
 *
 * An access code answers *who* may spend units. It does not answer *how many*,
 * and that is the question that matters here: the YouCam free tier is finite, one
 * full run costs four to five API tasks, and a single judge refreshing a page can
 * empty what is left. So the gate is two schranken, not one — a code, and a budget.
 *
 * When the budget is gone the app does NOT error. It falls back to captured
 * fixtures and says so on screen, because a silent switch would present a fixture
 * render as a live one, which is the integrity risk this project names first.
 *
 * The count is deliberately crude — runs, not units. Units per run vary with which
 * renders a given look needs, and an over-precise counter fed by guesses would be
 * worse than an honest coarse one.
 */

const DEFAULT_BUDGET = 20;

export type LedgerState = {
  used: number;
  budget: number;
  remaining: number;
};

function path(): string {
  return process.env.APHRODITE_LEDGER_PATH?.trim() || "/var/lib/aphrodite/ledger.json";
}

export function budget(): number {
  const raw = Number(process.env.APHRODITE_LIVE_RUN_BUDGET);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_BUDGET;
}

function readUsed(): number {
  try {
    const parsed = JSON.parse(readFileSync(path(), "utf8")) as { used?: unknown };
    const n = Number(parsed.used);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    // Missing or unreadable ledger means nothing has been spent yet. Deliberately
    // NOT fail-closed: a permissions mistake on the state file must not silently
    // turn the live demo off during judging, and the provider-side spend cap is
    // the real backstop for money.
    return 0;
  }
}

export function read(): LedgerState {
  const b = budget();
  const used = readUsed();
  return { used, budget: b, remaining: Math.max(0, b - used) };
}

/**
 * Claim one live run. Returns the state AFTER the attempt, and whether the claim
 * succeeded. Call this BEFORE running live, so an exhausted budget degrades the
 * run rather than being noticed after the units are gone.
 */
export function claim(): { granted: boolean; state: LedgerState } {
  const before = read();
  if (before.remaining <= 0) return { granted: false, state: before };
  const used = before.used + 1;
  try {
    mkdirSync(dirname(path()), { recursive: true });
    writeFileSync(path(), JSON.stringify({ used, updated: new Date().toISOString() }) + "\n");
  } catch {
    // If the count cannot be persisted, refuse the live run. Granting it would
    // make the budget unbounded — every request would read 0 used and spend.
    return { granted: false, state: before };
  }
  const b = before.budget;
  return { granted: true, state: { used, budget: b, remaining: Math.max(0, b - used) } };
}
