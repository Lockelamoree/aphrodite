#!/usr/bin/env node
/**
 * Cuts the demo reel: narration + the footage recorded by record-demo.mjs.
 *
 *   node scripts/build-demo-video.mjs <footage-dir> <out.mp4>
 *
 * Env:
 *   TTS_PROVIDER=openai|piper        default openai
 *   TTS_VOICE=marin                  openai only; marin/cedar are the quality picks
 *   TTS_MODEL=gpt-4o-mini-tts        openai only
 *   OPENAI_API_KEY=...               openai only; falls back to reading .env.local
 *   PIPER=/path/to/venv/bin/python   piper only
 *   VOICE_MODEL=/path/to/*.onnx      piper only
 *   VOICE_LENGTH_SCALE=1.0           piper only; >1 slows the delivery down
 *
 * Why this shape: **the narration is the clock.** Each beat's line is synthesised
 * first, and its footage is then held for exactly that long — the last frame freezing
 * if the footage runs short. So re-wording a line in submission/narration.txt re-times
 * the cut with no re-recording, and swapping the voice re-voices the whole reel without
 * touching a single caption or timing by hand. The previous reel had captions with no
 * voice precisely because that coupling did not exist.
 *
 * Captions are burned from the same lines, so what is heard and what is read cannot
 * drift apart. The vocabulary law applies to both — see hackathon/VOCABULARY.md.
 *
 * Two things the provider switch is NOT: it is not a free trial (those grant no
 * commercial rights and demand attribution, which would be a rights defect in the one
 * artifact a judge actually watches), and it is not local. With TTS_PROVIDER=openai the
 * narration lines leave this machine. They are submission copy, not private data — but
 * no file in this repo may claim otherwise. Piper stays as the offline path.
 *
 * Synthesised lines are cached next to their text. Re-running after editing one line
 * re-synthesises that line only, so iterating on wording costs one line's worth of API
 * call rather than the whole reel.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const FOOTAGE = process.argv[2];
const OUT = process.argv[3];
if (!FOOTAGE || !OUT) {
  console.error("usage: build-demo-video.mjs <footage-dir> <out.mp4>");
  process.exit(1);
}

const PROVIDER = (process.env.TTS_PROVIDER ?? "openai").toLowerCase();
const PAD_DUR = Number(process.env.VOICE_PAD ?? "0.45");

// --- OpenAI TTS -------------------------------------------------------------
const TTS_MODEL = process.env.TTS_MODEL ?? "gpt-4o-mini-tts";
const TTS_VOICE = process.env.TTS_VOICE ?? "marin";

/**
 * The delivery brief. This is the actual fix for a narration that reads as a machine
 * listing facts: gpt-4o-mini-tts is steerable in prose, so the direction lives here in
 * version control instead of in whoever ran the build.
 */
const TTS_INSTRUCTIONS = [
  "Calm, warm, first person. A builder showing their own tool to peers who know the field —",
  "never an advertisement and never a demo voice.",
  "Unhurried: land the ends of sentences instead of racing to the next one,",
  "and leave a short beat before each new idea.",
  "Quietly confident when stating what works; plain and unapologetic, not sheepish,",
  "when stating what does not.",
].join(" ");

/** The app reads its key from .env.local; the build should not need a second setup. */
function openaiKey() {
  const fromEnv = process.env.OPENAI_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  try {
    const line = readFileSync(".env.local", "utf8")
      .split("\n")
      .find((l) => l.trim().startsWith("OPENAI_API_KEY="));
    const value = line?.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
    if (value) return value;
  } catch {
    /* fall through to the error below */
  }
  console.error("no OPENAI_API_KEY in the environment or .env.local (or use TTS_PROVIDER=piper)");
  process.exit(1);
}

const PIPER = process.env.PIPER;
const VOICE_MODEL = process.env.VOICE_MODEL;
const LENGTH_SCALE = process.env.VOICE_LENGTH_SCALE ?? "1.0";
if (PROVIDER === "piper" && (!PIPER || !VOICE_MODEL)) {
  console.error("TTS_PROVIDER=piper needs PIPER=<python with piper-tts> and VOICE_MODEL=<...onnx>");
  process.exit(1);
}
const KEY = PROVIDER === "openai" ? openaiKey() : null;

