import { afterEach, describe, expect, it, vi } from "vitest";

import { createRateLimiter } from "@/lib/http/rate-limit";

function reqFrom(xff?: string): Request {
  const headers = new Headers();
  if (xff) headers.set("x-forwarded-for", xff);
  return new Request("http://localhost/api/x", { method: "POST", headers });
}

describe("createRateLimiter", () => {
  afterEach(() => vi.useRealTimers());

  it("allows up to `max` requests per IP, then blocks further ones", () => {
    const limited = createRateLimiter({ max: 3, windowMs: 60_000 });
    const req = reqFrom("1.2.3.4");
    expect(limited(req)).toBe(false); // 1
    expect(limited(req)).toBe(false); // 2
    expect(limited(req)).toBe(false); // 3
    expect(limited(req)).toBe(true); // 4 — over budget
    expect(limited(req)).toBe(true); // stays blocked within the window
  });

  it("keeps per-IP budgets independent", () => {
    const limited = createRateLimiter({ max: 1, windowMs: 60_000 });
    expect(limited(reqFrom("10.0.0.1"))).toBe(false);
    expect(limited(reqFrom("10.0.0.1"))).toBe(true); // same IP over budget
    expect(limited(reqFrom("10.0.0.2"))).toBe(false); // a different IP is fresh
  });

  it("keys on the first x-forwarded-for hop and falls back to a shared local bucket", () => {
    const limited = createRateLimiter({ max: 1, windowMs: 60_000 });
    // "client, proxy" → keyed on the client hop, so the proxy suffix doesn't matter
    expect(limited(reqFrom("9.9.9.9, 10.0.0.1"))).toBe(false);
    expect(limited(reqFrom("9.9.9.9, 10.0.0.9"))).toBe(true);
    // no header → everyone shares the "local" bucket
    expect(limited(reqFrom())).toBe(false);
    expect(limited(reqFrom())).toBe(true);
  });

  it("resets the budget once the window elapses", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const limited = createRateLimiter({ max: 1, windowMs: 1_000 });
    const req = reqFrom("5.5.5.5");
    expect(limited(req)).toBe(false);
    expect(limited(req)).toBe(true);
    vi.advanceTimersByTime(1_001);
    expect(limited(req)).toBe(false); // window rolled over → fresh budget
  });
});
