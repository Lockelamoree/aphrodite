# Aphrodite — demo video shot-script (target ≤ 2:50)

> **Recorded 2026-08-10 → `submission/aphrodite-demo-2026-08-10.mp4`, 88 s, 1280×932.**
> Cut from a production build in demo mode, zero YouCam units. What shipped differs
> from the plan below in three ways, all deliberate:
>
> 1. **Captions, no voiceover.** The TTS environment the earlier takes used
>    (`edge-tts`) no longer exists on this machine, so the narration lines are burned in
>    as on-screen captions instead of spoken. The Devpost rule requires the video to
>    show the product working and name the YouCam API used — captions do both — but a
>    spoken track would score better on presentation. Re-recording the audio needs only
>    a TTS and the lines below.
> 2. **Two segments, because honesty forces it.** The wedding path carries the fused
>    chain and the Apparel VTO render. The selfie-only path carries the *captured* skin
>    overlay — the only mask in the repo taken from the face it is shown beside — plus
>    the honest empty state where a render would otherwise be invented.
> 3. **No comparator on the wedding path.** Its mask was a different person's face and
>    was removed; see `lib/youcam/fixtures.ts`.
>
> Every caption is anchored to the element it describes. An earlier cut captioned "the
> outfit is rendered on the body" over the basket list, which is exactly the kind of
> small lie this project refuses elsewhere.
>
> **Two older cuts are archived, not published:** `submission/archive-old-cuts/`. The
> 87 s cut carries a banned word in its burned-in subtitle at ~0:52 and a pre-fix
> provenance ledger at ~0:30; the 122 s cut predates the gate entirely. Neither may be
> uploaded.


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
