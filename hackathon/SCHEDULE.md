# Schedule

**Hard deadline:** 2026-08-17, 11:45 EDT = 17:45 CEST.
**Self-set target:** 2026-08-15 — two days of slack, deliberately.
**Written:** 2026-08-10. Seven days to the deadline, five to the target.

## Never cut

These five are load-bearing. If time runs out, everything else goes first.

1. Public repo + MIT licence — **done**
2. Demo video uploaded and linked on Devpost — **open, and the hardest remaining item**
3. A hosted judge URL that stays live through judging — **done** (https://aphrodite.max-gutowski.de)
4. Zero-unit fixture fallback on every demo path — **done**, held at 0/8 through review 002
5. Honest demo-mode labelling — **done at the render layer, breached at the claim layer** (review 002 fatal flaw 1)

Added by review 002, same standing: **the submission has to exist.** An unsubmitted
entry scores nothing regardless of what is deployed.

## Cut order

Cut from the top when time gets short:

1. Studio try-ons (hair colour, hairstyle, makeup)
2. Accessory and makeup renders
3. Multi-turn refinement beyond the outfit

> Review 002 recorded a **cut-order inversion**: item 1 was still being carried in the
> copy and the UI while never-cut item 2 (the video) went undone. The fix is to cut
> item 1 from what is *claimed* — done in the doc pass of 2026-08-10 — not to keep
> polishing it.

## What is actually left

Ordered by score-per-hour from review 002's punch list. Owner CODE means it is a
change in the repo; HUMAN means only the operator can do it.

| # | Pri | Owner | Item |
|---|---|---|---|
| 1 | P0 | CODE | One commit: gate the hero stat block on demo mode, un-invert the before/after labels, link `/unlock` from the header |
| 2 | P0 | CODE | Hosted URL + judge code + headline stats at the top of the submission copy — **done 2026-08-10**, the code goes in the Devpost field |
| 3 | P0 | CODE | Un-404 `/api/dev/verify` in production behind the existing role cookie |
| 4 | P0 | CODE | Spend units once, on the record, and commit the receipt (needs operator approval) |
| 5 | P0 | HUMAN | Re-cut and publish exactly one canonical demo video |
| 6 | P0 | HUMAN | Actually submit on Devpost with both gating fields filled |
| 7 | P1 | CODE | One diagram: the fusion chain and the trust boundary |
| 8 | P1 | CODE | Make the fusion falsifiable — a second skin fixture and per-garment renders |
| 9 | P1 | CODE | Claim-to-proof map + number reconciliation, enforced in CI — **map written 2026-08-10**, CI still open |
| 10 | P1 | CODE | Teach the product to read a calendar date |
| 11 | P1 | CODE | Make the selfie upload keyboard-reachable |
| 12 | P1 | CODE | Deploy HEAD so the revision a judge reads matches the repo they clone |
| 13 | P1 | HUMAN | Capture an annotated screenshot gallery from the corrected hosted build |
| 14 | P2 | CODE | Walk the Devpost rules line by line — see `COMPLIANCE.md` |
| 15 | P2 | CODE | Cut the three non-rendering studio APIs from the copy — **done 2026-08-10** |
| 16 | P2 | CODE | Give the commercial half of the impact story one honest anchor |

## Two open operator decisions

Both were deliberately deferred until review 002 existed:

- **How to split the 584 remaining YouCam units** between judge-facing live runs
  (`APHRODITE_LIVE_RUN_BUDGET`, currently 8), a fixture capture session, and a video
  re-record.
- **Studio: merge or cut.** `studio-live-hair-color` adds live hair colour,
  hairstyle and makeup plus a skin re-check. Cut order says it goes first; review 002
  says a second skin fixture buys more tiebreaker points for fewer units.

## The shape of the risk

Every remaining Stage-One blocker is an upload, a paste or a small diff — none of them
is a build. The risk is not capacity, it is order: the engineering has been running
ahead of the paperwork for two cycles, and the paperwork is what is scored.
