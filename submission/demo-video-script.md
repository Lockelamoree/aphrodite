# Aphrodite — demo video shot-script

> **Superseded by a reproducible pipeline on 2026-08-12.** The reel is no longer hand-cut:
>
> - **Narration** lives in `submission/narration.txt`, one line per beat.
> - **Footage** is recorded by `scripts/record-demo.mjs`, one frame directory per beat,
>   driving the real app in demo mode at zero units.
> - **The cut** is assembled by `scripts/build-demo-video.mjs`: it synthesises each line
>   with Piper, then holds that beat's footage for exactly as long as the line takes.
>
> So the narration is the clock. Re-wording a line re-times the cut with no re-recording,
> and `VOICE_MODEL=…onnx` re-voices the whole reel without touching a caption by hand.
>
> ```bash
> npm run build && YOUCAM_FIXTURES=1 PORT=3317 APHRODITE_LIVE_CODES=judge:CODE \
>   APHRODITE_AUTH_SECRET=secret npm start &
> APHRODITE_SHOT_CODE=CODE node scripts/record-demo.mjs http://localhost:3317 /tmp/footage
> PIPER=/path/to/venv/bin/python VOICE_MODEL=/path/to/en_US-hfc_female-medium.onnx \
>   node scripts/build-demo-video.mjs /tmp/footage submission/aphrodite-demo-2026-08-12-voiced.mp4
> ```
>
> **Current cut:** `submission/aphrodite-demo-2026-08-12-voiced.mp4`, 88.4 s, 1280×800,
> spoken narration (`en_US-hfc_female-medium`, local, no text leaves the machine) with
> burned captions in the same words.
>
> **Two things this pipeline fixed, both found by watching the output:**
>
> 1. The first build recorded each sample run *inside* the beat that described its
>    result. A beat is trimmed to the length of its narration, from the front, so the
>    footage that survived showed the form filling in while the voice described a render
>    further down the page. The run is now driven before recording starts.
> 2. Beat 4 scrolled to the wrong panel: its anchor text `Your outfit` also appears in
>    the basket blurb ("your outfit is rendered on you with YouCam AI"), so the try-on
>    beat framed the shopping list. Anchors are now unique strings.
>
> Both are the same class of defect as the captions this project has caught before —
> words describing something that is not on screen — and neither is visible from the
> code.
>
> **Do not publish** the captions-only cut of 2026-08-10 or anything under
> `submission/archive-old-cuts/`: one carries a banned word in a burned-in subtitle at
> ~0:52 and a retired provenance ledger at ~0:30, the other predates the access gate.

The original hand-cut plan follows, kept because its beat structure is still the shape
of the reel.

> The Devpost rule: a 1–3 min video that shows **YouCam API integration** + on-device
> (app-running) footage. Record in **demo mode** (`YOUCAM_FIXTURES=1`) so it costs
> **zero units** and can't flake — the UI already labels itself "demo mode · sample
> renders," which keeps the reel honest. Use the **WARM "Wedding · full-body" sample**
> only: it renders end-to-end (skin overlay + outfit VTO + lighting). Avoid the cool
> selfie-only sample on camera (it intentionally shows honest empty states), and avoid
> the hair/color/makeup studio taps unless you've captured those fixtures first.

## Setup before recording
- `cp .env.example .env.local` (demo mode already on) · `npm run dev` · full-screen the browser at 1280×800.
- Clear any saved runway first (so "Save" → "check-in" is a clean arc), then re-save mid-reel for Beat 5.
- Optional captions: `ffmpeg` screen capture + `faster-whisper` for burned-in subtitles.

## The 5 beats

**Beat 0 — Hook + product on screen (0:00–0:20).**
On camera: Aphrodite loaded. Type/pick the occasion ("An evening wedding in 3 weeks"), click the **"Wedding · full-body"** sample, tick the consent box, click **Build my look.**
VO: *"Before a big occasion I want three things from one selfie — what to do with my skin, what to wear for my coloring, and where to buy it. Aphrodite answers all three with YouCam AI."*

**Beat 1 — The read (0:20–1:00).** *Fuse point #1: Skin AI.*
On camera: the stream fills in — **Skin Analysis** scores appear; drag the before/after slider on the AR overlay ("what YouCam sees"). Then **undertone + palette** from Skin-Tone / Color analysis.
VO: *"YouCam Skin Analysis scores ten concerns zero-to-a-hundred — it focuses the lowest. Its color read gives my undertone and a palette."*
Stills: `S1` skin scores + overlay mid-drag · `S2` undertone + palette.

**Beat 2 — Plan + try-on (1:00–1:40).** *Fuse point #2: Apparel VTO on the same person.*
On camera: the **countdown** timed to the day (call out that a 3-week plan front-loads actives and tapers vs. a day-of plan). Then the **Apparel Try-On** — the outfit rendered on the sample — and the **AI Photo Lighting** finish.
VO: *"The prep countdown changes with how far off the day is. Then the outfit is rendered on me — not just described — and a lighting pass finishes the shot."*
Stills: `S3` countdown · `S4` outfit rendered on model · `S5` lighting before/after.

**Beat 3 — One shoppable board + provenance (1:40–2:15).**
On camera: scroll the **look board** — one priced, cross-category basket (skincare + garment + accessories); hover the **provenance ledger** showing which YouCam API produced each result; tap **Refine → reroll / cooler** to show the outfit restyle live.
VO: *"Everything lands in one basket, and a ledger names exactly which YouCam API produced each piece. I can restyle on the fly."*
Stills: `S6` basket + ledger · `S7` a refined outfit.

**Beat 4 — It remembers (2:15–2:40).**
On camera: **Save** the plan → reload to show the "Welcome back … no photo stored" band → **glow check-in** showing score deltas vs. the saved run.
VO: *"I can save an image-free plan — no photo or raw data kept — and check back in to see my skin tracking against the baseline."*
Stills: `S8` saved-runway band ("no photo stored") · `S9` check-in deltas.

**Beat 5 — Two engines + close (2:40–2:50).**
On camera: the **Agentic / Guided** toggle + brain badge; end on the board.
VO: *"Same experience whether an LLM orchestrates the APIs or a rule engine does — it runs on a YouCam key alone. That's Aphrodite: Skin AI and try-on, fused into one occasion."*
Still: `S10` engine toggle + badge.

## Stills checklist (grab from the same run)
S1 skin+overlay · S2 palette · S3 countdown · S4 VTO on model · S5 lighting · S6 basket+ledger · S7 refine · S8 saved band · S9 check-in delta · S10 engine toggle.
→ 4–5 of these double as the Devpost screenshot gallery (S1, S4, S6, S9 are the strongest).

## Claim discipline (say / don't say)
- ✅ "rendered on me," "scores 0–100," "which API produced each result," "runs with zero units in demo."
- ⚠️ Say "demo mode · sample renders" once, on camera, so the captured-vs-live line is explicit.
- ❌ Don't cite conversion/return-rate numbers (no source in-repo). Don't claim the studio hair/makeup try-ons render in demo (they need a captured fixture or a live key).
