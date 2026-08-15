#!/usr/bin/env node
/**
 * Records the demo reel's footage, one directory of frames per narration beat.
 *
 * Same CDP-over-Node-WebSocket approach as the screenshot rig, so it needs no
 * dependencies either. It drives the real app in demo mode — zero YouCam units — and
 * writes `<out>/<beat-id>/NNNN.jpg` plus `<out>/<beat-id>/frames.txt`, an ffmpeg
 * concat list carrying each frame's real duration. Wall-clock timing is preserved,
 * which matters: an animated reveal that plays at the wrong speed reads as a fake.
 *
 *   node scripts/record-demo.mjs https://aphrodite.max-gutowski.de /path/to/footage
 *
 * The beats are the ids in submission/narration.txt. Change a line there and the cut
 * re-times; change what a beat shows here.
 *
 * Two things this rig learned the hard way.
 *
 * 1. **Everything must move.** Chrome's screencast only emits a frame when the page
 *    repaints, so a beat that called scrollIntoView once and then waited produced a
 *    handful of frames — `b3-colour` was a single frame held for nine seconds, which is
 *    what "the editing feels bad" actually looked like. Every beat now glides for its
 *    whole length via `glideTo`, an eased rAF scroll, so frames arrive continuously.
 *
 * 2. **Never drive a run after unlocking.** An unlocked session leaves demo mode, and a
 *    run outside demo mode spends real YouCam units. The unlock beat is therefore last,
 *    and nothing is driven after it. The default path of /api/dev/verify is free by
 *    construction, which is the only reason that beat can be filmed at all.
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.argv[2] ?? "https://aphrodite.max-gutowski.de";
const OUT = process.argv[3] ?? join(homedir(), "aphrodite-footage");
/** Layout size. Frames arrive at twice this, because a punch-in that crops a downscale
 *  is just a blur — see the SRC_W note in build-demo-video.mjs. */
const WIDTH = 1280;
const HEIGHT = 720;
const SCALE = 2;
/** Browser zoom used only for the raw-JSON beat, so the real response text is legible. */
const PAGE_SCALE = 2.0;
const JUDGE_CODE = process.env.APHRODITE_SHOT_CODE ?? "";
/** ONLY=b14-verify re-shoots one beat without disturbing the others, the same escape
 *  hatch capture-screenshots.mjs has. Navigation and the sample runs still happen,
 *  because a beat's screen only exists after them. */
const ONLY = process.env.ONLY?.trim() || null;

const CHROME_CANDIDATES = [
  join(homedir(), ".cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell"),
  join(homedir(), ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome"),
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
];
const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
  console.error("no chromium binary found");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * A throwaway profile per invocation, and it is a safety control rather than hygiene.
 * The judge code this rig redeems leaves demo mode for that session, and on the deployed
 * instance a run outside demo mode spends real YouCam units. If an unlock cookie were
 * ever to survive into a later invocation, that invocation's sample runs would bill the
 * account. An empty profile directory makes the leak impossible instead of unlikely.
 */
const PROFILE = mkdtempSync(join(tmpdir(), "aphrodite-shot-"));

const proc = spawn(chrome, [
  "--headless=new",
  "--remote-debugging-port=9334",
  "--hide-scrollbars",
  "--no-sandbox",
  `--user-data-dir=${PROFILE}`,
  "--incognito",
  `--force-device-scale-factor=${SCALE}`,
  `--window-size=${WIDTH},${HEIGHT}`,
  "about:blank",
]);
proc.stderr.on("data", () => {});

async function debuggerUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const tabs = await (await fetch("http://127.0.0.1:9334/json/list")).json();
      const page = tabs.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error("chrome devtools endpoint never came up");
}

const ws = new WebSocket(await debuggerUrl());
await new Promise((r) => ws.addEventListener("open", r, { once: true }));

let seq = 0;
const pending = new Map();
/** Screencast frames arrive as events, not replies, so they need their own sink. */
let sink = null;

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.method === "Page.screencastFrame") {
    if (sink) sink(msg.params);
    // Ack every frame or Chrome stops sending them.
    ws.send(JSON.stringify({ id: ++seq, method: "Page.screencastFrameAck", params: { sessionId: msg.params.sessionId } }));
    return;
  }
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
});

function send(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const { result, exceptionDetails } = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? "page threw");
  return result.value;
}

const clickByText = (text) => evaluate(`(() => {
  const needle = ${JSON.stringify(text)}.toLowerCase();
  const el = [...document.querySelectorAll('button, a, [role=button], label')]
    .find(e => (e.innerText || '').toLowerCase().includes(needle));
  if (!el) return false;
  el.click();
  return true;
})()`);

async function waitFor(predicate, { timeoutMs = 60_000, label = predicate } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(`Boolean(${predicate})`)) return;
    await sleep(200);
  }
  throw new Error(`timed out waiting for ${label}`);
}

