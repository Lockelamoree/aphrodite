import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import { env } from "@/lib/env";

/**
 * Per-request decision on whether YouCam runs for real.
 *
 * `YOUCAM_FIXTURES` is a module-level constant, so before this existed the whole
 * process was either live or replaying — there was no way to serve the public
 * from captured fixtures at zero cost while letting a judge with an access code
 * spend real units. Seven feature modules read the flag, so rather than thread a
 * parameter through all of them, the decision travels in an async context that
 * `fixturesActive()` reads.
 *
 * The default, when no context is set, is exactly the old behaviour: whatever
 * `YOUCAM_FIXTURES` says. That keeps every existing caller and the whole test
 * suite working unchanged.
 */

type LiveContext = {
  /** true = make real YouCam calls; false = serve captured fixtures. */
  live: boolean;
  /** Why, so a route can narrate it honestly instead of switching silently. */
  reason: string;
};

const store = new AsyncLocalStorage<LiveContext>();

/** Run `fn` with an explicit live/replay decision for everything it calls. */
export function withYouCamMode<T>(ctx: LiveContext, fn: () => T): T {
  return store.run(ctx, fn);
}

/**
 * Should this call be served from a captured fixture?
 *
 * Note the asymmetry, which is deliberate: an explicit context can force
 * fixtures ON even when the operator set `YOUCAM_FIXTURES=0`. A public visitor
 * must never be able to spend units, whatever the host default happens to be, so
 * the safe direction is always available to the gate.
 */
export function fixturesActive(): boolean {
  const ctx = store.getStore();
  if (ctx) return !ctx.live;
  return env.youcamFixtures;
}

/** The current decision plus its reason, for narration and /healthz. */
export function youcamModeReason(): string {
  const ctx = store.getStore();
  if (ctx) return ctx.reason;
  return env.youcamFixtures
    ? "YOUCAM_FIXTURES=1 — captured sample renders, zero API units spent"
    : "live YouCam calls";
}
