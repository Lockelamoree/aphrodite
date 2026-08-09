# Aphrodite — Devpost submission (DRAFT)

> Draft for review. Measured claims only — every line below is backed by something
> a judge can see in the repo or the demo. Nothing here asserts live-render quality
> we haven't verified, or retail metrics without a source.

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
- **Keeps going.** Save an **image-free** plan (no photo, mask, or raw API response stored) and return for a glow check-in that diffs your scores against the saved run. A studio lets you try a new hair color, hairstyle, or makeup on the same selfie (live with a YouCam key).

## How I built it

- **Next.js 16 / React 19 / TypeScript / Tailwind v4**, streamed over Server-Sent Events. The whole concierge is one streamed route plus one client component.
- **Two engines, one event stream.** An **agentic** engine (Claude *or* GPT) orchestrates the YouCam REST APIs via typed function-calling tools, reasoning over your scores; and a **guided** rule engine produces the *same* board with no LLM at all. They emit an identical event stream, so the UI doesn't care which drove the run. The app works on a YouCam key alone; the LLM is a pure upgrade.
- **YouCam / Perfect Corp AI API** drives every render over REST: Skin Analysis, Skin-Tone / Facial Color, Apparel Try-On, AI Photo Lighting — plus AI Hair Color, AI Hairstyle, and AI Makeup in the studio.
- **Cost-safe demo mode.** A fixture/replay layer serves real captured YouCam outputs so the entire app — plan, try-on, refine, save, check-in — runs with **zero API units and no keys**, and the UI labels itself *"demo mode · sample renders"* so nothing over-claims.
- **Hardened boundary.** zod request validation, per-IP rate limiting, a payload-size cap, and raw provider fields stripped out of the stream. 45 Vitest tests (occasion parsing, garment selection incl. mis-gender guards, request validation, raw-field stripping, rate limiting); `tsc` / `lint` / `build` green.

## YouCam APIs used

Skin Analysis · Skin-Tone / Facial Color Analysis · Apparel (Cloth) Try-On · AI Photo Lighting · AI Hair Color · AI Hairstyle · AI Makeup Try-On. The **special-category** goal — Skin AI **and** Apparel VTO fused into one experience — is the core loop: the same skin read that drives the skincare countdown also feeds the coloring that drives the outfit that gets rendered on you.

## Challenges

- **Coherence across horizons.** Making the countdown differ in *kind* (weeks vs. a day out) instead of just restating scores took real rule design, and keeping every "→ product" chip resolvable to a priced basket row.
- **Not mis-gendering the styling.** Undertone-driven selection kept defaulting to one wardrobe; fixing it meant reworking the scoring and expanding the catalog, locked down with regression tests.
- **Honesty under demo constraints.** Because the demo runs on captured fixtures, I had to be careful that copy never promises a live render it can't show — the before/after only ever shows real YouCam output, and studio try-ons that aren't captured degrade to an honest message rather than a fabricated image.

## Accomplishments I'm proud of

A complete, coherent product — not a PoC — that a beauty/fashion retailer could drop into its own funnel, with a genuinely honest demo and a swappable catalog + theme. And the two-engine design: the same experience with or without an LLM.

## What I learned

How much of a "wow" try-on demo is actually *product coherence* — timing, provenance, honesty — rather than any single render. And that adversarial self-review (scoring against the real criteria each cycle) catches over-claims faster than building more features.

## What's next

- Capture the studio try-on fixtures + a cool-tone full-body render so the fully-fused chain renders on screen in the zero-cost demo.
- Point the catalog at a real retailer's live products so the shoppable basket becomes a live storefront.
- A one-click hosted deploy with a live LLM key + spend cap, so the agentic engine can be judged live.

## How to test it (zero API units)

```bash
git clone https://github.com/Lockelamoree/aphrodite && cd aphrodite
npm install
cp .env.example .env.local     # demo mode (YOUCAM_FIXTURES=1) is already set
npm run dev                    # http://localhost:3000 → "Wedding · full-body" sample
```

No keys needed; the whole flow runs on captured renders, labelled *"demo mode."* Add a `YOUCAM_API_KEY` (+ set `YOUCAM_FIXTURES=0`) for live renders, and an `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` to switch on the agentic engine.

## Built with

next.js · react · typescript · tailwindcss · server-sent-events · anthropic-claude · openai · zod · vitest · perfectcorp-youcam-api

## Repo

https://github.com/Lockelamoree/aphrodite (MIT)
