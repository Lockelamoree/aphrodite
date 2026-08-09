import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Access gate for the expensive paths.
 *
 * The product itself stays open: anyone can land, run the full flow and see a
 * look board, because a judge who has to type a code before seeing anything is a
 * judge who closes the tab. What the code unlocks is only the part that costs
 * money — real YouCam calls and the LLM-driven engine.
 *
 * The gate is OFF whenever `APHRODITE_LIVE_CODES` or `APHRODITE_AUTH_SECRET` is
 * unset. That is what keeps local development and the test suite ungated without
 * a single special case in the code: no codes configured means nothing to unlock,
 * and the host default (`YOUCAM_FIXTURES`) decides on its own.
 */

const COOKIE = "aphrodite_live";
const TTL_SECONDS = 12 * 60 * 60;

export type LiveRole = string;

function codes(): Map<string, LiveRole> {
  const raw = process.env.APHRODITE_LIVE_CODES?.trim();
  const map = new Map<string, LiveRole>();
  if (!raw) return map;
  for (const pair of raw.split(",")) {
    const [role, code] = pair.split(":").map((s) => s?.trim());
    if (role && code) map.set(code, role);
  }
  return map;
}

function secret(): string | undefined {
  return process.env.APHRODITE_AUTH_SECRET?.trim() || undefined;
}

/** Is the gate configured at all? Reported by /healthz so it is externally checkable. */
export function gateEnabled(): boolean {
  return codes().size > 0 && Boolean(secret());
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/** Constant-time compare that cannot throw on a length mismatch. */
function sameSignature(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Exchange an access code for a signed cookie value, or undefined if it is wrong. */
export function issueCookie(code: string, now = Date.now()): string | undefined {
  const key = secret();
  if (!key) return undefined;
  const role = codes().get(code.trim());
  if (!role) return undefined;
  const exp = Math.floor(now / 1000) + TTL_SECONDS;
  const payload = `${role}.${exp}`;
  return `${payload}.${sign(payload, key)}`;
}

/**
 * The role this request may act as, or undefined.
 *
 * Returns a role when the gate is DISABLED too — with nothing configured there is
 * nothing to withhold, and pretending otherwise would break local development.
 * Callers therefore ask `liveAllowed()` rather than reading this directly.
 */
export function roleFromCookie(value: string | undefined, now = Date.now()): LiveRole | undefined {
  const key = secret();
  if (!key || !value) return undefined;
  const parts = value.split(".");
  if (parts.length !== 3) return undefined;
  const [role, expRaw, sig] = parts;
  const payload = `${role}.${expRaw}`;
  if (!sameSignature(sig, sign(payload, key))) return undefined;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 < now) return undefined;
  return role;
}

/**
 * May this request use the expensive paths?
 *
 * - gate not configured → yes (local dev, CI, and a host that deliberately runs open)
 * - gate configured → only with a valid, unexpired cookie
 */
export function liveAllowed(cookieValue: string | undefined, now = Date.now()): boolean {
  if (!gateEnabled()) return true;
  return Boolean(roleFromCookie(cookieValue, now));
}

export const LIVE_COOKIE_NAME = COOKIE;
export const LIVE_COOKIE_TTL_SECONDS = TTL_SECONDS;