const WORK = join(FOOTAGE, "_build");
mkdirSync(WORK, { recursive: true });

const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
/** Capture canvas: record-demo.mjs shoots at deviceScaleFactor 2, so frames arrive at
 *  2560x1440. Zooming happens at that size and only then scales to 1080p, which is why
 *  a punch-in stays sharp instead of magnifying a downscale. */
const SRC_W = 2560;
const SRC_H = 1440;
const W = 1920;
const H = 1080;
const FPS = 30;
const XFADE = 0.4;
const TITLE_DUR = 2.0;
const END_DUR = 3.6;
/** A beat whose footage never changed yields almost no screencast frames — Chrome only
 *  emits on repaint. One frame held for nine seconds is what a frozen beat looks like. */
const MIN_FRAMES = 20;

const BG = "0xfdf7f9";
const INK = "0x1a1014";
const ACCENT = "0xaa4467";
const LIVE_URL = "https://aphrodite.max-gutowski.de";

/** Beats, in narration order. "# ACT n" markers are comments and never reach the voice. */
const beats = readFileSync("submission/narration.txt", "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"))
  .map((l) => {
    const [id, ...rest] = l.split("|");
    return { id: id.trim(), text: rest.join("|").trim() };
  });

/** Per-beat camera moves. Absent file or absent beat = the gentle default push. */
let edl = {};
try {
  edl = JSON.parse(readFileSync("submission/edl.json", "utf8")).beats ?? {};
} catch {
  console.warn("no submission/edl.json — every beat gets the default push-in");
}

const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] }).toString();
const ff = (args) => execFileSync("ffmpeg", ["-y", "-v", "error", ...args], { stdio: ["ignore", "pipe", "pipe"] });

