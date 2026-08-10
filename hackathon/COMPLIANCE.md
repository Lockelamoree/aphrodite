# Compliance — Stage One, line by line

Checked 2026-08-10 against https://youcam-api.devpost.com/rules and the event page.
This is the eligibility screen, not the score: everything here is pass/fail, and a
brilliant entry that fails one row is not judged on the other four criteria.

**Submission period ends: 2026-08-17, 11:45 am Eastern Time.**

## Required by the organizer

| # | Requirement (as published) | State 2026-08-10 | What closes it |
|---|---|---|---|
| 1 | A working application integrating **at least one YouCam API** from the Skin or Fashion category | **PASS, now with evidence — and one new defect.** Three of the four APIs are proven live with committed receipts (Apparel VTO and Photo Lighting each returned a real render, hash-verified; Skin-Tone returned real detections). See `hackathon/receipts/`. The requirement says *at least one*, so this row passes. But the bundled wedding selfie fails Skin Analysis (`error_src_face_too_small`) and Skin-Tone (`error_face_angle_downward`) live, so **no single live run has traversed the whole chain** | a sample photo with a larger, frontal face; then one more units-on run to capture the complete chain |
| 2 | URL to a code repository — public with a licence, or private and shared with `contact_event@PerfectCorp.com` | **PASS** — `github.com/Lockelamoree/aphrodite`, public, MIT | — |
| 3 | Text description explaining features, functionality and **consumer/retail value** | **DRAFT, now link-complete** — `submission/devpost.md` carries the hosted URL, headline stats and a paste-ready testing field. Not yet pasted into Devpost | paste it into the Devpost form |
| 4 | **Screenshots** (a required field on the submission form) | **FAIL** — the only screenshots are six PNGs from 2026-07-26, outside the repo, showing a UI that no longer exists (pre-gate, pre-announcement-bar, pre-cycle-6) | re-capture from the corrected hosted build |
| 5 | Demo video, **1–3 minutes**, showing the project functioning on the intended device and **explaining which YouCam API is used** | **FAIL** — two competing unpublished cuts (87.2 s and 122.3 s). The 87 s cut is also unusable as-is: a banned word at ~0:52 and the pre-fix provenance ledger at ~0:30 | re-cut, then upload |
| 6 | Video **hosted on YouTube (preferred) or Vimeo**, public link provided | **FAIL** — nothing uploaded anywhere; `config.json` `submission.videoUrl` reads `UNKNOWN` | upload one canonical cut, paste the URL into Devpost *and* into `config.json` |
| 7 | Video contains **no unauthorised third-party trademarks or copyrighted material** | **PASS, needs a re-check on the new cut** — no music, own footage, own voiceover. Retailer names appear as catalogue text; re-verify on the re-cut | re-check after the re-cut |
| 8 | **Testing access**: a website link, functioning demo or test build, free of charge through the end of the submission period | **PASS** — https://aphrodite.max-gutowski.de, keyless, zero units, no signup. It must stay up through judging | keep the VPS and the systemd unit alive; do not let the spend caps take the site down |
| 9 | **Login credentials supplied if the site is private** | **OPEN, and this is the one that bites.** The public path needs no credentials, but the paths a judge would want to see — live YouCam, the LLM engine — need a role code that is published nowhere, and the product links `/unlock` zero times | judge code into the Devpost *Testing instructions* field; a visible `/unlock` link in the product header |
| 10 | Agreement to an exit interview and a blog feature if selected | **operator action** — a checkbox on the form | tick it when submitting |
| 11 | Eligibility: legal age of majority, not resident in a sanctioned country, no conflict of interest | **PASS** — Germany, no relationship to Perfect Corp | — |

## This project's own kill gate

Stricter than the organizer's on purpose. Review 002 verdict, 2026-08-10:

| Gate | Verdict |
|---|---|
| 1 — combined track: a Skin API **and** Apparel VTO in one run | **PASS**, cleanly, ~4.4 s end to end |
| 2 — provable YouCam use at judging time | **PARTLY CLOSED 2026-08-10.** A committed receipt now exists with real Perfect Corp `task_id`s and hash-verified renders for three of the four APIs (`hackathon/receipts/`). Still open: nothing on a *reachable path* calls YouCam, `/api/dev/verify` still 404s in production, and the chain has never completed live because the bundled sample fails both analysis steps |
| 3 — judge-testable without a rebuild | **FAIL** on the third leg only: hosted and keyless works, but the role code is unreachable through the submission |
| 4 — public repo + MIT + README chapter + video under 180 s | **FAIL** on the video alone |
| 5 — no fabricated render presented as live | **BREACHED AT THE CLAIM LAYER**: the render layer is clean, but the hero stat block claims four fired APIs in demo mode where zero are called |

## Corrections to the machine contract, from reading the rules today

- The four criteria are published as **equally weighted**. `config.json` said no
  weights were published; that was too pessimistic. Weight 1 each was already the
  working assumption, so no score changes — but the note was wrong and is fixed.
- **Screenshots are a required submission field**, not a nice-to-have. They were
  carried as "done" in `HACKATHON.md` on the strength of stale files outside the repo.
- Video hosts are constrained: **YouTube (preferred) or Vimeo** — the event page also
  lists Youku. A self-hosted file on the VPS would not satisfy the requirement.
- Submissions pass a **baseline viability screen** before criteria are applied, which
  is exactly what the internal Stage-One gate models.

## Still unknown

The hackathon's **start date** could not be established from either page with
confidence, and the **internal weighting between the four criteria beyond "equal"** is
not published. Neither affects any decision here, and neither will be guessed at.
