import { NextResponse } from "next/server";

import { GARMENT_CATALOG, SKINCARE_SKUS } from "@/lib/concierge/catalog";
import { CUSTOM_TOOL_DEFS } from "@/lib/concierge/tools";
import { env } from "@/lib/env";
import { youcamConfig } from "@/lib/youcam/config";
import { gateEnabled } from "@/lib/auth/gate";
import { read as readLedger } from "@/lib/live/ledger";

/**
 * State-reporting health endpoint.
 *
 * `{"status":"ok"}` only proves a process answers TCP. The question a judge, a
 * deploy gate or an uptime probe actually needs answered is different: is the
 * thing the submission claims actually working right now? A demo can be "up"
 * with its paid model path silently dead and every screen still looking green.
 *
 * So this reports STATE, keylessly:
 *   - the deployed revision, so a stale process can't pass a deploy gate
 *   - the headline counts, read from the loaded data rather than from prose, so
 *     README / submission copy / running system can be checked against each other
 *   - a THREE-state answer per model-backed feature, because a boolean hides the
 *     dangerous middle case: a key is configured and nothing paid is happening.
 */

export const dynamic = "force-dynamic";

type FeatureState = "live" | "off" | "key_present_unverified";

/** One-shot probe result, cached for the process lifetime (see probeOpenai). */
let openaiProbe: { state: FeatureState; detail?: string } | undefined;

/**
 * Verify the LLM key with one real, free call: GET /v1/models. This is the state
 * `key_present_unverified` exists to catch — a key that is present but rejected,
 * exhausted, or pointed at a model this account cannot see.
 *
 * Deliberately NOT a completion: a probe must never cost money per health check.
 */
async function probeOpenai(): Promise<{ state: FeatureState; detail?: string }> {
  if (openaiProbe) return openaiProbe;

  const key = process.env.OPENAI_API_KEY?.trim();
  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key && !anthropic) {
    openaiProbe = { state: "off", detail: "no LLM key configured; the rule-based engine serves every request" };
    return openaiProbe;
  }
  // The Anthropic path has no equally free probe endpoint, so it stays honest
  // rather than claiming more than was checked.
  if (!key) {
    openaiProbe = { state: "key_present_unverified", detail: "Anthropic key present; not probed" };
    return openaiProbe;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${env.openaiBaseUrl}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) {
      openaiProbe = {
        state: "key_present_unverified",
        // The provider's own words, so triage is one journalctl grep rather than a guess.
        detail: `provider returned ${res.status}`,
      };
      return openaiProbe;
    }
    const body = (await res.json()) as { data?: { id?: string }[] };
    const ids = (body.data ?? []).map((m) => m.id).filter(Boolean) as string[];
    const wanted = env.openaiModel;
    if (!ids.includes(wanted)) {
      // A hardcoded model id that this account cannot see is the classic
      // "configured but dead" failure. Fail the gate rather than the demo.
      openaiProbe = {
        state: "key_present_unverified",
        detail: `key valid but model "${wanted}" is not available to this account (${ids.length} models visible)`,
      };
      return openaiProbe;
    }
    openaiProbe = { state: "live", detail: `${wanted} available` };
    return openaiProbe;
  } catch (err) {
    openaiProbe = {
      state: "key_present_unverified",
      detail: err instanceof Error ? err.message.slice(0, 120) : "probe failed",
    };
    return openaiProbe;
  }
}

/**
 * YouCam state. Note what is NOT done here: no task call. Every YouCam AI task
 * costs units from a finite free tier, so a health check must never spend one —
 * a probe that drains the demo's budget is worse than no probe. When fixtures are
 * off and a key is present, the honest answer is `key_present_unverified`.
 */
function youcamState(): { state: FeatureState | "fixtures"; detail: string } {
  const key = process.env.YOUCAM_API_KEY?.trim();
  if (env.youcamFixtures) {
    return {
      state: "fixtures",
      detail: "YOUCAM_FIXTURES=1 — captured sample renders, zero API units spent",
    };
  }
  if (!key) return { state: "off", detail: "no YouCam key configured" };
  return {
    state: "key_present_unverified",
    detail: "key present; not probed because every YouCam task call costs units",
  };
}

export async function GET() {
  const llm = await probeOpenai();
  const ledger = readLedger();
  const youcam = youcamState();

  // The gate treats a silently-degraded flagship as a failure, so surface one
  // boolean it can grep instead of making it parse the tri-states.
  const degraded = llm.state === "key_present_unverified" || youcam.state === "key_present_unverified";

  return NextResponse.json(
    {
      status: "ok",
      // Injected at deploy time from the release SHA. Absent in local dev, which
      // is itself informative: an unversioned process is not a release.
      revision: process.env.APHRODITE_REVISION ?? "dev",
      // The HOST default. Note this is NOT what an anonymous visitor gets when the
      // gate is on: they are forced onto captured fixtures regardless, which is
      // what public_demo_mode reports. Conflating the two once made the landing
      // page claim live renders while serving samples.
      demo_mode: env.youcamFixtures,
      public_demo_mode: env.youcamFixtures || gateEnabled(),
      // Whether the live paths are gated, so "the demo is open" or "the expensive
      // paths are behind a code" is externally verifiable rather than a README claim.
      auth_enabled: gateEnabled(),
      // The budget is reported because a metered demo that does not say what is
      // left is indistinguishable from one that quietly stopped being live.
      live_runs_used: ledger.used,
      live_runs_budget: ledger.budget,
      live_runs_remaining: ledger.remaining,

      // Headline counts, from the loaded data. README, submission copy and this
      // endpoint must agree, and this is the one a judge can query.
      garments: GARMENT_CATALOG.length,
      skincare_skus: Object.keys(SKINCARE_SKUS).length,
      youcam_apis_wired: Object.keys(youcamConfig.fileEndpoints).length,
      agent_tools: CUSTOM_TOOL_DEFS.length,

      // The tri-states.
      agentic_engine: llm.state,
      agentic_engine_reason: llm.detail,
      agentic_model: env.openaiModel,
      youcam: youcam.state,
      youcam_reason: youcam.detail,

      degraded,
    },
    {
      headers: {
        // A cached health check answers about the past, which defeats the point.
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