/** Find the element whose visible copy contains `text`. Anchors must be unique strings:
 *  the try-on beat once framed the shopping list because "Your outfit" also appears in
 *  the basket blurb. */
const findY = (text, bias = 0.28) => evaluate(`(() => {
  const needle = ${JSON.stringify(text)}.toLowerCase();
  const hit = [...document.querySelectorAll('h1,h2,h3,h4,p,li,figcaption,span,strong,dt,dd')]
    .find(e => (e.innerText || '').toLowerCase().includes(needle) && e.getClientRects().length);
  if (!hit) return null;
  const top = hit.getBoundingClientRect().top + window.scrollY;
  return Math.max(0, top - window.innerHeight * ${bias});
})()`);

/**
 * Eased scroll to an absolute Y over `ms`, driven by requestAnimationFrame inside the
 * page. This is what keeps frames arriving for a beat's whole length — the reason the
 * old rig produced one-frame beats is that it scrolled once and then slept.
 */
const glide = (y, ms) => evaluate(`new Promise((res) => {
  // app/globals.css sets scroll-behavior: smooth, which turns EVERY scrollTo below into
  // its own animation. Sixty of those a second fight each other, so the page drifts
  // continuously without ever arriving — beats kept framing the panel after the one
  // their line described while still producing plenty of frames, which is why this was
  // invisible in the frame counts. The rAF loop owns the easing, so the CSS easing has
  // to be off while it runs.
  const root = document.documentElement;
  const prev = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  const startY = window.scrollY, dy = ${y} - startY, t0 = performance.now();
  const step = (t) => {
    const p = Math.min((t - t0) / ${ms}, 1);
    window.scrollTo(0, startY + dy * (p * p * (3 - 2 * p)));
    if (p < 1) requestAnimationFrame(step);
    else { root.style.scrollBehavior = prev; res(true); }
  };
  requestAnimationFrame(step);
})`);

async function glideTo(text, ms, bias) {
  const y = await findY(text, bias);
  if (y === null) throw new Error(`no anchor on screen: ${text}`);
  await glide(y, ms);
}

/** Sweep the first range input in the document — the before/after proof card's grip.
 *  Motion AND the comparison being made, in one gesture. */
const sweepRange = (ms) => evaluate(`(() => {
  const el = document.querySelector('input[type=range]');
  if (!el) return false;
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const t0 = performance.now();
  const min = Number(el.min || 0), max = Number(el.max || 100);
  return new Promise((res) => {
    const step = (t) => {
      const p = Math.min((t - t0) / ${ms}, 1);
      // out and back, so the frame ends where it started
      const q = p < 0.5 ? p * 2 : (1 - p) * 2;
      set.call(el, String(min + (max - min) * q));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      if (p < 1) requestAnimationFrame(step); else res(true);
    };
    requestAnimationFrame(step);
  });
})()`);

/** Type into the occasion field character by character, so the beat has real motion. */
const typeInto = (placeholderish, text, ms) => evaluate(`(() => {
  const needle = ${JSON.stringify(placeholderish)}.toLowerCase();
  const el = [...document.querySelectorAll('input[type=text], input:not([type]), textarea')]
    .find(e => (e.placeholder || '').toLowerCase().includes(needle)) ||
    document.querySelector('input[type=text], textarea');
  if (!el) return false;
  const set = Object.getOwnPropertyDescriptor(
    (el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement).prototype, 'value').set;
  const full = ${JSON.stringify(text)};
  const per = ${ms} / full.length;
  el.focus();
  return new Promise((res) => {
    let i = 0;
    const tick = () => {
      i += 1;
      set.call(el, full.slice(0, i));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      if (i < full.length) setTimeout(tick, per); else res(true);
    };
    tick();
  });
})()`);

/**
 * Record for `ms` while `during` runs. Frames are written with the gap since the
 * previous frame as their duration, so ffmpeg replays the real pacing.
 *
 * Over-recording is safe and deliberate: build-demo-video.mjs trims a beat to its
 * narration length from the front, so a tail that is never used costs nothing, while
 * footage that runs short freezes on its last frame.
 */
