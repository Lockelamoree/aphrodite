# Aphrodite

I built Aphrodite for Perfect Corp's [YouCam API Skin AI & Apparel VTO Hackathon](https://youcam-api.devpost.com/). The idea is simple: you tell it the occasion, share one selfie, and it reads your skin and coloring, plans a prep countdown timed to the day, renders the outfit onto you, and hands you one shoppable look board.

Most virtual try-on demos stop at "here's a garment on you." I wanted the thing I actually want before a wedding or an interview — *what do I do with my skin between now and the day, what should I wear for my coloring, and where do I buy all of it* — answered in one place, from a single photo.

## What it does

- **Reads you with YouCam AI.** Skin Analysis (0–100 health scores — I focus the lowest ones), Facial Color / Skin Tone (I derive your undertone and a palette from the colors it detects), Apparel Try-On (the outfit rendered onto your photo), and AI Photo Lighting (a camera-ready finish on the selfie).
- **Plans the occasion.** A skincare countdown that changes in *kind* with how far off the event is — weeks out it front-loads active ingredients and tapers them; a day out it stops new actives and switches to hydration and de-puffing, so nothing flares on the day.
- **Dresses you for your coloring, and asks before it assumes.** Your undertone drives the outfit pick — a cool read leans to cool-flattering pieces — and the garment is rendered on you, not just described. Which *cut* you want is a question the app asks outright, and it overrides the colour match when the two conflict; see [Asking instead of assuming](#asking-instead-of-assuming).
- **Completes the look.** One cross-category, priced basket — skincare + the garment + matched accessories — with an on-screen ledger of exactly which YouCam APIs produced each result.
- **Keeps going.** Save an image-free plan (no photo, mask, or raw API response is stored) and come back for a glow check-in that compares your scores to your saved run. There's also a studio to try a new hair color, hairstyle, or makeup look on the same selfie (live with a YouCam key).

## Two engines, one stream

There are two ways to run the concierge, and they emit the *same* event stream, so the interface doesn't care which one drove the run:

- **Agentic** — Claude (or GPT) orchestrates the YouCam APIs by reasoning over your scores and calling them through typed REST function-calling tools. Needs an LLM key.
- **Guided** — a rule engine that produces the same board with no LLM at all. Runs on the YouCam key alone.

I did it this way on purpose: the app works with just a YouCam key, and the agentic engine is a pure upgrade on top of it.

## Getting started

The quickest way to see it is **demo mode** — captured sample renders, no keys, and zero API units spent:

```bash
git clone https://github.com/Lockelamoree/aphrodite
cd aphrodite
npm install
cp .env.example .env.local     # demo mode (YOUCAM_FIXTURES=1) is already set
npm run dev                    # http://localhost:3000
```

That runs the whole flow — plan, try-on, refinement, save and check-in — against pre-recorded YouCam outputs, and the UI labels itself *"demo mode · sample renders"* so nothing over-claims.

To run it live on your own photo, add a YouCam key and turn fixtures off in `.env.local`:

```bash
YOUCAM_API_KEY=your_key        # free tier: https://yce.perfectcorp.com/api-console
YOUCAM_FIXTURES=0
```

Add an `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`) to unlock the agentic engine — the app detects the key on the server and switches the toggle on for you.

| Var | Purpose |
|---|---|
| `YOUCAM_API_KEY` | YouCam / Perfect Corp API key (required for live renders) |
| `YOUCAM_FIXTURES` | `1` = demo mode, zero units (default); `0` = live renders |
| `ANTHROPIC_API_KEY` | Agentic engine, Claude brain (optional; preferred when both are set) |
| `OPENAI_API_KEY` | Agentic engine, GPT brain (optional; `OPENAI_MODEL` overrides the default) |

## Built for retail

Aphrodite is meant to drop into a beauty or fashion retailer's own funnel:

- The whole experience is one streamed route plus one client component, themeable through the Tailwind tokens in `app/globals.css` — swap the palette to a brand in one place.
- Garments, skincare, and accessories live in `lib/concierge/catalog.ts` with price / retailer / URL fields. Point them at real products and the "shop the look" basket becomes a live storefront.
- Every board is a priced, cross-category basket with a provenance ledger, and the outfit is rendered on the shopper *before* they buy — the try-before-you-buy pattern Perfect Corp makes the conversion-and-fewer-returns case for.

The demo catalog and its "shop" links are clearly labelled sample inventory (the links are product searches), not a real store.

## Asking instead of assuming

Aphrodite asks you to pick a cut — feminine or masculine — before the first run, and
there is deliberately no "either / no preference" option.

That is not an oversight, it is the fix for a real bug. Presentation is not something
to guess from a photograph, so the app never looks at your face to decide it. But an
unset value is a guess too: the demo catalogue holds nine feminine cuts to one
masculine and one neutral, so anything that failed to state a cut resolved feminine
in practice. It did exactly that — the bundled masculine sample was being rendered in
an evening gown, with statement earrings and heels in the basket, because the cut
filter only ran on the grooming track and a tie-breaker leaned away from suits.

So the question is asked once, in one tap, and the answer is enforced on every code
path and in both engines. `tests/cutPreference.test.ts` guards it, and it also pins
the catalogue's 9:1:1 shape so that widening the wardrobe trips the test rather than
quietly changing behaviour.

The honest limit: there is currently **one** masculine garment, so a masculine
shopper has no smart or casual option and no warm-toned one. The app declines to
claim a colour match it cannot make, rather than inventing one.

## Check it yourself

`GET /healthz` reports state, not liveness — no key required:

```bash
curl -s http://localhost:3000/healthz
```

It returns the deployed revision, whether demo mode is on, the headline counts read
from the loaded catalogue (so this README, the submission copy and the running system
can be checked against each other), and a **three-state** answer per model-backed
feature: `live`, `off`, or `key_present_unverified`. That middle state is the point —
a key that is present but rejected, exhausted, or aimed at a model the account cannot
see looks configured while nothing is actually happening.

The LLM probe is a `GET /v1/models` call, so a health check never costs money. YouCam
is deliberately *not* probed, because every YouCam task call spends units from a
finite tier.

## Honesty and privacy

This is a hackathon entry, and being straight with the user matters to me. The app never passes a sample render off as a live one; the before/after only ever shows real YouCam output; the saved plan keeps no image or raw API data; image processing sits behind an explicit consent step; and every bit of skin guidance is cosmetic, not medical.

## Testing

```bash
npm test
```

Vitest covers occasion parsing, the catalog and garment selection (including guards against mis-gendered styling), request validation, and stripping raw provider fields out of the stream. The API route validates the request body (zod), caps payload size, and rate-limits per IP.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind v4 · Anthropic SDK · OpenAI · Zod · Vitest · YouCam (Perfect Corp) AI API.

## License

MIT — see [LICENSE](LICENSE).
