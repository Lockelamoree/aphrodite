# Screenshot gallery

Captured 2026-08-10 from a **production build** of `main` in demo mode
(`YOUCAM_FIXTURES=1`), driven headlessly at 1440×900 on a 2× display and downscaled to
1600 px wide. Zero YouCam units were spent taking them.

They replace the six PNGs from 2026-07-26 that lived outside the repo and showed a UI
that no longer exists — pre-gate, pre-announcement-bar, pre-cycle-6. Screenshots are a
required Devpost submission field, and stale ones are worse than none.

| File | What it shows | Why it earns a slot |
|---|---|---|
| `01-landing.png` → `.jpg` | The landing a judge arrives at | The honesty banner is in the first viewport; the hero pairs a real photo with the YouCam render **of that photo**; `Have an access code?` is reachable |
| `02-apparel-vto.jpg` | The Apparel Try-On result beside the source photo | The strongest single frame: same person, same wall, same light — the render cannot be mistaken for a stock pair |
| `03-skin-scores.jpg` | The 0–100 skin read, lowest first | Scores are framed as priority areas, never as defects |
| `04-colour-palette.jpg` | Undertone and palette | Derived from the colour hex the API actually detected on this photo |
| `05-countdown.jpg` | The skincare countdown | Differs in *kind* by how far off the date is — three weeks front-loads actives, a day out stops them |
| `06-priced-basket.jpg` | One cross-category priced basket | The retail case, on screen rather than asserted |
| `07-provenance-ledger.jpg` | The provenance ledger | Names each API and states plainly that nothing was called just now |
| `08-skin-overlay-captured.jpg` | The comparator with a **captured** YouCam mask, next to an honest empty state | Both halves are the same photo; the outfit panel says "add a full-body photo" instead of inventing a render. The ledger above reads "2 Perfect Corp APIs" on this path, not 4 |
| `10-judge-unlock.jpg` | The `/unlock` gate | Where a judge redeems the code from the Devpost testing field |

There is no `09`: the honest-empty-state shot came out byte-identical to `08` — both
panels sit in the same viewport — so it was dropped rather than shipped as filler.

## Reproducing

The capture rig is `scripts/` in the repo root plus a headless Chrome driver; it needs
no dependencies beyond a Chromium binary. Start the app (`npm run build && npm start`
with `YOUCAM_FIXTURES=1`) and drive it — every panel above is reachable from the two
bundled samples with no keys.
