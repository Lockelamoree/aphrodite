# Aphrodite Implementation Handoff

Last updated: 2026-07-23 UTC

## 2026-07-24 (later) — review-cycle-3 P0+P1 fixes (branch review-cycle-3-fixes)

A third adversarial review (43 raised / 42 verified) found the cycle-2 work had regressions. P0+P1
fixed + verified (tsc, 30 Vitest tests incl. new pickGarment guards, lint, build; 6 real-output checks):
- **Mis-gendering cluster (root cause):** `pickGarment` neutral bonus now only applies when an
  undertone was read (grooming → the masculine Slate Suit, not the women's Ivory Pantsuit); the
  "Surprise me" default breaks ties toward a dress/separates (a cool woman no longer defaults into the
  men's suit); tone refines (cooler/warmer) keep the garment's wardrobe (a gown stays a gown).
- **Agentic visibility:** `app/page.tsx` (server) now derives the toggle from real key presence and
  passes it to `Concierge` — no separate NEXT_PUBLIC flag to drift. Still needs a real key in the
  demo env to actually run agentic.
- **Fixture render coherence:** `tryOnApparel({renderHint})` → fixture keyed on wardrobe, so a
  "separates" set no longer renders the grey men's suit image.
- **Honesty:** selfie-only cool sample no longer shows the untouched upload as a "relight" (honest
  empty state); the deliberately-skipped try-on no longer renders as a red ✗ failure; README
  "camouflage" removed.
- Tests: `tests/pickGarment.test.ts` guards the never-mis-gender promise.

Known residual (accepted, needs a `presents` tag or a masculine warm suit): a warm/neutral shopper
on the STYLE track picking wardrobe=suits still gets the neutral Ivory Pantsuit. Deferred P2s from
cycle-3: fit-to-budget dead-end, check-in cross-person label, saved-plan shape validation, real
affiliate links, HACKATHON.md + demo video, rate-limit/413 robustness.

---


## 2026-07-24 — Ordered Work COMPLETED (review-cycle-2-hardening)

All six ordered-work sections below were implemented + verified (tsc, lint, 23 Vitest tests,
production build all green; fixture-mode browser flow + 390px verified):

1. **Live consumer flow** — `RetailBasket` + `useSavedPlan` wired into `Concierge.tsx`; wardrobe
   preference control (sent on every request incl. refine); image-processing consent gate; saved
   image-free runway + glow check-in with score deltas. (Kept the engine toggle + brain badge and
   `NextWithAphrodite` per product decision — did NOT apply `/tmp/Concierge.tsx.new`, now deleted.)
2. **UI quality / mobile** — `BoardActions` set-state-in-effect replaced with a lazy initializer
   (lint now passes); lucide icons; neutral relight caption; `min-w-0` + `break-words` → 390px has
   zero horizontal overflow.
3. **API boundary** — `lib/concierge/request-schema.ts` (zod) → 400; `Content-Length` → 413; per-IP
   rate limit → 429; `lib/concierge/sanitize.ts` strips raw provider fields from the SSE stream.
4. **Tests** — `vitest.config.ts` + `npm test`; occasion / catalog / schema / sanitize suites.
5. **Retail honesty** — agentic skincare/accessory rows now carry id/kind/inStock metadata; basket
   stays labelled demo inventory. (Real affiliate links still out of scope.)
6. **Validated end to end** — see above.

Also landed this pass: catalog expanded 4→10 garments (fixes interview-has-no-female-option and
menswear-on-a-woman); `completeTheLook` keyed on wardrobe type; ~11 deterministic copy/coherence
bugs from an adversarial review fixed; prompt "camouflage" removed. Shipped via PR (squash-merge).

Still open (need units/decisions): real retailer/affiliate integration; live-VTO render quality of
the new catalog images (fixtures make the demo safe); exact cited retail-impact figure.

---


This document is the pickup point for the next Claude session. Read it before
editing. The worktree contains both pre-existing user changes and changes made
during the current implementation pass. Do not reset, revert, or replace dirty
files without inspecting their diffs.

## Goal

Turn Aphrodite into a hackathon-ready YouCam prototype that clearly exceeds a
single API wrapper:

- Combine YouCam Skin Analysis, Color Analysis, Apparel VTO, and Photo Lighting
  into one occasion-based consumer journey.
- Convert analysis into an actionable prep plan, a coherent try-on, and a
  shoppable retail basket.
- Make the first-run value obvious, respect user-selected wardrobe preferences,
  and use honest privacy, medical, inventory, and demo-state language.
- Support a saved, image-free runway and a later skin check-in so the experience
  has continuity beyond one API call.

The intended product story is an occasion concierge: the user selects an
occasion and wardrobe preference, consents to image processing, receives a
cosmetic prep plan and complete look, adjusts a demo retail basket to a budget,
then saves a non-image plan and returns for a progress check-in.

## Repository State

- Branch: `main`
- Starting commit: `edb54b2`
- The worktree is intentionally dirty.
- `npx tsc --noEmit` passes as of this handoff.
- The current source has not had a full lint, test, production build, or browser
  verification pass after the changes below.
- `/tmp/Concierge.tsx.new` exists, but it is an unverified draft and is not part
  of the repository.

Current `git status --short`:

```text
 M .env.example
 M README.md
 M app/api/concierge/route.ts
 M components/Concierge.tsx
 M hooks/useConcierge.ts
 M lib/concierge/catalog.ts
 M lib/concierge/deterministic.ts
 M lib/concierge/orchestrator.ts
 M lib/concierge/prompt.ts
 M lib/concierge/types.ts
 M lib/env.ts
 M package-lock.json
 M package.json
?? components/RetailBasket.tsx
?? hooks/useSavedPlan.ts
?? lib/concierge/agent-tools.ts
?? lib/concierge/openai.ts
?? CLAUDE_HANDOFF.md
```

## Preserve Existing Work

These changes were already present before the current implementation pass:

```text
 M .env.example
 M README.md
 M app/api/concierge/route.ts
 M components/Concierge.tsx
 M hooks/useConcierge.ts
 M lib/concierge/orchestrator.ts
 M lib/concierge/types.ts
 M lib/env.ts
?? lib/concierge/agent-tools.ts
?? lib/concierge/openai.ts
```

They include the agentic/deterministic orchestration work. Inspect and extend
them; do not restore them to `HEAD`.

## Applied Changes

### Dependencies

Installed and recorded in `package.json` and `package-lock.json`:

- `next@16.2.11`
- `lucide-react`
- `zod`
- `vitest` as a development dependency

There is not yet a `test` script or Vitest configuration. `eslint-config-next`
is still `16.2.10` while Next is `16.2.11`; align these during final dependency
cleanup. The last install reported three high-severity audit findings.

### Wardrobe preference and catalog metadata

`lib/concierge/types.ts` now defines:

- `GarmentPreference`: `surprise`, `dresses`, `suits`, or `separates`
- `ConciergeRequest.garmentPreference`
- richer `ShoppingItem` metadata: stable optional ID, item kind, sizes, and
  inventory state

`lib/concierge/catalog.ts` now:

- labels catalog garments by wardrobe type
- records sizes and demo inventory
- exports `garmentMatchesPreference`
- includes wardrobe type in the model-facing catalog

The catalog currently has only one suit and one separate. Rerolling those
preferences can therefore produce no visible change. Add more garments if time
allows.

### Orchestration and prompting

The prompt, deterministic path, agent tools, and OpenAI path now carry the
wardrobe preference through the run:

- Explicit preferences are honored rather than inferred from the image.
- The grooming track forces a suit-compatible selection.
- The agent tool rejects a model-selected garment that conflicts with the
  explicit preference.
- The deterministic picker filters by preference before choosing a garment.

The deterministic narration no longer unconditionally claims that overall skin
health is high. It uses a score-aware cosmetic lead instead.

Deterministic shopping output now includes stable item IDs, kinds, sizes, and
demo inventory metadata. The agentic path still needs equivalent metadata for
skincare and accessory items.

### New, currently unwired UI modules

`components/RetailBasket.tsx` provides an interactive demo basket with:

- selectable products
- apparel size selection
- budget slider
- fit-to-budget behavior
- explicit demo inventory language
- retailer handoff action
- local retail event recording under `aphrodite_retail_events_v1`

`hooks/useSavedPlan.ts` provides a local, image-free saved runway using
`useSyncExternalStore` and localStorage key `aphrodite_saved_runway_v1`.
It stores the plan, cosmetic scores, color result, and settings while omitting
photo data, masks, and raw provider responses.

These modules compile but are not imported by the live `Concierge` UI yet.

## Unapplied Concierge Draft

`/tmp/Concierge.tsx.new` is an attempted integration draft. It is not trusted
source and must not be applied blindly. It was produced with:

- `/tmp/transform-concierge-basic.cjs`
- `/tmp/transform-concierge-sections.cjs`
- `/tmp/board-actions.snippet`
- `/tmp/look-board.snippet`
- `/tmp/runway-helpers.snippet`
- `/tmp/wardrobe-toggle.snippet`

The draft attempts to:

- import `RetailBasket`, `useSavedPlan`, and Lucide icons
- remove the consumer-facing engine selector and use automatic orchestration
- add image-processing consent and wardrobe preference controls
- make samples coherent: wedding selects suits and date selects dresses
- add a saved-runway banner, progress panel, and check-in flow
- replace static shopping rows with `RetailBasket`
- replace the misleading warm-relight caption with neutral relight language
- replace the effect-driven share state in `BoardActions`
- reduce mobile intrinsic-width overflow

Prettier did not run because the `.new` extension prevented parser inference.
To evaluate the draft, copy it to a `.tsx` path under `/tmp`, format it with the
TypeScript parser, inspect the full diff against `components/Concierge.tsx`, and
only then apply selected changes. Prefer a careful manual integration if the
draft conflicts with newer source.

## Ordered Work

### 1. Integrate the live consumer flow

- Wire `RetailBasket` and `useSavedPlan` into `components/Concierge.tsx`.
- Add the wardrobe preference control and send it on every request.
- Remove the engine selector from the consumer UI; use `mode: "auto"`.
- Make sample scenarios set an intentional preference.
- Add an explicit image-processing consent checkbox before submit.
- Add accurate Perfect Corp processing, image retention, and cosmetic-only
  language. Do not imply medical diagnosis or treatment.
- Add saved runway, reload, clear, and check-in states.
- Show score deltas during a check-in.
- Remove or replace `NextWithAphrodite` if it still implies retention that the
  product does not actually implement.
- Replace static shop rows with the interactive basket.

### 2. Fix UI quality and mobile behavior

- Replace the `BoardActions` set-state-in-effect pattern with derived capability
  checks and icon buttons for save, PDF, copy, and share.
- Use Lucide icons and tooltips for unfamiliar icon actions.
- Change lighting copy from a promised warm relight to neutral relight wording.
- Add `min-w-0` where result grids and product content create intrinsic width.
- Move multi-column result layouts to a wider breakpoint if needed.
- Verify that a 390px viewport has `scrollWidth === 390`.
- Check that labels, controls, prices, and product actions never overlap.

### 3. Harden the API boundary

- Add a Zod schema for the request body.
- Constrain occasion length, enum values, refine scores, and URL/data-URL forms.
- Validate image MIME type and decoded size.
- Reject oversized `Content-Length` before calling `req.json()`.
- Add a simple IP-based rate limit suitable for the prototype.
- Return clear `400`, `413`, and `429` responses for user-correctable failures.
- Strip raw provider fields before emitting SSE events to the browser in both
  deterministic and agent-tool paths.

Read the installed Next.js 16 guides in `node_modules/next/dist/docs/` before
changing route handlers, streaming, or environment handling. This repository's
Next version has breaking changes relative to older documentation.

### 4. Add focused tests

- Add a Vitest configuration with the `@` path alias.
- Add `"test": "vitest run"` to package scripts.
- Test occasion parsing.
- Test catalog preference matching and deterministic garment selection.
- Test request schema acceptance and rejection cases.
- Add regression coverage for stripping provider-only/raw fields if practical.

### 5. Complete retail honesty

- Add item ID, kind, and inventory metadata to agentic skincare/accessory output.
- Keep the basket labeled as demo inventory until real retailer integrations
  exist.
- Current garment links are Google shopping searches and the catalog uses an
  invented `Aphrodite Edit` retailer. Do not present this as a real cart or
  confirmed stock.
- Add more suit and separate options if reroll quality matters for the demo.

### 6. Validate end to end

Run, in order:

```bash
npx prettier --write <affected-files>
npx tsc --noEmit
npm test
npm run lint
npm run build
npm audit
YOUCAM_FIXTURES=1 npm run dev
```

Then verify at desktop and 390px mobile widths:

- Wedding sample produces a suit-compatible try-on.
- Date/selfie-only sample explains Apparel VTO fallback cleanly.
- Consent gates the run.
- Basket selection, sizing, budget, and retailer handoff work.
- Saved runway survives reload without storing any image.
- Check-in computes and displays score deltas.
- Copy, share, save, and PDF actions report success/failure accurately.
- Loading, error, empty, partial-result, and fallback states are readable.
- No horizontal overflow or text/control overlap occurs.

## Definition of Done

The prototype is ready when a first-time judge can select a sample, understand
why image consent is required, generate a preference-correct look, adjust the
basket to a budget, save an image-free runway, and return for a check-in without
encountering misleading health, privacy, inventory, or retailer claims.

All of the following must also pass: TypeScript, focused tests, lint, production
build, desktop browser flow, and 390px mobile browser flow.
