# Aphrodite — your occasion concierge

**One selfie → a complete, occasion‑timed plan to look and feel your best on the day.**
Built for the **YouCam API Skin AI & Apparel VTO Hackathon** (Perfect Corp).

Aphrodite is a warm AI beauty companion. You tell her the occasion and share a selfie; she reads your
skin and your colors with **YouCam AI**, plans a skincare countdown timed to the event, renders an
outfit onto you, and assembles it into one shoppable **Occasion Look Board** — then keeps styling you
across future occasions.

## What it does
- **Reads you with YouCam** — Skin Analysis (0–100 *health* scores, focus the lowest), Facial Color
  Tones (undertone + depth‑aware palette), Apparel Try‑On (garment rendered on you), AI Photo
  Lighting (a camera‑ready finish).
- **Plans the occasion** — a skincare countdown whose *kind* adapts to how far away the event is
  (weeks → front‑load actives; a day out → protect & camouflage, no new actives).
- **Completes the look** — a cross‑category, priced "shop the look" basket (skincare + fashion +
  accessories), with an on‑screen provenance ledger of exactly which YouCam APIs produced each result.
- **Personalizes** — occasion presets, a skin‑goal focus (Glow / Smooth & firm / Clear / Even tone),
  and a self‑select **grooming track** (beard/hair/skin + suit instead of makeup).
- **Refines in place** — *Less/More formal · Cooler/Warmer · Try another* re‑style the board without
  re‑reading your skin.
- **Retains** — save/share the board, and a "What's next with Aphrodite" surface for more YouCam
  experiences (hair color, makeup, nails, jewelry, glow tracking).

## Architecture
Two engines emit the **same** `ConciergeEvent` SSE stream, so the app qualifies and demos with only a
YouCam key, and the agentic layer is a pure upgrade:

- **Agentic** (`lib/concierge/orchestrator.ts`) — Claude (Opus 4.8) orchestrates the YouCam APIs by
  reasoning over the scores and calling them through **typed REST function-calling tools** (not an MCP
  server at runtime — the same `lib/youcam/` client the guided engine uses). Requires `ANTHROPIC_API_KEY`.
- **Guided** (`lib/concierge/deterministic.ts`) — a rule engine that runs on the YouCam key alone.

`app/api/concierge/route.ts` streams the run; `components/Concierge.tsx` renders the live Look Board;
`lib/youcam/` is a thin, typed REST client for the Perfect Corp AI API.

## Getting started
```bash
cp .env.example .env.local     # fill in your keys
npm install
npm run dev                    # http://localhost:3000
```

### Environment (`.env.local`)
| Var | Purpose |
|---|---|
| `YOUCAM_API_KEY` | Perfect Corp / YouCam AI API key (required) |
| `ANTHROPIC_API_KEY` | Enables the agentic (Claude) engine (optional) |
| `NEXT_PUBLIC_HAS_ANTHROPIC` | Set `1` when the Anthropic key is present to show the Agentic toggle |
| `YOUCAM_FIXTURES` | Set `1` to serve captured sample renders and spend **zero** API units (great for dev/rehearsal); unset/`0` for live renders |

### Zero‑cost demo mode
With `YOUCAM_FIXTURES=1`, the four YouCam calls return captured sample outputs — the whole flow (plan,
refinement, grooming track, save/share) runs with no API units spent, and the UI labels itself
**"demo mode · sample renders"** so nothing over‑claims. The concierge *reasoning* is real; the
*reads/renders* are pre‑recorded. Two bundled samples map to two distinct profiles (a warm, full‑body
"wedding" read and a cool, selfie‑only "first date" read) so the demo isn't identical every run. Set
`YOUCAM_FIXTURES=0` for live renders of the actual selfie.

## Retail / white‑label
Aphrodite is built to drop into a beauty or fashion retailer's own funnel:

- **Embeddable flow** — the whole experience is one streamed route (`/api/concierge`) + one client
  component, themeable through the Tailwind `@theme` tokens in `app/globals.css` (swap the palette to
  match a brand in one place).
- **Bring‑your‑own catalog** — garments, skincare SKUs, and accessories live in
  `lib/concierge/catalog.ts` with `price` / `retailer` / `url` fields; point them at real products or
  affiliate deep‑links and the "shop the look" basket becomes a live storefront.
- **Cross‑sell by design** — every board is a priced, cross‑category basket (skincare + fashion +
  accessories) with an on‑screen provenance ledger; the outfit is rendered on the shopper before
  purchase, the pattern Perfect Corp reports lifting conversion and reducing returns.
- **YouCam‑key‑only mode** — the guided engine needs no LLM key, so a retailer can ship the whole
  concierge on their existing YouCam plan and add the agentic upgrade later.

## Stack
Next.js 16 · React 19 · TypeScript · Tailwind v4 · Anthropic SDK · YouCam (Perfect Corp) AI API.

## Notes
This is a hackathon entry. Product/skincare guidance is cosmetic, not medical. Secrets live only in
`.env.local` (gitignored) — never committed.
