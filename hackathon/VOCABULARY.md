# Vocabulary law

Extracted 2026-08-10 from `hackathon/config.json` `vocabulary`, which stays the
machine-readable source. This file exists so the rule is reviewable by a human and
citable in a diff.

The subject is skin. Words that grade a face as defective are out — not because a
judge is watching, but because the product would be worse with them in.

## Use

`priority area` · `health score` · `rendered on you` · `captured fixture` ·
`honest empty state` · `priced basket`

## Ban

`camouflage` · `flawless` · `glowing` · `perfect skin` · `flaws` · `simulated`

## Reframes

| Not this | This |
|---|---|
| hide your flaws | the areas YouCam scored lowest, and what to do about them before the date |
| AI-generated look | rendered on your own photo by the YouCam API |
| we simulate the result | every image is a real render; in demo mode they are captured samples and the page says so |

## Glossary — spell these consistently

Aphrodite · YouCam · Perfect Corp · Apparel VTO · AI-Cloth · look board ·
occasion concierge · skincare countdown · undertone · look-VTO · provenance ledger

## Scope — where the law applies

Product UI, `README.md`, `submission/devpost.md`, the demo video (**voiceover *and*
burned-in subtitles**), and this repo's own charter documents. Review 002 checked
`README.md`, `submission/devpost.md` and `components/Concierge.tsx` against the ban
list and found **zero** violations.

## Live violations

| Where | Hit | State |
|---|---|---|
| `HACKATHON.md:30` | `simulated` — in the phrase "nothing simulated", a negation, but a hit and a dropped reframe | **fixed 2026-08-10** — replaced with the reframe wording |
| `submission/aphrodite-demo.mp4` ~0:52 | `glowing` — "so you show up glowing", in the voiceover **and** the burned-in subtitle | **open.** Flagged by review 001 on 2026-08-09 with an explicit re-dub instruction and unchanged since. Burned-in text means it cannot be fixed by re-dubbing audio alone — the frame has to be re-rendered |

## Also banned in practice

Not word-level, but the same law:

- **No fear-first opening.** The pitch starts from a dated event and a plan, never
  from what is wrong with someone's face. Review 002 checked and found no fear pitch.
- **No credit for work not done.** "Powered by 4 Perfect Corp APIs" on a page where
  zero were called is a vocabulary violation at the sentence level even though every
  word in it is allowed. This is the open defect in `components/Concierge.tsx`.
