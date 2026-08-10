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
| 4 | **Screenshots** (a required field on the submission form) | **PASS** — nine stills captured 2026-08-10 from a production build of the corrected code, committed at `submission/screenshots/` with a note on what each one proves. The stale 2026-07-26 PNGs are superseded | upload them with the entry |
| 5 | Demo video, **1–3 minutes**, showing the project functioning on the intended device and **explaining which YouCam API is used** | **PASS on the artifact** — recut 2026-08-10: `submission/aphrodite-demo-2026-08-10.mp4`, **88 s**, inside the window, from a production build, every caption anchored to the panel it describes and each YouCam API named as it appears. The two older cuts are archived as do-not-publish. Caveat: **captions, no voiceover** — no TTS on this machine | nothing, unless a spoken track is wanted |
| 6 | Video **hosted on YouTube (preferred) or Vimeo**, public link provided | **FAIL — the last hard blocker.** The cut exists and is compliant; nothing is uploaded, and only the operator can upload it | upload `submission/aphrodite-demo-2026-08-10.mp4`, paste the URL into Devpost *and* into `config.json` |
| 7 | Video contains **no unauthorised third-party trademarks or copyrighted material** | **PASS** — checked on the 2026-08-10 cut: no music, no audio track at all, own screen footage. Retailer names appear only as this project's own fictional catalogue text ("The Aphrodite Edit"). Sample and catalogue photography is Unsplash-licensed | — |
| 8 | **Testing access**: a website link, functioning demo or test build, free of charge through the end of the submission period | **PASS** — https://aphrodite.max-gutowski.de, keyless, zero units, no signup. It must stay up through judging | keep the VPS and the systemd unit alive; do not let the spend caps take the site down |
| 9 | **Login credentials supplied if the site is private** | **HALF CLOSED.** The product now links the gate — `Have an access code?` in the header, `/unlock` — and `submission/devpost.md` carries a paste-ready testing field with the redemption steps. Still open: the code itself only reaches a judge when the entry is actually submitted | paste the judge code into the Devpost *Testing instructions* field |
| 10 | Agreement to an exit interview and a blog feature if selected | **operator action** — a checkbox on the form | tick it when submitting |
| 11 | Eligibility: legal age of majority, not resident in a sanctioned country, no conflict of interest | **PASS** — Germany, no relationship to Perfect Corp | — |

## This project's own kill gate

Stricter than the organizer's on purpose. Review 002 verdict, 2026-08-10:

| Gate | Verdict |
|---|---|
| 1 — combined track: a Skin API **and** Apparel VTO in one run | **PASS**, cleanly, ~4.4 s end to end |
| 2 — provable YouCam use at judging time | **PARTLY CLOSED 2026-08-10.** A committed receipt now exists with real Perfect Corp `task_id`s and hash-verified renders for three of the four APIs (`hackathon/receipts/`). Still open: nothing on a *reachable path* calls YouCam, `/api/dev/verify` still 404s in production, and the chain has never completed live because the bundled sample fails both analysis steps |
| 3 — judge-testable without a rebuild | **PRODUCT SIDE CLOSED 2026-08-10** — the header links `/unlock` and the submission copy names the hosted URL and the redemption steps. The remaining leg is the submission itself existing |
| 4 — public repo + MIT + README chapter + video under 180 s | **FAIL** on the video alone |
| 5 — no fabricated render presented as live | **CLOSED 2026-08-10, and two further fabrications were found and removed in the process.** The hero stat block is gated on demo mode. The before/after labels no longer sit on the wrong halves. The warm sample's "AR overlay" was a **different person's face** and is deleted — that comparator asserted the API had altered someone's features. And the wedding preset bundled **two different men** as one user, so one man's skin read sat beside the other's try-on render; the preset is now one person, whose colour read and apparel render are both genuinely his own |

## What the live API accepts as a face — measured, not assumed

Five images were screened against `skin-tone-analysis` on 2026-08-10 (one unit each).
The results do not match what the error strings suggest, and this governs any future
attempt to close gate 2:

| Image | Verdict |
|---|---|
| `samples/full-body.jpg` — whole body, small distant face | **accepted** |
| `samples/selfie.jpg` — tight frontal headshot | rejected, `error_face_angle_downward` |
| `samples/selfie-2.jpg` — three-quarter portrait | rejected, `error_face_not_forward_facing` (but **accepted** by skin analysis) |
| A frontal eye-level headshot, 900×900 | rejected, `error_face_position_too_small` |
| The same headshot at 2000×2500 with generous margin | rejected, identically |

So the only image that passed is the one with the *smallest* face, and resolution and
margin changed nothing. The API is deterministic — the same image always draws the same
error — but "a bigger, more frontal face" is demonstrably not the criterion. Picking a
sample that satisfies both analysis endpoints is therefore trial and error at one unit
per attempt, and that cost belongs in any plan to close gate 2.

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
