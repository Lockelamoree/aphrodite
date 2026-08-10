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
| Test suite | **89 tests in 10 files, all passing** | `npm test` (vitest 4.1.10) — "Test Files 10 passed (10), Tests 89 passed (89)" | 2026-08-10 | README "Testing", devpost "Hardened boundary" |
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
| Demo video length | 87.200 s (cut A) / 122.306 s (cut B) | `ffprobe` on both files | 2026-08-10 | nowhere yet — neither cut is published |
| DNS | `aphrodite.max-gutowski.de` → `152.53.229.182` | `getent hosts` | 2026-08-10 | README, devpost |
| Deployed revision | `edb01c2` | `GET /healthz` on the hosted instance | 2026-08-10 | `/healthz` |

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
| Skin Analysis producing scores from any image | Every live attempt so far used a bundled sample whose face is too small. The API has never returned scores to this project outside fixtures. | `receipts/README.md` |
| The agentic (LLM) engine running for a judge | `/healthz` reports `agentic_engine: live` on gpt-5, but it sits behind an access code, so an anonymous judge never sees it fire. | devpost — keep it an architecture note, not a lead claim |
| Any retail metric (conversion, return rate) | Perfect Corp publishes such figures; this project has measured none of its own and must not borrow theirs as if it had. | devpost "Built for retail", README |
| Studio try-ons (hair colour, hairstyle, makeup) | Two of three slugs never verified, no captured fixture, nothing renders. | README surface table, devpost "wired but not shipped" |
| Skin-read variation across faces | Review 002 found every face returns the same fixture read. Until a second skin fixture exists, the fused chain is narrated, not demonstrated. | `HACKATHON.md` tiebreaker section |

## Known contradictions still open

| Contradiction | State |
|---|---|
| `/healthz` reports `youcam_apis_wired: 8` while the honest figure to judge on is 4 | documented in README and devpost; the fix is to drop `lookVto` (0 call sites) and report the rendering count separately |
| Live revision `edb01c2` is behind `origin/main` | declared in `config.json` `knownGaps`; both intervening commits touch only `hackathon/`, so product code is at parity |
| The hero stat block in `components/Concierge.tsx` claims 4 fired APIs in demo mode | **open defect**, review 002 fatal flaw 1 — a code fix, not a copy fix |
