# Rubric

The four criteria are **verbatim from the Devpost page**. Earlier sessions worked
from a guessed rubric; that guess was corrected on 2026-08-09. No weights are
published by the organizer, so every criterion carries weight 1 on a 10-point
scale — total 50. The anchors below are this project's own, derived from the
verbatim wording, and are what the `hackathon-judge` panel scores against.

## 1. Technological Implementation

> "How thoroughly and skillfully does the project integrate at least one YouCam API
> from the Skin/Fashion category? Does the project demonstrate clear consumer or
> retail value? Does the code reflect genuine effort and a working, non-trivial
> implementation?"

| Band | Anchor |
|---|---|
| 9–10 | Several YouCam APIs chained so each one's output feeds the next; failures degrade honestly; the integration is **provable from the running product**, not only from the code |
| 5–6 | One or two APIs called correctly and in isolation |
| 1–3 | An API is called once and its result decorates a static page |

**Pinned clause:** retail value is scored *here*, not only under Potential Impact.
The priced basket, the cross-category mix and the return-confidence framing are
judged artifacts, not decoration — they must stay visible on screen.

## 2. Design

> "Does the project deliver a complete, coherent product experience — not just a
> technical proof of concept?"

| Band | Anchor |
|---|---|
| 9–10 | Reads as a finished product: one clear path, coherent typography and colour, real empty and error states, works at 320 px and at 200 % text zoom, keyboard reachable |
| 5–6 | Attractive on the happy path, thin at the edges |
| 1–3 | A form and a results dump |

## 3. Potential Impact

> "Does the project make a credible, specific case for solving a real problem for a
> real audience — and does the solution actually address that problem based on
> what's demonstrated?"

| Band | Anchor |
|---|---|
| 9–10 | A named audience with a dated need, and a credible commercial story — priced basket, return confidence, a first-party signal a retailer would want |
| 5–6 | A plausible audience asserted but not evidenced |
| 1–3 | A demo looking for a problem |

## 4. Quality of the Idea

> "Is this a creative, non-obvious use of at least one Perfect Corp. YouCam API from
> the Skin or Fashion category — and does the team demonstrate genuine understanding
> of the problem space they're working in?"

| Band | Anchor |
|---|---|
| 9–10 | Non-obvious API use that only makes sense once you understand the problem; the LLM does planning the APIs cannot do alone |
| 5–6 | A sensible but expected use of the APIs |
| 1–3 | The API demo with a new colour scheme |

## Special category — Skin AI and Apparel VTO as one experience

Not one of the four scored criteria, and treated as the **working tiebreaker**
because it is the only thing the event singles out.

| Band | Anchor |
|---|---|
| 9–10 | The skin reading visibly determines the garment and the countdown, and the judge sees that chain happen on screen in one run |
| 5–6 | Both capabilities are present on one page but do not visibly inform each other |
| 1–3 | Two separate features behind two separate buttons |

## The fifth, unofficial criterion

`hackathon-judge` also scores **Submission Depth & Presentation** out of 10,
separately and never folded into the /50. It is winner-derived rather than
published: across studied award-winning submissions the decisive variable was
whether the work converted its depth into proof a skimming, skeptical judge could
verify in minutes. It is scored because it predicts placement, not because Perfect
Corp asked for it.

## Who judges

**No individuals are named.** Verified on the Devpost page 2026-08-09: the panel is
listed as one group, "YouCam API Team", with no titles, backgrounds or criterion
weights. `hackathon/config.json` therefore models that single real entity as one
lens per published criterion, each lens's wins and loses derived from that
criterion's own wording. **Those are criterion lenses, not people, and must never be
presented as researched judge intel.** That is also why `JUDGE_DOSSIER.md` does not
exist — there is nothing to put in it that would not be invented.

## Score history

| Review | Date | Stage One | Official | Depth & Presentation |
|---|---|---|---|---|
| 001 baseline | 2026-08-09 | FAIL (gates 2, 3, 4) | 26/50 | 3/10 |
| 002 post-deploy | 2026-08-10 | FAIL (gates 2, 3, 4; gate 5 breached at the claim layer) | 30/50 | 3.5/10 |
