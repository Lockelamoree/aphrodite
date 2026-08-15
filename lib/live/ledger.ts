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

/** Set when the ledger file exists but cannot be read — reported, never swallowed. */
let unreadable = false;

/** Has the ledger become unreadable? `/healthz` surfaces this so it is externally visible. */
export function ledgerUnreadable(): boolean {
  return unreadable;
}

function readUsed(): number {
  try {
    const parsed = JSON.parse(readFileSync(path(), "utf8")) as { used?: unknown };
    const n = Number(parsed.used);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch (err) {
    // Missing ledger means nothing has been spent yet — that is the first-run case
    // and it is genuinely 0.
    //
    // But an UNREADABLE ledger is a different thing, and treating both as 0 was a
    // silent hole: if the state file ever became unwritable, every request would
    // read 0 used, the 8-run cap would never engage, and /healthz would keep
    // reporting 0/8 — the very reading used to prove nothing was spent. Review 003
    // named it. The distinction is cheap to make, so make it.
    const code = (err as { code?: string } | null)?.code;
    if (code === "ENOENT") return 0;
    unreadable = true;
    return Number.POSITIVE_INFINITY;
  }
}

export function read(): LedgerState {
  const b = budget();
  const used = readUsed();
  // An unreadable ledger reports the budget as fully consumed, so the live path
  // degrades to captured fixtures and says so on screen, rather than spending
  // without a counter.
  if (!Number.isFinite(used)) return { used: b, budget: b, remaining: 0 };
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
