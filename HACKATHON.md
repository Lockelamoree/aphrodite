# Aphrodite — YouCam API Skin AI & Apparel VTO Hackathon entry

> **This file is the activation marker.** Its presence at the repo root is what
> switches on the `hackathon-*` skills (`hackathon-judge`, `hackathon-submission`,
> `hackathon-demo-video`, `hackathon-ship`). Keep it at the project root, keep the
> `hackathon/` directory beside it, and keep `hackathon/config.json` current —
> every hackathon skill parses that file as its machine contract.

Written 2026-08-09, retro-fitted onto a project that was already five review
cycles deep. The event facts below are the **real** ones from the Devpost page,
not a reconstruction: earlier sessions worked from a guessed rubric and that
guess has been corrected.

## Event summary

| Field | Value |
|---|---|
| Event | YouCam API Skin AI & Apparel VTO Hackathon (Perfect Corp) |
| Track | Combined — Skin AI **and** Apparel VTO |
| Hard deadline | **2026-08-17 11:45 EDT** (= 17:45 CEST) |
| Target submission | **2026-08-15** — two days of slack, deliberately |
| Platform | Devpost — https://youcam-api.devpost.com/ |
| Prizes | 1st $5,000 · 2nd $1,000 · 3rd–5th 5,000 API units each |
| Required technologies | ≥1 YouCam Skin or Fashion API, running **inside** the product at judging time |

## The product in one line

**Aphrodite**: name an occasion, upload one selfie, and an AI beauty companion
returns a skincare countdown, an outfit rendered on your own body, and a
shoppable look board — every image a real YouCam render, nothing simulated.

- **Audience:** someone with a dated event and no confident plan for it — a
  wedding, an interview, a first date.
- **Anti-pattern:** must never read as a filter app or a skin-scoring gimmick.
  The product is the *plan for a specific day*, and the renders are its evidence.

## The four judged criteria

Verbatim-ish from the Devpost page. **No weights are published.**

1. **Technological Implementation** — how thoroughly and skillfully it integrates ≥1 YouCam Skin/Fashion API
2. **Design** — a complete, coherent product experience, not a proof of concept
3. **Potential Impact** — credibly solves a real problem for a real audience
4. **Quality of the Idea** — creative, non-obvious API usage plus genuine problem understanding

**Special category:** Skin AI and Apparel VTO fused into **one** experience.

## The tiebreaker decides everything

No official tiebreaker is published, so the working assumption is the **special
category**: Skin AI and Apparel VTO as one chain rather than two features on one
page. That is also where this entry is weakest relative to its own engine.

Standing order that follows from it: **the fused chain must be visible on
screen.** Logic the judge cannot see scores nothing. As of 2026-08-09 the studio
try-ons are gated off (`HAS_STUDIO_RENDERS=false`) and the smarter garment choice
falls back to an existing fixture image, so the strongest part of the build is
currently invisible.

## Biggest open unknown — answered 2026-08-09

**Who actually judges?** Checked on the Devpost page: **no individuals are named.**
The panel is listed as a single group, **"YouCam API Team"**, with no titles or
backgrounds. No criterion weights are published either.

So there is no roster to research and no personal taste to play to. `hackathon/config.json`
therefore models that one real entity as **one lens per published criterion**, with each
lens's wins/loses derived from that criterion's verbatim wording. Those are criterion
lenses, not people — they must never be presented as real judge intel.

The remaining unknown is the **internal weighting**, which is simply not published.

### One criterion clause worth pinning

The verbatim wording of *Technological Implementation* is broader than a code review:

> "How thoroughly and skillfully does the project integrate at least one YouCam API from
> the Skin/Fashion category? **Does the project demonstrate clear consumer or retail
> value?** Does the code reflect genuine effort and a working, non-trivial implementation?"

Retail value is scored **under the technical criterion**, not only under Potential Impact.
The priced basket, the cross-category mix and the return-confidence framing are therefore
judged artifacts, not decoration — they must stay visible on screen.

Prizes, for positioning: 1st $5,000 · 2nd $1,000 · 3rd–5th 5,000 API units each, each
tier also carrying a blog feature and a marketing meeting with Perfect Corp.

## Submission requirements

| Requirement | State on 2026-08-09 |
|---|---|
| Public repo + license | **done** — `github.com/Lockelamoree/aphrodite`, MIT |
| Text description | **draft** — `submission/devpost.md`, untracked |
| Screenshots | **done** — `~/aphrodite-demo/screenshots/` |
| Demo video 1–3 min, shows YouCam integration | **first cut done, not uploaded** — `submission/aphrodite-demo.mp4`, ~90 s |
| Hosted, judge-testable instance | **not yet** — VPS release is open |

## Standing orders

1. **No live YouCam calls without explicit approval.** Units are finite (free
   tier ~1000) and testing has already eaten into them. `YOUCAM_FIXTURES=1`
   serves captured fixtures at zero cost; a fixture run takes ~4.5 s versus ~90 s.
2. **Measured claims only.** Numbers in submission copy come from a measured row
   in the claim-proof map, never from an estimate that reads like a measurement.
3. **Honest degradation over fabricated output.** A render that cannot run shows
   an honest empty state; it never passes an untouched upload off as a result.
4. **Verify before claiming done:** `npx tsc --noEmit`, `npm test`, `npm run lint`,
   `npm run build` — all four green, plus a real fixture run through the UI.

## The battle-rhythm docs

Only the machine contract exists so far. The rest are created by the skills as
they run, not up front.

| Doc | State |
|---|---|
| `hackathon/config.json` | **written 2026-08-09** |
| `hackathon/reviews/` | to be written by `hackathon-judge` |
| `hackathon/JUDGE_DOSSIER.md` | blocked on the judge roster being unknown |
| `hackathon/RUBRIC.md`, `SCHEDULE.md`, `COMPLIANCE.md`, `VOCABULARY.md`, `CLAIM_PROOF_MAP.md` | not yet written |

## Prior work fence

`lib/youcam/` and `lib/concierge/` are new work for this event. The deploy
pattern (atomic symlink flip, health gate, access gate, Caddy front) is reused
from an earlier project of the author's on the same VPS — infrastructure, not
product code.
