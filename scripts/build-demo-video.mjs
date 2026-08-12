#!/usr/bin/env node
/**
 * Cuts the demo reel: Piper narration + the footage recorded by record-demo.mjs.
 *
 *   node scripts/build-demo-video.mjs <footage-dir> <out.mp4>
 *
 * Env:
 *   PIPER=/path/to/venv/bin/python   the interpreter that has piper-tts installed
 *   VOICE_MODEL=/path/to/en_US-hfc_female-medium.onnx
 *   VOICE_LENGTH_SCALE=1.0           >1 slows the delivery down
 *
 * Why this shape: **the narration is the clock.** Each beat's line is synthesised
 * first, and its footage is then held for exactly that long — the last frame freezing
 * if the footage runs short. So re-wording a line in submission/narration.txt re-times
 * the cut with no re-recording, and swapping VOICE_MODEL re-voices the whole reel
 * without touching a single caption or timing by hand. The previous reel had captions
 * with no voice precisely because that coupling did not exist.
 *
 * Captions are burned from the same lines, so what is heard and what is read cannot
 * drift apart. The vocabulary law applies to both — see hackathon/VOCABULARY.md.
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
const PIPER = process.env.PIPER;
const VOICE_MODEL = process.env.VOICE_MODEL;
if (!PIPER || !VOICE_MODEL) {
  console.error("set PIPER=<python with piper-tts> and VOICE_MODEL=<...onnx>");
  process.exit(1);
}
const LENGTH_SCALE = process.env.VOICE_LENGTH_SCALE ?? "1.0";

const WORK = join(FOOTAGE, "_build");
mkdirSync(WORK, { recursive: true });

const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const W = 1280;
const H = 800;
const FPS = 25;

/** Beats, in narration order. */
const beats = readFileSync("submission/narration.txt", "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"))
  .map((l) => {
    const [id, ...rest] = l.split("|");
    return { id: id.trim(), text: rest.join("|").trim() };
  });

const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] }).toString();

function duration(file) {
  return Number(
    sh("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).trim(),
  );
}

/** One caption line, wrapped so it never runs off frame. */
function wrap(text, perLine = 62) {
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

/** drawtext escaping: colons and single quotes are filter syntax. */
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\u2019").replace(/,/g, "\\,");

const segments = [];
const audioParts = [];

for (const [i, beat] of beats.entries()) {
  const dir = join(FOOTAGE, beat.id);
  const list = join(dir, "frames.txt");
  if (!existsSync(list)) {
    console.warn(`skipping ${beat.id}: no footage`);
    continue;
  }

  // --- voice first: it sets the length of everything else ---
  const wav = join(WORK, `${beat.id}.wav`);
  execFileSync(
    PIPER,
    ["-m", "piper", "-m", VOICE_MODEL, "-f", wav, "--length-scale", LENGTH_SCALE],
    { input: beat.text, stdio: ["pipe", "ignore", "pipe"] },
  );
  // A breath of silence after each line, so beats do not collide.
  const padded = join(WORK, `${beat.id}-padded.wav`);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", wav, "-af", "apad=pad_dur=0.55", padded]);
  const secs = duration(padded);
  audioParts.push(padded);

  // --- footage, held to the voice's length ---
  const caption = wrap(beat.text)
    .map(
      (line, n, all) =>
        `drawtext=fontfile=${FONT}:text='${esc(line)}':fontcolor=white:fontsize=25:` +
        `box=1:boxcolor=0x1a1014@0.72:boxborderw=14:x=(w-text_w)/2:` +
        `y=h-90-${(all.length - 1 - n) * 40}`,
    )
    .join(",");
  const footer =
    `drawtext=fontfile=${FONT}:text='demo mode · captured YouCam renders · 0 API units':` +
    `fontcolor=0xf6e7ec:fontsize=17:box=1:boxcolor=0xaa4467@0.9:boxborderw=9:x=24:y=24`;

  const seg = join(WORK, `seg-${String(i).padStart(2, "0")}.mp4`);
  execFileSync("ffmpeg", [
    "-y", "-v", "error",
    "-f", "concat", "-safe", "0", "-i", list,
    "-vf",
    `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0xfdf7f9,` +
      `fps=${FPS},tpad=stop_mode=clone:stop_duration=30,${footer},${caption}`,
    "-t", secs.toFixed(3),
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
    seg,
  ]);
  segments.push(seg);
  console.log(`${beat.id}: ${secs.toFixed(2)}s`);
}

// --- assemble ---
const vlist = join(WORK, "segments.txt");
writeFileSync(vlist, segments.map((s) => `file '${s}'`).join("\n") + "\n");
const alist = join(WORK, "audio.txt");
writeFileSync(alist, audioParts.map((s) => `file '${s}'`).join("\n") + "\n");

const videoOnly = join(WORK, "video.mp4");
execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", vlist, "-c", "copy", videoOnly]);
const audioOnly = join(WORK, "audio.wav");
execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", alist, "-c", "copy", audioOnly]);

execFileSync("ffmpeg", [
  "-y", "-v", "error",
  "-i", videoOnly,
  "-i", audioOnly,
  "-c:v", "copy",
  "-c:a", "aac", "-b:a", "160k",
  "-shortest",
  OUT,
]);

console.log(`\n${OUT} — ${duration(OUT).toFixed(1)}s`);