function duration(file) {
  return Number(
    sh("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).trim(),
  );
}

/** One caption line, wrapped so it never runs off frame. */
function wrap(text, perLine = 78) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > perLine) {
      lines.push(line.trim());
      line = w;
    } else {
      line += " " + w;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

/** drawtext escaping: colons, commas and single quotes are filter syntax. */
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\u2019").replace(/,/g, "\\,");

/** Synthesise one line to wav. Cached on the exact text, so editing one line is cheap. */
function synthesise(beat, rawWav) {
  const stamp = join(WORK, `${beat.id}.said.txt`);
  const brief = `${PROVIDER}|${TTS_VOICE}|${TTS_MODEL}|${TTS_INSTRUCTIONS}|${beat.text}`;
  if (existsSync(rawWav) && existsSync(stamp) && readFileSync(stamp, "utf8") === brief) {
    return false;
  }
  if (PROVIDER === "piper") {
    execFileSync(PIPER, ["-m", "piper", "-m", VOICE_MODEL, "-f", rawWav, "--length-scale", LENGTH_SCALE], {
      input: beat.text,
      stdio: ["pipe", "ignore", "pipe"],
    });
  } else {
    const res = execFileSync(
      "curl",
      [
        "-sS", "--fail-with-body",
        "-X", "POST", "https://api.openai.com/v1/audio/speech",
        "-H", `Authorization: Bearer ${KEY}`,
        "-H", "Content-Type: application/json",
        "-o", rawWav,
        "-d", "@-",
      ],
      {
        input: JSON.stringify({
          model: TTS_MODEL,
          voice: TTS_VOICE,
          input: beat.text,
          instructions: TTS_INSTRUCTIONS,
          response_format: "wav",
        }),
        stdio: ["pipe", "pipe", "pipe"],
      },
    ).toString();
    if (res.trim()) console.warn(`  ${beat.id}: ${res.trim().slice(0, 300)}`);
  }
  writeFileSync(stamp, brief);
  return true;
}

/** A still card, silent, at delivery size. */
function card(file, seconds, lines) {
  const draw = lines
    .map(
      (l, n) =>
        `drawtext=fontfile=${FONT}:text='${esc(l.text)}':fontcolor=${l.color}:fontsize=${l.size}:` +
        `x=(w-text_w)/2:y=(h/2)-${l.dy}`,
    )
    .join(",");
  ff([
    "-f", "lavfi", "-i", `color=c=${BG}:s=${W}x${H}:d=${seconds.toFixed(3)}:r=${FPS}`,
    "-vf", draw,
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
    file,
  ]);
}

function silence(file, seconds) {
  ff([
    "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono",
    "-t", seconds.toFixed(3),
    "-c:a", "pcm_s16le",
    file,
  ]);
}

// --- per-beat: voice first, then footage held to it --------------------------
const segments = [];
const audioParts = [];
const thin = [];

for (const [i, beat] of beats.entries()) {
  const dir = join(FOOTAGE, beat.id);
  const list = join(dir, "frames.txt");
  if (!existsSync(list)) {
    console.warn(`skipping ${beat.id}: no footage`);
    continue;
  }
  const frames = readFileSync(list, "utf8").split("\n").filter((l) => l.startsWith("file ")).length;
  if (frames < MIN_FRAMES) thin.push(`${beat.id} (${frames})`);

  const rawWav = join(WORK, `${beat.id}.wav`);
  const fresh = synthesise(beat, rawWav);

  // Canonical audio format, so the concat below can copy and the silences match.
  const padded = join(WORK, `${beat.id}-padded.wav`);
  ff(["-i", rawWav, "-af", `apad=pad_dur=${PAD_DUR}`, "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", padded]);
  const secs = duration(padded);
  audioParts.push(padded);

  // --- footage, held to the voice's length ---
  const move = edl[beat.id] ?? {};
  const zoomTo = Number(move.zoom ?? 1.1);
  const cx = Number(move.cx ?? 0.5);
  const cy = Number(move.cy ?? 0.5);
  // Rendered a transition longer than the voice, so the cross-dissolve eats the overlap
  // instead of eating the narration. See the offset arithmetic at the assembly step.
  const segLen = secs + XFADE;
  const nFrames = Math.max(2, Math.round(segLen * FPS));
  const t = `min(on/${nFrames},1)`;
  const ease = `(pow(${t},2)*(3-2*${t}))`;
  const zoom =
    `zoompan=z='1+${(zoomTo - 1).toFixed(4)}*${ease}':` +
    `x='(iw-iw/zoom)*${cx}':y='(ih-ih/zoom)*${cy}':d=1:s=${W}x${H}:fps=${FPS}`;

  const caption = wrap(beat.text)
    .map(
      (line, n, all) =>
        `drawtext=fontfile=${FONT}:text='${esc(line)}':fontcolor=white:fontsize=30:` +
        `box=1:boxcolor=${INK}@0.74:boxborderw=16:x=(w-text_w)/2:` +
        `y=h-116-${(all.length - 1 - n) * 48}`,
    )
    .join(",");
  const footer =
    `drawtext=fontfile=${FONT}:text='${esc("aphrodite.max-gutowski.de")} · demo mode · captured YouCam renders · 0 API units':` +
    `fontcolor=0xf6e7ec:fontsize=23:box=1:boxcolor=${ACCENT}@0.9:boxborderw=12:x=32:y=32`;

  const seg = join(WORK, `seg-${String(i).padStart(2, "0")}.mp4`);
  ff([
    "-f", "concat", "-safe", "0", "-i", list,
    "-vf",
    `scale=${SRC_W}:${SRC_H}:force_original_aspect_ratio=decrease,` +
      `pad=${SRC_W}:${SRC_H}:(ow-iw)/2:(oh-ih)/2:color=${BG},` +
      `fps=${FPS},tpad=stop_mode=clone:stop_duration=60,${zoom},${footer},${caption}`,
    "-t", segLen.toFixed(3),
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
    seg,
  ]);
  segments.push({ file: seg, len: segLen });
  console.log(`${beat.id}: ${secs.toFixed(2)}s${fresh ? " (synthesised)" : " (cached)"}  ${frames} frames`);
}

if (!segments.length) {
  console.error("no beats had footage — nothing to cut");
  process.exit(1);
}

// --- cards ------------------------------------------------------------------
const titleCard = join(WORK, "card-title.mp4");
card(titleCard, TITLE_DUR, [
  { text: "Aphrodite", color: INK, size: 104, dy: 40 },
  { text: "One occasion, one selfie — Skin AI and try-on in one place", color: ACCENT, size: 38, dy: -60 },
]);
const endCard = join(WORK, "card-end.mp4");
card(endCard, END_DUR, [
  { text: "Try it — no key, no signup, zero API units", color: INK, size: 44, dy: 70 },
  { text: LIVE_URL, color: ACCENT, size: 56, dy: -10 },
  { text: "github.com/Lockelamoree/aphrodite · MIT", color: INK, size: 30, dy: -100 },
]);

// --- assemble: one encode, cross-dissolved --------------------------------
// Video loses XFADE at every join. Each beat segment was rendered XFADE longer than its
// line, so a beat still occupies exactly its narration's length on the timeline and the
// drift cannot accumulate. Total video then works out to
//   TITLE + sum(lines) + END - XFADE
// and the audio below is built to exactly that, which is why -shortest never truncates
// a word.
const inputs = [{ file: titleCard, len: TITLE_DUR }, ...segments, { file: endCard, len: END_DUR }];
const filter = [];
let acc = "[0:v]";
let accDur = inputs[0].len;
for (let k = 1; k < inputs.length; k++) {
  const label = `[v${k}]`;
  filter.push(
    `${acc}[${k}:v]xfade=transition=fade:duration=${XFADE}:offset=${(accDur - XFADE).toFixed(3)}${label}`,
  );
  accDur = accDur + inputs[k].len - XFADE;
  acc = label;
}

const videoOnly = join(WORK, "video.mp4");
ff([
  ...inputs.flatMap((s) => ["-i", s.file]),
  "-filter_complex", filter.join(";"),
  "-map", acc,
  "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS),
  videoOnly,
]);

const leadIn = join(WORK, "sil-lead.wav");
silence(leadIn, TITLE_DUR - XFADE);
const tail = join(WORK, "sil-tail.wav");
silence(tail, END_DUR);

const alist = join(WORK, "audio.txt");
writeFileSync(alist, [leadIn, ...audioParts, tail].map((s) => `file '${s}'`).join("\n") + "\n");
const audioOnly = join(WORK, "audio.wav");
ff(["-f", "concat", "-safe", "0", "-i", alist, "-c", "copy", audioOnly]);

ff([
  "-i", videoOnly,
  "-i", audioOnly,
  "-c:v", "copy",
  // Broadcast-ish loudness, so the voice is not the quiet one in a judge's playlist.
  "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
  "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
  "-movflags", "+faststart",
  "-shortest",
  OUT,
]);

const spoken = audioParts.reduce((a, f) => a + duration(f), 0);
console.log(
  `\n${OUT} — ${duration(OUT).toFixed(1)}s ` +
    `(${W}x${H} @ ${FPS}, voice ${PROVIDER}${PROVIDER === "openai" ? `/${TTS_VOICE}` : ""}, ` +
    `${spoken.toFixed(1)}s narrated)`,
);
// The event's cap is a disqualifier, not a style note, and the voice sets the length —
// so a wording change or a slower voice can push a compliant reel over it without anyone
// looking. Fail here rather than at upload time.
const CAP = (() => {
  try {
    return JSON.parse(readFileSync("hackathon/config.json", "utf8")).submission.videoMaxSeconds;
  } catch {
    return 180;
  }
})();
const finalDur = duration(OUT);
if (finalDur > CAP) {
  console.error(
    `\nFAIL — ${finalDur.toFixed(1)}s exceeds the ${CAP}s cap. Shorten lines in ` +
      `submission/narration.txt (the narration is the clock) and rebuild; cached lines are reused.`,
  );
  process.exit(1);
}
if (finalDur > CAP - 10) {
  console.warn(`\nNOTE — ${finalDur.toFixed(1)}s leaves under 10s of margin against the ${CAP}s cap.`);
}

if (thin.length) {
  console.warn(
    `\nWARNING — beats with under ${MIN_FRAMES} captured frames, i.e. a near-still held for the ` +
      `whole line: ${thin.join(", ")}. Give them a scroll or a hover in record-demo.mjs.`,
  );
}
