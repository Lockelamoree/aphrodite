import { LIVE_COOKIE_NAME, gateEnabled, liveAllowed, roleFromCookie } from "@/lib/auth/gate";
import { GARMENT_CATALOG } from "@/lib/concierge/catalog";
import { env } from "@/lib/env";
import { readCookie } from "@/lib/http/cookies";
import { createRateLimiter } from "@/lib/http/rate-limit";
import { claim as claimLiveRun, read as readLedger } from "@/lib/live/ledger";
import { analyzeColorProfile } from "@/lib/youcam/color";
import {
  CONTRACT_API_BASE,
  CONTRACT_CAPTURED_AT,
  CONTRACT_GIT_REVISION,
  CONTRACT_SEQUENCE,
  CONTRACT_STEPS,
  contractEndpointsExercised,
} from "@/lib/youcam/contract";
import { analyzeSkin } from "@/lib/youcam/skin";
import { tryOnApparel } from "@/lib/youcam/apparel";
import { withYouCamMode } from "@/lib/youcam/runtime";

/**
 * The judging-time evidence endpoint — two modes, one route.
 *
 * The kill gate names this route as the place where "the live request/response
 * schema is pinned", so it must answer in production. It used to 404 there,
 * because it was born as a live harness and a live harness open on the internet
 * is a money leak: the YouCam free tier is finite and every task call spends it.
 *
 * So the modes are split by what they cost:
 *
 *   GET /api/dev/verify            → the PINNED CONTRACT, replayed from committed
 *                                    receipts. Zero units, safe to refresh.
 *   GET /api/dev/verify?spend=1&image=<https url>
 *                                  → a real call sequence against the live API.
 *                                    Metered by the same ledger as the product,
 *                                    and it says how many runs are left.
 *
 * Both sit behind the role cookie whenever the gate is configured, because the
 * gate is what makes "a judge can reach this" different from "anyone can drain
 * this". With no gate configured (local dev, CI) nothing is withheld.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

// The free mode is cheap but not free to serve; the spend mode costs real units.
// One limiter for both, deliberately tighter than the concierge's.
const isRateLimited = createRateLimiter({ max: 10, windowMs: 60_000 });

export async function GET(req: Request): Promise<Response> {
  if (isRateLimited(req)) {
    return Response.json({ error: "Too many requests — please wait a moment." }, { status: 429 });
  }

  const cookie = readCookie(req, LIVE_COOKIE_NAME);
  if (!liveAllowed(cookie)) {
    return Response.json(
      {
        error: "This endpoint is behind an access code.",
        how: "Redeem the judge code at /unlock, then reload this URL.",
        why: "The live half of it spends YouCam API units, which are finite.",
      },
      { status: 401 },
    );
  }
  const role = gateEnabled() ? roleFromCookie(cookie) : "ungated";

  const url = new URL(req.url);
  const wantsSpend = url.searchParams.get("spend") === "1";

  if (!wantsSpend) {
    const ledger = readLedger();
    return Response.json({
      mode: "contract",
      units_spent_by_this_request: 0,
      what_this_is:
        "The Perfect Corp REST contract as the live API actually answered it, transcribed from receipts committed in this repo. Nothing was called to build this response.",
      how_to_spend_units_instead:
        "Append &spend=1&image=<https url of a photo> to make real calls. That path is metered by the live-run ledger below.",
      captured_at: CONTRACT_CAPTURED_AT,
      captured_against_revision: CONTRACT_GIT_REVISION,
      api_base: CONTRACT_API_BASE,
      four_step_sequence: CONTRACT_SEQUENCE,
      endpoints_exercised: contractEndpointsExercised(),
      steps: CONTRACT_STEPS,
      caveat:
        "The fused chain has never completed in one live run: the bundled wedding selfie is rejected by both analysis APIs. The failing step is included above rather than dropped.",
      live_runs: ledger,
      role,
    });
  }

  // --- the metered path ---
  const image = url.searchParams.get("image");
  if (!image) {
    return Response.json(
      {
        error: "spend=1 needs ?image=<https url of a photo to analyse>",
        garments: GARMENT_CATALOG.map((g) => g.id),
      },
      { status: 400 },
    );
  }

  let key: string;
  try {
    key = env.youcamApiKey;
  } catch {
    return Response.json(
      { error: "No YOUCAM_API_KEY configured on this host, so nothing can be called live." },
      { status: 503 },
    );
  }
  if (!key) {
    return Response.json({ error: "No YOUCAM_API_KEY configured on this host." }, { status: 503 });
  }

  // Claim BEFORE calling, so an exhausted budget refuses the run instead of being
  // noticed once the units are gone.
  const { granted, state } = claimLiveRun();
  if (!granted) {
    return Response.json(
      {
        error: `The live-run budget of ${state.budget} is used up.`,
        live_runs: state,
        alternative: "Drop &spend=1 for the pinned contract, which costs nothing.",
      },
      { status: 409 },
    );
  }

  const steps = (url.searchParams.get("steps") ?? "skin").split(",").map((s) => s.trim());
  const garmentId = url.searchParams.get("garment") ?? GARMENT_CATALOG[0].id;
  const out: Record<string, unknown> = {};

  // Force live for the length of this handler regardless of the host default:
  // spend=1 is an explicit, metered, gated request for real calls. The reason
  // travels with the decision so nothing downstream has to guess.
  return withYouCamMode(
    { live: true, reason: `explicit spend=1 on /api/dev/verify (run ${state.used} of ${state.budget})` },
    async () => {
      try {
        if (steps.includes("skin")) {
          out.skin = await analyzeSkin({ kind: "url", url: image });
        }
        if (steps.includes("color")) {
          out.color = await analyzeColorProfile({ kind: "url", url: image });
        }
        if (steps.includes("apparel")) {
          const g = GARMENT_CATALOG.find((x) => x.id === garmentId) ?? GARMENT_CATALOG[0];
          out.apparel = await tryOnApparel({
            person: { kind: "url", url: image },
            garment: { kind: "url", url: g.imageUrl },
            category: g.category,
          });
        }
        return Response.json({ mode: "live", ok: true, live_runs: state, role, ...out });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return Response.json(
          { mode: "live", ok: false, error: message, live_runs: state, partial: out },
          { status: 500 },
        );
      }
    },
  );
}
