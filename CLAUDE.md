# CLAUDE.md — Aphrodite

Hackathon entry for Perfect Corp's YouCam API Skin AI & Apparel VTO Hackathon.
`HACKATHON.md` is the charter and the skill activation marker; `hackathon/config.json`
is the machine contract every `hackathon-*` skill parses. Read both before changing
anything judged.

## Standing orders — these are not suggestions

1. **No live YouCam calls without explicit approval.** 584 units remain as of
   2026-08-10 and no endpoint exposes the balance, so a spent unit cannot be counted
   back. `YOUCAM_FIXTURES=1` is the committed default and costs nothing.
2. **Measured claims only.** Every number in the README, the submission copy, the UI
   or the video needs a row in `hackathon/CLAIM_PROOF_MAP.md` naming how it was
   measured. Unmeasured things say "not yet measured" out loud.
3. **Honest degradation over fabricated output.** A render that cannot run shows an
   honest empty state. Never present a captured fixture as a live call, and never
   credit an API with work it did not do.
4. **Verify before claiming done.** All four green, plus a real fixture run through
   the UI:
   ```bash
   npx tsc --noEmit && npm test && npm run lint && npm run build
   ```

## Environment

- Node 22 is **user-local** at `~/.local/node/bin` — there is no system Node on this
  box. Export the PATH before any npm command.
- `npm run dev` serves fixture mode at http://localhost:3000 at zero cost.
- The hosted instance is https://aphrodite.max-gutowski.de. `/healthz` reports state,
  not liveness, and needs no key.
- Access codes and secrets live in `/etc/aphrodite.env` on the VPS and in the
  operator's private notes. **Never commit a code** — this repo is public.

## Where things are

| Path | What |
|---|---|
| `lib/youcam/` | REST client for the Perfect Corp API — four-step contract, new work for this event |
| `lib/concierge/` | Orchestration: both engines, catalogue, occasion parsing |
| `components/Concierge.tsx` | The single client component the whole flow runs through |
| `hackathon/` | Charter docs, machine contract, review history |
| `submission/` | Devpost copy and the video script. `*.mp4` is gitignored on purpose |
| `deploy/` | Atomic symlink flip, fail-closed health gate, systemd unit, Caddy site |

## Vocabulary

`hackathon/VOCABULARY.md` is binding for the UI, the docs, the submission copy and
the video — including burned-in subtitles. Banned: camouflage, flawless, glowing,
perfect skin, flaws, simulated.

## Review history

`hackathon/reviews/` holds the adversarial panel runs. Read the newest before
proposing work — it is ranked by score-per-hour and says what to **cut**, not only
what to add. Current state: 002, 2026-08-10, Stage One FAIL, 30/50, Depth 3.5/10.
