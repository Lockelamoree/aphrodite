# Claim-to-proof map

Written 2026-08-10, after review 002 found the enforcing artifact missing while
standing order 2 of `HACKATHON.md` already required it. The order says numbers in
submission copy come from a measured row here. Without the map that was a habit;
with it, it is checkable — and the first thing it caught was `submission/devpost.md`
claiming "45 Vitest tests" against a measured 89.

**Rules of this file**

1. A number that appears in `README.md`, `submission/devpost.md`, the product UI or
   the demo video needs a row here, with the command or endpoint that produced it.
2. Anything not measured says **"Not yet measured"** in this table *and* in the copy.
   A target dressed as a measurement is the failure mode this file exists to stop.
3. When a number changes, the row changes in the same commit as the copy.

---

## Measured

| Claim | Value | How it was measured | When | Appears in |
|---|---|---|---|---|
| Test suite | **112 tests in 12 files, all passing** | `npm test` (vitest 4.1.10) — "Test Files 12 passed (12), Tests 112 passed (112)" | 2026-08-12 | README "Testing", devpost "Hardened boundary" |
| Type check | clean, exit 0 | `npx tsc --noEmit` | 2026-08-10 | README, devpost |
| Lint | clean, exit 0, no output | `npm run lint` (eslint) | 2026-08-10 | README, devpost |
| Build | succeeds, 8 routes emitted | `npm run build` | 2026-08-10 | README, devpost |
| APIs chained per run | **4** — skin analysis, skin-tone, apparel try-on, photo lighting | driven end to end on the hosted instance; each step names its API in the provenance ledger | 2026-08-10 | README hero table, devpost hero table, product UI |
| API endpoints declared | **8** | `lib/youcam/config.ts` `fileEndpoints`; also `/healthz` `youcam_apis_wired: 8` | 2026-08-10 | README surface table |
| Endpoints with a calling module | **7** | grep for each key outside `config.ts`; `lookVto` returns 0 call sites | 2026-08-10 | README surface table, devpost |
| Slugs verified against the live API | **5** | header comment in `lib/youcam/config.ts` (2026-07-19 / 2026-07-24); `makeup` and `hairstyle` are marked unverified after 401s | 2026-07-24 | README surface table, devpost |
| Full loop duration | **~4.5 s** | fixture-served run on the hosted instance; review 002 measured 4.4 s | 2026-08-10 | README, devpost, video script |
| Catalogue size | **11 garments, 17 skincare SKUs** | `/healthz` `garments` / `skincare_skus`, read from the loaded catalogue | 2026-08-10 | README hero table, `/healthz` |
| Wardrobe balance | **9 feminine : 1 masculine : 1 neutral** | pinned by `tests/catalog.test.ts`; widening the catalogue trips the test | 2026-08-10 | README "Asking instead of assuming" |
| Units per public visit | **0** | `live_runs_used` held at 0/8 on the hosted instance across every run review 002 drove | 2026-08-10 | README, devpost, product UI |
| Unit cost of a live run | **4–5 units** | four task calls per run, one per chained API | 2026-07 | README "Judge mode", `config.json` |
| Remaining unit balance | **584** | operator-stated. **Not machine-verifiable** — no documented YouCam endpoint exposes a balance | 2026-08-10 | `HACKATHON.md`, `config.json` |
| Demo video length | **88.0 s**, 1280×932 | `ffprobe` on `submission/aphrodite-demo-2026-08-10.mp4` | 2026-08-10 | the submission, once uploaded. Inside the published 1–3 min window |
| Screenshot gallery | **10 stills**, production build, demo mode, gate configured | `node scripts/capture-screenshots.mjs` against `npm start`, headless at 1440×900@2×; `submission/screenshots/` | 2026-08-12 | the Devpost screenshots field |
| Captured renders in demo mode | **2** — one try-on (`sampleA` + `slate-suit`) and one relight (`sampleSelfie`) | the tables in `lib/youcam/fixtures.ts`, pinned by `tests/fixture-identity.test.ts`; every other person-or-garment combination refuses and the UI shows an honest empty state | 2026-08-12 | the product UI, README "Honesty and privacy" |
| APIs with a visible render on the wedding path | **3** of 4 — skin, colour, apparel | the on-screen provenance ledger reads "3 Perfect Corp APIs produced these samples"; Photo Lighting is absent because no relight of that face has been captured | 2026-08-12 | `submission/screenshots/07-provenance-ledger.jpg` |
| Captured cool skin scores | dark circles 68, moisture 68, fine lines 82, firmness 83, pore 84, texture 86, age spots 91, acne 99, oiliness 99, redness 99 | a real skin-analysis run on `samples/selfie-2.jpg`; these values now drive the fixture and the on-screen plan | 2026-08-10 | the product UI on the selfie-only path |
| Captured cool overlay | the dark-circle mask of that same face | same run's `mask_urls`, downloaded and committed as `public/fixtures/skin-overlay-cool.jpg` | 2026-08-10 | the comparator on the selfie-only path |
| Captured warm colour read | skin `#b7947d`, eye `#000000`, lip `#986861`, eyebrow `#3e3834`, hair "Auburn" | a real skin-tone run on `samples/full-body.jpg`, `face_quality` good on every axis | 2026-08-10 | the palette panel on the wedding path |
| DNS | `aphrodite.max-gutowski.de` → `152.53.229.182` | `getent hosts` | 2026-08-10 | README, devpost |
| Deployed revision | `1cb7784`, **equal to `origin/main`** | `GET /healthz` on the hosted instance, compared against `git rev-parse origin/main` | 2026-08-12 | `/healthz` |
| Judging-time evidence route | `/api/dev/verify` answers **200** in production behind the role cookie, **401** without it, and its default mode spends **0 units** | driven against the **hosted instance** on 2026-08-12 after deploying `1cb7784`: 401 anonymous, 200 with a judge cookie redeemed at `/unlock`, four contract steps returned (three success, one provider error), and `/healthz` still reported `live_runs_used: 0` afterwards; `tests/verify-route.test.ts` fails the suite if the free path touches the network | 2026-08-12 | `config.json` kill gate 2, README, devpost |
| Pinned contract matches the receipts | every row of `lib/youcam/contract.ts` matches the receipt it names, by `task_id`, endpoint pair, duration and render hash | `tests/verify-route.test.ts` — "the pinned contract matches the committed receipts" reads `hackathon/receipts/*/receipt.json` and compares field by field | 2026-08-12 | `/api/dev/verify` |

