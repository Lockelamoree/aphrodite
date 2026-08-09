import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  LIVE_COOKIE_NAME,
  gateEnabled,
  issueCookie,
  liveAllowed,
  roleFromCookie,
} from "@/lib/auth/gate";

/**
 * The gate protects money, so its failure modes matter more than its happy path.
 * The case that must hold above all others: with nothing configured, nothing is
 * withheld — that is what keeps local development and this very test suite from
 * needing a special case.
 */
const SAVED: Record<string, string | undefined> = {};
const TOUCHED = ["APHRODITE_LIVE_CODES", "APHRODITE_AUTH_SECRET"];

beforeEach(() => {
  // Mutate individual keys. Assigning a whole object to process.env replaces a
  // special host object, and doing so in afterEach made vitest exit 0 having
  // reported NO results at all — a false pass, which is worse than a failure.
  for (const k of TOUCHED) {
    SAVED[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of TOUCHED) {
    if (SAVED[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED[k];
  }
});

function configure() {
  process.env.APHRODITE_LIVE_CODES = "judge:JUDGE-ABC-123,dev:DEV-XYZ-789";
  process.env.APHRODITE_AUTH_SECRET = "a-test-signing-secret-not-used-anywhere";
}

describe("gate is off until it is configured", () => {
  it("reports disabled with nothing set", () => {
    expect(gateEnabled()).toBe(false);
  });

  it("stays disabled when only one half is set", () => {
    process.env.APHRODITE_LIVE_CODES = "judge:X";
    expect(gateEnabled()).toBe(false);
    delete process.env.APHRODITE_LIVE_CODES;
    process.env.APHRODITE_AUTH_SECRET = "s";
    expect(gateEnabled()).toBe(false);
  });

  it("allows the live path when disabled, cookie or no cookie", () => {
    expect(liveAllowed(undefined)).toBe(true);
    expect(liveAllowed("nonsense")).toBe(true);
  });

  it("issues nothing when disabled", () => {
    expect(issueCookie("anything")).toBeUndefined();
  });
});

describe("gate withholds the live path once configured", () => {
  beforeEach(configure);

  it("reports enabled", () => {
    expect(gateEnabled()).toBe(true);
  });

  it("refuses without a cookie", () => {
    expect(liveAllowed(undefined)).toBe(false);
  });

  it("accepts a cookie issued from a valid code", () => {
    const value = issueCookie("JUDGE-ABC-123")!;
    expect(value).toBeTruthy();
    expect(roleFromCookie(value)).toBe("judge");
    expect(liveAllowed(value)).toBe(true);
  });

  it("tolerates surrounding whitespace in the submitted code", () => {
    expect(issueCookie("  DEV-XYZ-789  ")).toBeTruthy();
  });

  it("rejects a wrong code", () => {
    expect(issueCookie("JUDGE-ABC-124")).toBeUndefined();
  });

  it("rejects a forged signature", () => {
    const value = issueCookie("JUDGE-ABC-123")!;
    const [role, exp] = value.split(".");
    expect(liveAllowed(`${role}.${exp}.forged-signature`)).toBe(false);
  });

  it("rejects a cookie whose role was swapped after signing", () => {
    const value = issueCookie("JUDGE-ABC-123")!;
    const [, exp, sig] = value.split(".");
    expect(liveAllowed(`admin.${exp}.${sig}`)).toBe(false);
  });

  it("rejects an extended expiry", () => {
    const value = issueCookie("JUDGE-ABC-123")!;
    const [role, exp, sig] = value.split(".");
    const later = String(Number(exp) + 86_400);
    expect(liveAllowed(`${role}.${later}.${sig}`)).toBe(false);
  });

  it("rejects an expired cookie", () => {
    const past = Date.now() - 13 * 60 * 60 * 1000;
    const value = issueCookie("JUDGE-ABC-123", past)!;
    expect(liveAllowed(value)).toBe(false);
  });

  it("rejects malformed shapes without throwing", () => {
    for (const bad of ["", "a", "a.b", "a.b.c.d", "....", "judge.notanumber.sig"]) {
      expect(() => liveAllowed(bad)).not.toThrow();
      expect(liveAllowed(bad)).toBe(false);
    }
  });

  it("signs with the configured secret, so rotating it invalidates old cookies", () => {
    const value = issueCookie("JUDGE-ABC-123")!;
    process.env.APHRODITE_AUTH_SECRET = "a-different-secret";
    expect(liveAllowed(value)).toBe(false);
  });

  it("names the cookie something a proxy will not strip by accident", () => {
    expect(LIVE_COOKIE_NAME).toBe("aphrodite_live");
  });
});
