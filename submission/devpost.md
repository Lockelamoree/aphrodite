# Aphrodite — Devpost submission (DRAFT)

> Draft for review. Measured claims only — every line below is backed by something
> a judge can see in the repo or the demo. Nothing here asserts live-render quality
> we haven't verified, or retail metrics without a source. Each number resolves to a
> row in `hackathon/CLAIM_PROOF_MAP.md`; anything unmeasured says so out loud.

---

## Try it first — hosted, keyless, zero API units

**→ https://aphrodite.max-gutowski.de**

| | |
|---|---|
| **4** YouCam APIs chained in one run | Skin Analysis → Skin-Tone → Apparel Try-On → Photo Lighting |
| **~4.5 s** for the whole loop | measured on the hosted instance |
| **0** API units to look | every public path is fixture-served, and the page says so on screen |
| **89** tests in 10 files | `tsc` / `lint` / `build` green too, measured 2026-08-10 |
| **8** APIs declared, **4** that render | the honest surface — see "YouCam APIs used" below |
| **88 s** demo video | inside the 1–3 minute window, cut from a production build |

No signup, no key, nothing to install. The bundled *"Wedding · full-body"* sample drives
the complete loop. What you see is **captured YouCam renders**, and the announcement bar
and the provenance ledger both say so — nothing here passes a sample off as a live call.
State is checkable from outside at
[`/healthz`](https://aphrodite.max-gutowski.de/healthz).

**Live renders and the LLM engine are behind a code**, because both spend money. The
judging code is in the *Testing instructions* field of this submission; redeem it at
`/unlock`. Not published in the repo — a code in a public repo is no gate.

> **What is proven, and what is not — stated plainly.** On 2026-08-10 one approved
> units-on session put real traffic through the API and the receipts are committed at
> `hackathon/receipts/`, failures included: **Apparel Try-On** and **Photo Lighting**
> each returned a real render with a genuine Perfect Corp `task_id` (hash-verified, one
> image committed byte-for-byte), and **Skin-Tone** returned real detections. The
> four-step client contract is confirmed against the live API.
>
> Not proven: **no single live run has traversed all four steps**, because the live
> analysis endpoints reject the bundled sample photos (`error_src_face_too_small`,
> `error_face_angle_downward`). And on the publicly reachable route nothing calls YouCam
> at all — every visitor gets captured renders, and the page says so. Judge it as what
> it is.

---

## Tagline (≤ 200 chars)

Tell it the occasion, share one selfie — Aphrodite reads your skin and coloring with YouCam AI, times a prep countdown to the day, renders the outfit on you, and hands you one shoppable look board.

## Inspiration

Most virtual try-on demos stop at "here's a garment on you." Before a wedding or an interview I actually want three things answered in one place: *what do I do with my skin between now and the day, what should I wear for my coloring, and where do I buy all of it.* Aphrodite answers all three from a single photo — fusing YouCam's Skin AI and Apparel VTO into one occasion concierge rather than two separate toys.

## What it does

- **Reads you with YouCam AI.** Skin Analysis (0–100 health scores — it focuses the lowest ones), Facial Color / Skin-Tone (it derives your undertone and a palette from the detected colors), Apparel Try-On (the outfit rendered onto your photo), and AI Photo Lighting (a camera-ready finish).
- **Plans the occasion.** A skincare countdown that changes in *kind* with how far off the event is — weeks out it front-loads active ingredients and tapers; a day out it stops new actives and switches to hydration and de-puffing so nothing flares on the day.
- **Dresses you for your coloring.** Your detected undertone drives the outfit pick (a cool read leans to cool-flattering pieces), with explicit guards + tests so the styling is never mis-gendered — and the garment is rendered on you, not just described.
- **Completes the look.** One cross-category, priced basket — skincare + garment + matched accessories — with an on-screen **provenance ledger** naming which YouCam API produced each result.
- **Keeps going.** Save an **image-free** plan (no photo, mask, or raw API response stored) and return for a glow check-in that diffs your scores against the saved run. A studio for hair color, hairstyle and makeup is wired but **not shipped** — see "YouCam APIs used".

## How I built it

- **Next.js 16 / React 19 / TypeScript / Tailwind v4**, streamed over Server-Sent Events. The whole concierge is one streamed route plus one client component.
- **Two engines, one event stream.** An **agentic** engine (Claude *or* GPT) orchestrates the YouCam REST APIs via typed function-calling tools, reasoning over your scores; and a **guided** rule engine produces the *same* board with no LLM at all. They emit an identical event stream, so the UI doesn't care which drove the run. The app works on a YouCam key alone; the LLM is a pure upgrade.
- **YouCam / Perfect Corp AI API** drives every render over REST: Skin Analysis, Skin-Tone / Facial Color, Apparel Try-On and AI Photo Lighting. Three further endpoints are wired but render nothing, and are not counted — see "YouCam APIs used".
- **Cost-safe demo mode.** A fixture/replay layer serves real captured YouCam outputs so the entire app — plan, try-on, refine, save, check-in — runs with **zero API units and no keys**, and the UI labels itself *"demo mode · sample renders"* so nothing over-claims.
- **Hardened boundary.** zod request validation, per-IP rate limiting, a payload-size cap, and raw provider fields stripped out of the stream. 89 Vitest tests in 10 files (occasion parsing, garment selection incl. mis-gender guards, the cut preference, the access gate, the provenance ledger, request validation, raw-field stripping, rate limiting); `tsc` / `lint` / `build` green — all four measured 2026-08-10.

## YouCam APIs used

**Four render in every run:** Skin Analysis · Skin-Tone / Facial Color Analysis · Apparel (Cloth) Try-On · AI Photo Lighting.

**Wired but not shipped, so not claimed:** AI Hair Color (slug verified, no captured
fixture), AI Makeup and AI Hairstyle (slugs never verified — the key 401s on those
features). The studio tiles that would call them return an honest empty state instead of
an image, and this submission does not count them. Declared endpoints: 8. With a calling
module: 7. Slug-verified: 5. Rendering: **4**.

The **special-category** goal — Skin AI **and** Apparel VTO fused into one experience — is the core loop: the same skin read that drives the skincare countdown also feeds the coloring that drives the outfit that gets rendered on you.

## Challenges

- **Coherence across horizons.** Making the countdown differ in *kind* (weeks vs. a day out) instead of just restating scores took real rule design, and keeping every "→ product" chip resolvable to a priced basket row.
- **Not mis-gendering the styling.** Undertone-driven selection kept defaulting to one wardrobe; fixing it meant reworking the scoring and expanding the catalog, locked down with regression tests.
- **Honesty under demo constraints.** Because the demo runs on captured fixtures, I had to be careful that copy never promises a live render it can't show — the before/after only ever shows real YouCam output of the same photo it sits beside — an overlay taken from a different face was found and deleted on 2026-08-10 — and studio try-ons that aren't captured degrade to an honest message rather than a fabricated image.

## Accomplishments I'm proud of

A complete, coherent product — not a PoC — that a beauty/fashion retailer could drop into its own funnel, with a genuinely honest demo and a swappable catalog + theme. And the two-engine design: the same experience with or without an LLM.

## What I learned

How much of a "wow" try-on demo is actually *product coherence* — timing, provenance, honesty — rather than any single render. And that adversarial self-review (scoring against the real criteria each cycle) catches over-claims faster than building more features.

## What's next

- Capture the studio try-on fixtures + a cool-tone full-body render so the fully-fused chain renders on screen in the zero-cost demo.
- Point the catalog at a real retailer's live products so the shoppable basket becomes a live storefront.
- Widen the menswear catalogue past its single garment, and commit a live-run receipt with a real Perfect Corp `task_id` so the integration is provable without an access code.

## How to test it (zero API units)

**The fastest path is the hosted instance — https://aphrodite.max-gutowski.de — no
install, no key, zero units.** Pick the *"Wedding · full-body"* sample. For live renders
and the agentic engine, redeem the code from the *Testing instructions* field at
[`/unlock`](https://aphrodite.max-gutowski.de/unlock).

Or run it locally:

```bash
git clone https://github.com/Lockelamoree/aphrodite && cd aphrodite
npm install
cp .env.example .env.local     # demo mode (YOUCAM_FIXTURES=1) is already set
npm run dev                    # http://localhost:3000 → "Wedding · full-body" sample
```

No keys needed; the whole flow runs on captured renders, labelled *"demo mode."* Add a `YOUCAM_API_KEY` (+ set `YOUCAM_FIXTURES=0`) for live renders, and an `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` to switch on the agentic engine.

## Testing instructions (Devpost field — paste as-is, then fill the code)

```
Hosted, keyless, zero API units: https://aphrodite.max-gutowski.de
Pick the bundled "Wedding · full-body" sample — the full loop takes about 4.5 s.
What you see are captured YouCam renders; the page says so in the announcement bar
and in the provenance ledger at the bottom of the board.

To judge the paths that spend money (live YouCam renders + the GPT-5 agentic engine):
  1. open https://aphrodite.max-gutowski.de/unlock
  2. enter the judging code:  <PASTE THE JUDGE CODE HERE — NOT IN THE PUBLIC REPO>
  3. that sets a 12-hour cookie; live runs are metered by a ledger and the remaining
     budget is visible at /healthz

State is checkable from outside without a key:
  https://aphrodite.max-gutowski.de/healthz
It reports the deployed revision, whether demo mode is on, the catalogue counts, the
live-run budget, and a three-state answer per model-backed feature (live / off /
key_present_unverified) so a present-but-rejected key cannot look configured.
```

## Built with

next.js · react · typescript · tailwindcss · server-sent-events · anthropic-claude · openai · zod · vitest · perfectcorp-youcam-api

## Repo

https://github.com/Lockelamoree/aphrodite (MIT)
