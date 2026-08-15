# Aphrodite — demo reel

The reel is not hand-cut. Three files are the whole source of truth:

| File | Holds |
|---|---|
| `submission/narration.txt` | the spoken script, one line per beat, grouped into five acts |
| `submission/edl.json` | the camera move for each beat — peak zoom and focus point |
| `scripts/record-demo.mjs` | what each beat *shows*, driving the real app at zero units |
| `scripts/build-demo-video.mjs` | the cut: synthesise, hold footage to the voice, dissolve, deliver |

**The narration is the clock.** Each line is synthesised first and its footage is then held
for exactly that long, freezing on the last frame if the footage runs short. So rewording a
line re-times the cut with no re-recording, and changing the voice re-voices the whole reel
without touching a caption or a timing by hand.

```bash
# a local instance of the SAME commit, fixtures forced, live-run budget matched to the host
npm run build
YOUCAM_FIXTURES=1 PORT=3317 APHRODITE_LIVE_CODES=judge:<code> \
  APHRODITE_AUTH_SECRET=<secret> APHRODITE_LIVE_RUN_BUDGET=8 npm start &

# footage
APHRODITE_SHOT_CODE=<judge code> \
  node scripts/record-demo.mjs http://localhost:3317 ~/aphrodite-footage
# ONLY=b11-honest-limit re-shoots one beat; board beats drive the wedding run themselves

# cut
TTS_PROVIDER=openai TTS_VOICE=marin \
  node scripts/build-demo-video.mjs ~/aphrodite-footage submission/aphrodite-demo-<date>.mp4
```

> **Why local and not the deployed host.** On 2026-08-15 the deployed `live_runs_used`
> moved 0 → 2 while footage was being recorded, and each increment coincided with a sample
> run that timed out at 60 s — the shape of a live call (~90 s), not a fixture run (~4.5 s).
> The operator confirmed a different session was spending. Either way, footage is not worth
> a unit, so `drive()` and the `b04-run` submit both call `assertRunAllowed()`, which throws
> unless the base is localhost or `APHRODITE_ALLOW_REMOTE_RUNS=1` is set deliberately. The
> frames are identical: the served fixtures are byte-identical to the committed receipts,
> and `APHRODITE_LIVE_RUN_BUDGET=8` makes even the budget figure inside
> `/api/dev/verify` match what a judge curling production sees.

Delivery: **1920×1080 at 30 fps**, cross-dissolved, burned captions carrying the spoken
words verbatim, audio normalised to −14 LUFS, a 2 s title card and a 3.6 s end card
holding the live URL. Target runtime ~2:45 against the event's 3:00 cap.

## The five acts

| Act | Window | What it has to do |
|---|---|---|
| 1 — Why | 0:00–0:24 | The three questions nobody answers in one place. Product on screen by 0:20. |
| 2 — The loop | 0:24–0:58 | Occasion, one selfie, the cut question, and the board arriving. |
| 3 — Highlights | 0:58–1:52 | The fused chain where it is real — and the one place it is not. |
| 4 — The self-catch | 1:52–2:24 | It refuses a render it cannot back. The ledger and the receipts. |
| 5 — Built, and close | 2:24–2:50 | Two engines on one stream, the tests, the live URL. |

Act 3 ends on `b11-honest-limit` and act 4 is built around `b12-refuse` on purpose. A demo
that agrees with an easy correct case proves the engine runs; one that visibly declines to
render a person it has no captured render for proves it discriminates. The second is what a
skeptical judge scores, and it is the only kind of moment a competitor cannot fake.

## Claim discipline

Every number spoken has a row in `hackathon/CLAIM_PROOF_MAP.md`. The vocabulary law in
`hackathon/VOCABULARY.md` binds the voiceover **and** the burned-in captions.

Three lines were written, checked, and corrected before a single frame was recorded, because
each was false in a way only measurement catches:

- *"that reading is what chooses the garment"* — the old `b3`, and review 003 was right to
  kill it. On the wedding path `slate-suit` is `flatters: "cool"` (`catalog.ts:100`) against a
  warm live read, undertone scores **2** against formality's **4** (`deterministic.ts:369-374`),
  and the masculine cut filter leaves **one** of eleven garments standing. The reading is
  arithmetically incapable of choosing there. `b10` now makes the causal claim only for the
  second face, where nine feminine cuts give it room, and `b11` states the limit outright.
