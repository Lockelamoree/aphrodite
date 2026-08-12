import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/dev/verify/route";
import { LIVE_COOKIE_NAME, issueCookie } from "@/lib/auth/gate";
import { CONTRACT_STEPS } from "@/lib/youcam/contract";

/**
 * `/api/dev/verify` is the endpoint the kill gate cites as its judging-time
 * evidence, and its free mode exists so a judge can refresh it without spending
 * units. Both halves of that sentence are asserted here: the gate withholds it,
 * and the free mode reaches no network at all.
 *
 * `global.fetch` is replaced with a throwing spy for every test. Any request that
 * quietly starts calling YouCam therefore fails the suite rather than the bill.
 */
const SAVED: Record<string, string | undefined> = {};
const TOUCHED = [
  "APHRODITE_LIVE_CODES",
  "APHRODITE_AUTH_SECRET",
  "APHRODITE_LIVE_RUN_BUDGET",
  "APHRODITE_LEDGER_PATH",
  "YOUCAM_API_KEY",
];

let fetchSpy: ReturnType<typeof vi.fn>;
const realFetch = global.fetch;

beforeEach(() => {
  for (const k of TOUCHED) {
    SAVED[k] = process.env[k];
    delete process.env[k];
  }
  fetchSpy = vi.fn(() => {
    throw new Error("no network call may happen in this test");
  });
  global.fetch = fetchSpy as unknown as typeof fetch;
});
afterEach(() => {
  for (const k of TOUCHED) {
    if (SAVED[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED[k];
  }
  global.fetch = realFetch;
});

function configureGate() {
  process.env.APHRODITE_LIVE_CODES = "judge:JUDGE-TEST-1,dev:DEV-TEST-1";
  process.env.APHRODITE_AUTH_SECRET = "a-test-signing-secret-not-used-anywhere";
}

/** A distinct IP per request, so the route's own rate limiter never confounds a test. */
let seq = 0;
function request(query = "", cookie?: string): Request {
  seq += 1;
  const headers = new Headers({ "x-forwarded-for": `10.0.0.${seq}` });
  if (cookie) headers.set("cookie", `${LIVE_COOKIE_NAME}=${cookie}`);
  return new Request(`https://aphrodite.test/api/dev/verify${query}`, { headers });
}

describe("/api/dev/verify — the access gate", () => {
  it("withholds the endpoint when the gate is configured and no code was redeemed", async () => {
    configureGate();
    const res = await GET(request());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.how).toContain("/unlock");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("answers for a redeemed judge code", async () => {
    configureGate();
    const cookie = issueCookie("JUDGE-TEST-1");
    expect(cookie).toBeTruthy();
    const res = await GET(request("", cookie));
    expect(res.status).toBe(200);
    expect((await res.json()).role).toBe("judge");
  });

  it("withholds nothing when no gate is configured — local dev and CI", async () => {
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect((await res.json()).mode).toBe("contract");
  });
});

describe("/api/dev/verify — the free contract mode", () => {
  it("serves the pinned contract without touching the network", async () => {
    const res = await GET(request());
    const body = await res.json();
    expect(body.mode).toBe("contract");
    expect(body.units_spent_by_this_request).toBe(0);
    expect(body.steps.length).toBe(CONTRACT_STEPS.length);
    expect(body.four_step_sequence.length).toBe(4);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps the failing step in the response rather than showing only the wins", async () => {
    const body = await (await GET(request())).json();
    const failures = body.steps.filter((s: { outcome: string }) => s.outcome === "provider_error");
    expect(failures.length).toBeGreaterThan(0);
    expect(body.caveat).toMatch(/never completed in one live run/i);
  });
});

describe("/api/dev/verify — the metered live mode", () => {
  it("refuses spend=1 without an image, before claiming a run", async () => {
    const res = await GET(request("?spend=1"));
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses to call when the run budget is exhausted", async () => {
    process.env.YOUCAM_API_KEY = "test-key-not-real";
    process.env.APHRODITE_LIVE_RUN_BUDGET = "0";
    const res = await GET(request("?spend=1&image=https://example.test/a.jpg"));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.live_runs.remaining).toBe(0);
    expect(body.alternative).toMatch(/costs nothing/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses to call when the host has no YouCam key", async () => {
    process.env.APHRODITE_LIVE_RUN_BUDGET = "5";
    const res = await GET(request("?spend=1&image=https://example.test/a.jpg"));
    expect(res.status).toBe(503);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("the pinned contract matches the committed receipts", () => {
  type Step = {
    feature: string;
    taskId: string;
    taskEndpoint: string;
    fileEndpoint: string;
    durationMs: number;
    render?: { sha256: string; bytes: number };
  };
  const receipts = ["hackathon/receipts/000-misaimed-attempt/receipt.json", "hackathon/receipts/001/receipt.json"];
  const byId = new Map<string, Step>();
  for (const path of receipts) {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { steps: Step[] };
    for (const step of parsed.steps) byId.set(step.taskId, step);
  }

  /**
   * The contract module is a hand transcription of the receipts, and a hand
   * transcription drifts. This test is the anchor: if a value in contract.ts stops
   * matching the receipt it claims to come from, the endpoint that exists to prove
   * honesty is the thing lying.
   */
  it.each(CONTRACT_STEPS.map((s) => [s.feature, s] as const))("%s matches its receipt", (_name, step) => {
    const receipt = byId.get(step.taskId);
    expect(receipt, `no receipt step carries task id ${step.taskId}`).toBeDefined();
    expect(receipt!.feature).toBe(step.feature);
    expect(receipt!.taskEndpoint).toBe(step.taskEndpoint);
    expect(receipt!.fileEndpoint).toBe(step.fileEndpoint);
    expect(receipt!.durationMs).toBe(step.durationMs);
    if (step.render) {
      expect(receipt!.render?.sha256).toBe(step.render.sha256);
      expect(receipt!.render?.bytes).toBe(step.render.bytes);
    }
  });

  it("names a receipt path that exists for every step", () => {
    for (const step of CONTRACT_STEPS) {
      expect(() => readFileSync(step.receipt, "utf8")).not.toThrow();
    }
  });
});