## Measured against the live API, 2026-08-10 — `hackathon/receipts/`

Seven tasks, ~7 units, with operator approval. Four succeeded, three returned provider
errors, and all seven are committed including the failures.

| Claim | Value | Evidence |
|---|---|---|
| Apparel VTO renders live | **yes** — 222,607 bytes, 14.7 s | real `task_id`, `sha256 27c9d899f431ddf6…`, `receipts/000-misaimed-attempt/receipt.json` |
| Photo Lighting renders live | **yes** — 126,542 bytes, 3.6 s | real `task_id`, `sha256 44cd13b0…`, bytes committed at `receipts/001/photo_lighting.render.jpg` and re-verified after download |
| Skin-Tone / Facial Color reads live | **yes** — `skin_color #b7947d`, `hair_color #B56637`, `face_quality` all "good", 7.0 s | real `task_id`, run on `samples/full-body.jpg` |
| The four-step client contract | **confirmed live** — presigned-PUT upload → flat-body `runTask` → poll to `task_status` → results | every step in both receipt files |
| Skin Analysis on the bundled wedding selfie | **fails live** — `error_src_face_too_small` | `receipts/001/receipt.json`. Not a claim; a defect, recorded below |
| Skin-Tone on the bundled wedding selfie | **fails live** — `error_face_angle_downward` | `receipts/001/receipt.json` |

## Not yet measured — and said so out loud