- *"the screen says as much"* — it did not, when written. `garmentColorClause` returns `""`
  on a mismatch (`deterministic.ts:445-453`), so the companion line reads only *"right for a
  wedding"*. A draft of `b11` therefore called the screen **silent** — and then commit
  `1f1b88a` landed the *"Why this garment"* panel, which ranks the three factors and states
  *"YouCam undertone · outweighed — warm does NOT match this piece (flatters cool)"*. That
  made the silence line false in the other direction. `b11` now frames and quotes that panel.
  If the panel is ever removed, `b11` becomes a lie — the warning lives in `narration.txt`.
- *"four YouCam APIs in one run, about four and a half seconds"* — the 4.5 s is the demo-mode
  fixture loop; a live run takes roughly ninety. `b04` now attributes the number to demo mode
  in the same breath.

Nine feminine, one masculine, one neutral: eleven garments, counted from `GARMENT_CATALOG`
and cross-checked against `/healthz`'s `garments: 11`. An earlier grep said ten feminine and
was wrong.

## Voice

`TTS_PROVIDER=openai` (default) uses `gpt-4o-mini-tts`. The delivery brief lives in
`TTS_INSTRUCTIONS` in the build script rather than in whoever ran the build, because a
steerable voice is only reproducible if the steering is in version control. Lines are cached
against their own text, so editing one line re-synthesises one line.

> **The narration is no longer local.** The previous cut used Piper and this file used to say
> no text left the machine. With the OpenAI provider the narration lines are sent to OpenAI.
> They are submission copy, not private data, so the trade is deliberate — but the old
> sentence had to go rather than sit here being false. `TTS_PROVIDER=piper` is still the
> offline path; the voice model is at `~/aphrodite-tts/voices/`, moved out of a `/tmp`
> scratchpad where it had been the single point of failure for a promise of reproducibility.

Free voice tiers were considered and rejected: they grant no commercial rights and require
attribution, which is a rights defect in the one artifact the judges actually watch. A
metered API call costing cents is the cheaper option, not the more expensive one.

## Do not publish

`submission/archive-old-cuts/` and the captions-only cut of 2026-08-10. One of them carries a
banned word in a burned-in subtitle, which no re-dub can fix, and a retired provenance ledger
showing four green ticks during a fixture run. The 2026-08-12 voiced cut is superseded by this
one and also carries the two false narration lines above.

## Defects this pipeline has caught, kept here so they are not re-introduced

1. A run recorded *inside* the beat that described its result. Beats are trimmed from the
   front, so what survived was a form filling in while the voice described a render further
   down the page. Runs are now driven before recording — except `b04-run`, whose line is
   about watching it work, so it records the stream deliberately.
2. `b4` scrolled to the wrong panel: its anchor `Your outfit` also appears in the basket
   blurb. Anchors must be unique strings.
3. One-frame beats. Chrome's screencast only emits on repaint, so a beat that scrolled once
   and then waited produced a still — `b3-colour` was **one frame held for nine seconds**.
   Every beat now glides for its full length, and the build warns on any beat under 20 frames.
4. Never drive a run after unlocking. An unlocked session leaves demo mode and a run outside
   demo mode spends real units, so the judge beat is recorded last and nothing follows it.
5. `scroll-behavior: smooth` in `app/globals.css:72` turned every per-frame `scrollTo` into
   its own animation. Sixty competing animations a second meant the page drifted
   continuously but never arrived, so beats framed the panel *after* the one being
   narrated — while still producing plenty of frames, which is exactly why frame counts
   never exposed it. `glide()` now disables the CSS easing for its duration.
6. The judge access code must never be on camera. The unlock form shows it in the input, so
   the unlock happens *before* `record()` starts and only the endpoint response is filmed.
   A public video that shows the code hands the remaining unit budget to anyone who pauses.
7. Anchors must fail loudly, never fall back. A `.catch()` chain on the refusal beat framed
   the colour palette and the studio tiles while the voice described a refusal.