async function record(beat, ms, during = async () => {}) {
  if (ONLY && beat !== ONLY) return;
  const dir = join(OUT, beat);
  mkdirSync(dir, { recursive: true });
  const frames = [];
  let n = 0;
  let last = Date.now();
  sink = ({ data, metadata }) => {
    const now = metadata?.timestamp ? metadata.timestamp * 1000 : Date.now();
    const file = `${String(n).padStart(4, "0")}.jpg`;
    writeFileSync(join(dir, file), Buffer.from(data, "base64"));
    if (n > 0) frames[frames.length - 1].duration = Math.max(0.02, (now - last) / 1000);
    frames.push({ file, duration: 0.1 });
    last = now;
    n += 1;
  };
  await send("Page.startScreencast", {
    format: "jpeg",
    quality: 90,
    everyNthFrame: 1,
    maxWidth: WIDTH * SCALE,
    maxHeight: HEIGHT * SCALE,
  });
  const started = Date.now();
  await during();
  const remaining = ms - (Date.now() - started);
  if (remaining > 0) await sleep(remaining);
  await send("Page.stopScreencast");
  sink = null;
  if (!frames.length) throw new Error(`${beat}: no frames captured`);
  // The concat demuxer needs the last entry repeated without a duration.
  const list =
    frames.map((f) => `file '${f.file}'\nduration ${f.duration.toFixed(3)}`).join("\n") +
    `\nfile '${frames[frames.length - 1].file}'\n`;
  writeFileSync(join(dir, "frames.txt"), list);
  console.log(`${beat}: ${frames.length} frames`);
}

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: WIDTH,
  height: HEIGHT,
  deviceScaleFactor: SCALE,
  mobile: false,
});

async function goto(url) {
  await send("Page.navigate", { url });
  await waitFor("document.querySelector('h1')", { label: `load ${url}` });
  await sleep(1800);
}

mkdirSync(OUT, { recursive: true });
console.log("recording", BASE, "->", OUT, `at ${WIDTH * SCALE}x${HEIGHT * SCALE}`);

/**
 * Drive a sample run to completion WITHOUT recording.
 *
 * This separation is load-bearing for every beat that describes a *result*. The first
 * cut recorded the run inside the beat that described its outcome, and because a beat is
 * trimmed to the length of its narration — from the front — the footage that survived
 * was the form filling in while the voice talked about a render further down the page.
 * The one beat that legitimately shows the run is b04-run, whose line is about watching
 * it work; that one records the stream on purpose.
 */
async function drive(sampleLabel) {
  if (!(await clickByText(sampleLabel))) throw new Error(`no sample button: ${sampleLabel}`);
  await sleep(1400);
  if (!(await clickByText("Build my look"))) throw new Error("no submit button");
  await waitFor("document.body.innerText.includes('Skin-prep countdown')", { label: "the board" });
  await sleep(1200);
}

// ===== ACT 1 — why, on the landing page ====================================
await goto(BASE);

await record("b01-why", 24_000, async () => {
  await sleep(1200);
  await glideTo("Rendered on a real photo", 7000);
  await sweepRange(9000);
  await sleep(1000);
  await glide(0, 4000);
});

await record("b02-promise", 10_000, async () => {
  await glideTo("Occasion-ready", 4000, 0.05);
  await sleep(2000);
  await glideTo("What's the occasion", 3000);
});

// ===== ACT 2 — the loop ====================================================
await record("b03-input", 21_000, async () => {
  await typeInto("wedding", "An evening wedding in three weeks", 5000);
  await sleep(800);
  await glideTo("Your photos", 3500);
  await clickByText("Wedding · full-body");
  await sleep(1800);
  await glideTo("The cut is required", 4000);
  await sleep(2500);
});

// The one beat that shows the run happening, because its line says so.
await record("b04-run", 15_000, async () => {
  await clickByText("Build my look");
  await waitFor("document.body.innerText.includes('Skin-prep countdown')", { label: "the board" });
  await sleep(2500);
  await glideTo("Skin-prep countdown", 4000);
});

await record("b05-board", 17_000, async () => {
  await glide(0, 2500);
  await glideTo("Shop the look", 12_000);
});

// ===== ACT 3 — the highlights =============================================
await record("b06-skin", 13_000, async () => {
  await glideTo("Skin health scores", 5000);
  await sleep(3000);
  await glide(await findY("Skin health scores", 0.1), 4000);
});

await record("b07-colour", 11_000, async () => {
  await glideTo("Your colors", 5000);
  await sleep(2500);
  await glide(await findY("Your colors", 0.08), 3000);
});

await record("b08-tryon", 15_000, async () => {
  await glideTo("see it on before you buy", 5500);
  await sleep(3000);
  await glideTo("Adding YouCam occasion lighting", 4000).catch(() =>
    glideTo("Occasion lighting", 4000).catch(() => {}),
  );
});

await record("b09-countdown", 15_000, async () => {
  await glideTo("Skin-prep countdown", 5000);
  await sleep(2000);
  await glide(await findY("Skin-prep countdown", -0.15), 6000);
});

// The honest limit: the companion line that says nothing about colour.
await record("b11-honest-limit", 21_000, async () => {
  await glideTo("right for a wedding", 6000).catch(() => glideTo("I'd put you in the", 6000));
  await sleep(5000);
  await glideTo("Shop the look", 6000);
  await sleep(2000);
});

