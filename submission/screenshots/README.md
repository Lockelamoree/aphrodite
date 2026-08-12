# Screenshot gallery

Captured **2026-08-12** (second pass, after two approved units-on captures) from a **production build** in demo mode (`YOUCAM_FIXTURES=1`,
access gate configured), driven headlessly at 1440×900 on a 2× display. Zero YouCam
units were spent taking them.

Reproduce with the rig committed beside the app — no dependencies beyond a Chromium
binary, which it finds in Playwright's cache or on the system:

```bash
npm run build
YOUCAM_FIXTURES=1 PORT=3313 APHRODITE_LIVE_CODES=judge:SOME-CODE \
  APHRODITE_AUTH_SECRET=any-secret npm start &
node scripts/capture-screenshots.mjs http://localhost:3313 submission/screenshots
ONLY=05 node scripts/capture-screenshots.mjs http://localhost:3313 submission/screenshots  # one frame
```

The gate env vars matter: without them `/unlock` truthfully reports that no gate is
configured, which is not what a judge meets on the hosted instance.

## Why this is the third gallery

1. Six PNGs from **2026-07-26**, outside the repo, showing a pre-gate UI. Stale.
2. Nine stills from **2026-08-10**. Superseded because `05-countdown.jpg` used the
   board's editorial hero, and that hero was `finish.jpg` — **a photograph of a man who
   appears in none of the samples**, captioned "Occasion lighting · rendered by YouCam
   AI" beside a narrative about a different person's suit. The frame asserted the API
   had relit a face it never saw. Found by looking at the file, not by reading code.
3. This one, taken after the render fixtures were keyed to the person they depict **and**
   after two approved live tasks filled the two gaps that keying exposed: a relight of the
   wedding sample (`receipts/002`) and a try-on for the second face (`receipts/003`).

| File | What it shows | Why it earns a slot |
|---|---|---|
| `01-landing.jpg` | The landing a judge arrives at | Honesty banner in the first viewport, `Have an access code?` reachable, the hero pairs a real photo with the YouCam render **of that photo** |
| `02-apparel-vto.jpg` | The hero comparator | Same person, same wall, same light — it cannot be mistaken for a stock pair |
| `03-skin-scores.jpg` | The 0–100 skin read, lowest first | Scores framed as priority areas, never as defects |
| `04-colour-palette.jpg` | Undertone and palette | Derived from the colour hex the API actually detected on this photo (`#b7947d`) |
| `05-countdown.jpg` | The look board | The hero is the **YouCam relight of the photo in the run** — captured live on 2026-08-12, receipt `hackathon/receipts/002`. The countdown differs in *kind* by how far off the date is |
| `06-priced-basket.jpg` | One cross-category priced basket | The retail case on screen rather than asserted |
| `07-provenance-ledger.jpg` | The provenance ledger | Reads "**4** Perfect Corp APIs produced these samples. Nothing was called just now." All four, each backed by a committed receipt — and it still says plainly that nothing was called during this run |
| `08-render-pair.jpg` | The try-on panel | The render, captioned with the API that made it |
| `09-skin-overlay-captured.jpg` | The comparator with a **captured** YouCam mask | Both halves are the same photo — this face's own dark-circle mask from a real run |
| `10-judge-unlock.jpg` | The `/unlock` gate | Where a judge redeems the Devpost code, and where the run budget is stated before they spend it |
