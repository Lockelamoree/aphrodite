import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { budget, claim, read } from "@/lib/live/ledger";

/**
 * The ledger is the second schranke: an access code says who may spend, this says
 * how many times. Its two important properties are that it counts BEFORE the run
 * (so an exhausted budget degrades the run rather than being noticed afterwards)
 * and that a persistence failure refuses rather than granting — otherwise every
 * request would read zero used and the budget would be unbounded.
 */
const SAVED: Record<string, string | undefined> = {};
const TOUCHED = ["APHRODITE_LEDGER_PATH", "APHRODITE_LIVE_RUN_BUDGET"];
let dir: string;

beforeEach(() => {
  for (const k of TOUCHED) {
    SAVED[k] = process.env[k];
    delete process.env[k];
  }
  dir = mkdtempSync(join(tmpdir(), "aphrodite-ledger-"));
  process.env.APHRODITE_LEDGER_PATH = join(dir, "ledger.json");
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  for (const k of TOUCHED) {
    if (SAVED[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED[k];
  }
});

describe("budget", () => {
  it("defaults conservatively when unset", () => {
    expect(budget()).toBe(20);
  });

  it("honours a configured budget", () => {
    process.env.APHRODITE_LIVE_RUN_BUDGET = "3";
    expect(budget()).toBe(3);
  });

  it("ignores nonsense rather than ending up with NaN runs", () => {
    process.env.APHRODITE_LIVE_RUN_BUDGET = "not-a-number";
    expect(budget()).toBe(20);
    process.env.APHRODITE_LIVE_RUN_BUDGET = "-5";
    expect(budget()).toBe(20);
  });

  it("supports a hard zero, for turning live runs off without unsetting keys", () => {
    process.env.APHRODITE_LIVE_RUN_BUDGET = "0";
    expect(budget()).toBe(0);
    expect(claim().granted).toBe(false);
  });
});

describe("counting", () => {
  it("starts at nothing spent when no ledger file exists", () => {
    expect(read()).toEqual({ used: 0, budget: 20, remaining: 20 });
  });

  it("grants up to the budget and then refuses", () => {
    process.env.APHRODITE_LIVE_RUN_BUDGET = "2";
    expect(claim().granted).toBe(true);
    expect(claim().granted).toBe(true);
    const third = claim();
    expect(third.granted).toBe(false);
    expect(third.state.remaining).toBe(0);
  });

  it("persists across reads, so a restart cannot reset the budget", () => {
    process.env.APHRODITE_LIVE_RUN_BUDGET = "5";
    claim();
    claim();
    expect(read().used).toBe(2);
    expect(read().remaining).toBe(3);
  });

  it("treats a corrupt ledger as nothing spent rather than crashing the demo", () => {
    writeFileSync(process.env.APHRODITE_LEDGER_PATH!, "{ not json");
    expect(read().used).toBe(0);
  });

  it("treats a negative or non-numeric count as zero", () => {
    writeFileSync(process.env.APHRODITE_LEDGER_PATH!, JSON.stringify({ used: -4 }));
    expect(read().used).toBe(0);
    writeFileSync(process.env.APHRODITE_LEDGER_PATH!, JSON.stringify({ used: "lots" }));
    expect(read().used).toBe(0);
  });

  it("refuses the run when the count cannot be written", () => {
    // An unwritable path must not mean unlimited live runs: every request would
    // read zero used and spend, which is the opposite of a budget.
    //
    // A real read-only directory, not a path under /proc — pointing the ledger at
    // /proc hung the test runner rather than failing fast.
    const locked = join(dir, "locked");
    mkdirSync(locked);
    chmodSync(locked, 0o500);
    process.env.APHRODITE_LEDGER_PATH = join(locked, "ledger.json");
    try {
      expect(claim().granted).toBe(false);
    } finally {
      chmodSync(locked, 0o700);
    }
  });

  it("creates the state directory if it is missing", () => {
    process.env.APHRODITE_LEDGER_PATH = join(dir, "nested", "deeper", "ledger.json");
    expect(claim().granted).toBe(true);
    expect(existsSync(process.env.APHRODITE_LEDGER_PATH)).toBe(true);
  });
});