| Claim | Why it is unmeasured | Where it must be labelled |
|---|---|---|
| A complete live run of all four steps in one chain | Two of the four fail on the bundled sample photo (see above), so no single live run has traversed the whole chain. Three of the four APIs are individually proven; the chain is not. | devpost (labelled), README "What is wired versus what renders" |
| Skin Analysis on the *wedding* sample | Rejected live (`error_src_face_too_small`). Skin analysis **does** work — it returned real scores and ten masks for `samples/selfie-2.jpg` — but not for this photo. | `lib/youcam/fixtures.ts`, `receipts/README.md` |
| The agentic (LLM) engine running for a judge | `/healthz` reports `agentic_engine: live` on gpt-5, but it sits behind an access code, so an anonymous judge never sees it fire. | devpost — keep it an architecture note, not a lead claim |
| Any retail metric (conversion, return rate) | Perfect Corp publishes such figures; this project has measured none of its own and must not borrow theirs as if it had. | devpost "Built for retail", README |
| Studio try-ons (hair colour, hairstyle, makeup) | Two of three slugs never verified, no captured fixture, nothing renders. | README surface table, devpost "wired but not shipped" |
| The warm sample's skin scores | **Illustrative, not captured.** The live API rejects `samples/selfie.jpg` and `samples/full-body.jpg` for skin analysis with `error_src_face_too_small`, so no real read of that person's skin exists. | `lib/youcam/fixtures.ts` provenance header |
| A relight of the wedding sample | **Does not exist.** `finish.jpg` was a render of a fourth person and was deleted on 2026-08-12; the only captured relight belongs to `samples/selfie.jpg`. One lighting task (~1 unit) on `samples/full-body.jpg` would restore the fourth API on the flagship path. | the lighting slot's empty state, `hackathon/config.json` knownGaps |
| A second captured try-on render | **Does not exist.** One person-and-garment pair is captured, so two faces cannot yet be seen producing two different garments — the tiebreaker's falsifiability test. | `HACKATHON.md` tiebreaker section |
| The cool sample's colour profile | **Illustrative, not captured.** `samples/selfie-2.jpg` is rejected for skin-tone with `error_face_not_forward_facing`. | `lib/youcam/fixtures.ts` provenance header |
| A spoken voiceover on the demo video | Not produced: no TTS on the machine that cut the reel. The narration lines are burned in as captions instead. | `submission/demo-video-script.md` header |
| Whether the *garment* changes with the face | Partly closed: the two samples now return genuinely different skin reads (one captured, one illustrative) and different plans, but only one apparel render is captured, so a judge still cannot watch two faces produce two different garments. | `HACKATHON.md` tiebreaker section |

## Known contradictions still open

| Contradiction | State |
|---|---|
| `/healthz` reports `youcam_apis_wired: 8` while the honest figure to judge on is 4 | documented in README and devpost; the fix is to drop `lookVto` (0 call sites) and report the rendering count separately |
| ~~Live revision `edb01c2` is behind `origin/main`~~ | **closed 2026-08-12.** `/healthz` reports `e791a7e`, equal to `origin/main`. Re-verified from outside |
| ~~The hero stat block claims 4 fired APIs in demo mode~~ | **closed** in `bc1ef29`, re-verified in the live HTML on 2026-08-12: 0 hits for "APIs chained in one run" and 0 for "read from your own photo", 1 link to `/unlock`, 1 "Demo mode" |
| The receipts folder does not account for every live task this file cites | **open, and it cuts against us.** This file says "seven tasks, ~7 units … all seven are committed", and the two receipt files do carry exactly seven. But rows above also cite live results with **no committed receipt**: the captured cool skin scores and mask (a successful `skin-analysis` run on `samples/selfie-2.jpg`), that same photo's `error_face_not_forward_facing` skin-tone rejection, and two headshot screenings at 900×900 and 2000×2500. Those are at least four further tasks. So either the "seven tasks / ~7 units" total understates the real spend — which would also make the ~577 remaining-balance arithmetic wrong — or those runs happened outside the receipt harness and were never written down. Operator call: reconcile against the Perfect Corp console, then correct whichever number is wrong. Do not resolve it by deleting the citations |
