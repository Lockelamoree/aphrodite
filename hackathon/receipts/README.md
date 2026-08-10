# Live-run receipts

Captured 2026-08-10 with explicit operator approval, against `main` @ `bc1ef29`.
These are the provider's own answers — real Perfect Corp `task_id`s, the full poll
envelopes including the failures, and sha256 hashes of the images YouCam returned.
Nothing here is synthesised, and nothing that failed has been quietly dropped.

**Cost: 7 tasks, ~7 of the 584 remaining units.** Four succeeded, three returned
provider errors. What each of those errors means is the point of this file.

Reproduce with `scripts/capture-receipt.test.ts` — it is deliberately unreachable
from `npm test` and self-skips without `APHRODITE_CAPTURE_RECEIPT=1`.

## What is now proven

| Step | API | Input | Result |
|---|---|---|---|
| Apparel VTO | `/s2s/v2.0/task/cloth-v3` | `samples/full-body.jpg` + the Slate Blue Three-Piece Suit reference | **success** — a real render, 222,607 bytes, `sha256 27c9d899f431ddf6…`, 14.7 s |
| Photo Lighting | `/s2s/v2.0/task/lighting` | `samples/selfie.jpg` | **success** — a real render, 126,542 bytes, `sha256 44cd13b0…`, 3.6 s. Bytes committed as `001/photo_lighting.render.jpg` and re-verified against the hash after download |
| Skin-Tone / Facial Color | `/s2s/v2.0/task/skin-tone-analysis` | `samples/full-body.jpg` | **success** — real detections: `skin_color #b7947d`, `hair_color #B56637` ("Auburn"), `face_quality` all "good", 7.0 s |

The four-step client contract is therefore confirmed end to end against the live API:
presigned-PUT upload → flat-body `runTask` → poll to `task_status` → results. Every
`task_id` in these files is a real one and can be cross-checked against the Perfect
Corp account record.

## What the failures actually say

### The bundled wedding sample cannot be analysed live — a real product finding

`public/samples/selfie.jpg` is the selfie the *"Wedding · full-body"* preset sends,
and it is the first thing a judge clicks. Live, it fails **both** analysis steps:

| Step | Provider error |
|---|---|
| Skin Analysis | `error_src_face_too_small` — "The face area in the uploaded image is too small" |
| Skin-Tone / Facial Color | `error_face_angle_downward` |

Fixtures hide this completely: `YOUCAM_FIXTURES=1` returns canned scores for that
image, so the demo looks perfect while the same click with units on returns nothing.
The colour step *does* succeed on `samples/full-body.jpg` (see above), so the API is
fine — the shipped sample photo is not suitable for face analysis.

**Consequence to be honest about:** with units on and the access code in hand, the
fused chain does not complete on the app's own flagship sample. Closing kill-gate 2
needs a sample image whose face is large enough and frontal, not just approval to
spend.

### Two failures in `000-misaimed-attempt/` were mine, not the product's

The first capture sent `full-body.jpg` into all four steps. Skin analysis answered
`error_src_face_too_small` and — because that run also relit the apparel render
instead of the person, which the app never does — lighting answered
`error_download_image`. Both are capture-script bugs. The attempt is kept rather than
deleted: it cost 4 units, and a receipt directory that only shows the runs that
flattered the project would be exactly the kind of evidence this file exists to
replace.

## Files

| Path | What |
|---|---|
| `001/receipt.json` | Correctly aimed run: skin, colour, lighting on `samples/selfie.jpg` |
| `001/photo_lighting.render.jpg` | The image YouCam returned for the lighting step, hash-verified |
| `000-misaimed-attempt/receipt.json` | The first run, including the successful apparel VTO and colour steps and the two capture-bug failures |

Result URLs inside the JSON are presigned and expire after two hours — the committed
hashes and the committed render are what remain checkable.