// ===== ACT 4 — the ledger, on the wedding board ===========================
await record("b13-ledger", 19_000, async () => {
  await glideTo("The details, seen", 5000);
  await sleep(2000);
  await glideTo("Captured from", 6000);
  await sleep(4000);
});

// ===== ACT 5 — the engine badge and the stream ============================
await record("b15-engines", 18_000, async () => {
  await glide(await findY("YouCam AI ·", 0.2), 5000);
  await sleep(4000);
  await glideTo("Skin-prep countdown", 5000);
});

await record("b16-close", 21_000, async () => {
  await glide(0, 3000);
  await sleep(2000);
  await glideTo("Shop the look", 12_000);
});

// ===== the second face — a fresh run, still demo mode =====================
// Guarded: with ONLY set to a beat that does not need this run, driving it anyway is
// pure risk for no footage. The timeout that first exposed this was a sample run taking
// far longer than the ~4.5 s a fixture run takes.
const SECOND_FACE_BEATS = ["b10-second-face", "b12-refuse"];
if (!ONLY || SECOND_FACE_BEATS.includes(ONLY)) {
  await goto(BASE);
  await drive("First date · selfie only");
}

// Anchored on the render's OWN caption with a high bias, so the caption sits low in
// frame and the image it describes is above it. The first take anchored on the panel
// heading and, by the time the voice named the Sky Wrap Maxi, the frame had settled on
// the shopping basket — the render was off screen for its own line.
await record("b10-second-face", 21_000, async () => {
  await glideTo("Apparel try-on · rendered by", 6000, 0.62);
  await sleep(7000);
  await glideTo("Your colors", 5000, 0.2);
  await sleep(2000);
});

// The refusal itself, verbatim from Concierge.tsx:611. NOT a fallback chain: the first
// take fell through three catches and framed the colour palette and the studio tiles
// while the voice described a refusal, which is the exact defect this reel keeps finding.
// If this string is ever not on screen, the beat must fail loudly instead of framing
// something else.
// "No lighting pass this run." is what a BUNDLED sample shows: finishEmpty at
// Concierge.tsx:610-612 only reaches the stronger "will not put a stranger's render
// under your name" wording when sampleData is true, i.e. an OWN uploaded photo. The
// narration was rewritten to the weaker, filmable truth rather than the reverse.
await record("b12-refuse", 21_000, async () => {
  // Frame the lighting slot HEADING, not the empty message: at bias 0.18 the heading
  // sits high and the "No lighting pass this run." line below it is in the same frame,
  // instead of a screen of whitespace with six words of grey text in the middle.
  await glideTo("Occasion lighting", 6500, 0.18);
  await sleep(6500);
  await glideTo("What YouCam sees", 5000, 0.22);
  await sleep(2000);
});

// ===== the judge path, LAST — an unlocked session leaves demo mode ========
await goto(`${BASE}/unlock`);
if (JUDGE_CODE) {
  await evaluate(`(() => {
    const i = document.querySelector('input');
    if (!i) return false;
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(i, ${JSON.stringify(JUDGE_CODE)});
    i.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(800);
}
await record("b14-verify", 20_000, async () => {
  await sleep(2000);
  if (JUDGE_CODE) {
    await clickByText("Unlock");
    await sleep(2500);
  }
  // Free by construction: the default path replays committed receipts and spends nothing.
  await send("Page.navigate", { url: `${BASE}/api/dev/verify` });
  await sleep(2500);
  // The raw JSON is one unreadable block that happens to fit a single screen — which is
  // also why the first take yielded 13 frames and nothing to read. Chrome's own
  // Pretty-print control lives in the JSON viewer's shadow DOM and cannot be clicked
  // from the page, so instead the browser is zoomed the way a judge would zoom it. That
  // both enlarges the real response text and creates the scroll room the beat needs.
  await send("Emulation.setPageScaleFactor", { pageScaleFactor: PAGE_SCALE });
  await sleep(1200);
  // A synthesised gesture scrolls the VISUAL viewport, which window.scrollTo does not
  // once a page scale factor is in play — and it animates, so frames keep arriving.
  // Gesture coordinates live in the SCALED visual viewport, which at scale 2 is only
  // 640x360 — the viewport centre is out of bounds there and the call rejects.
  await send("Input.synthesizeScrollGesture", {
    x: Math.round(WIDTH / (2 * PAGE_SCALE)) - 40,
    y: Math.round(HEIGHT / (2 * PAGE_SCALE)) - 40,
    yDistance: -1400,
    speed: 180,
  });
  await sleep(1500);
  await send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
});

await ws.close();
proc.kill();
try {
  rmSync(PROFILE, { recursive: true, force: true });
} catch {
  /* a leftover temp profile is harmless; a leaked cookie is not, and it is gone with it */
}
console.log("done");
