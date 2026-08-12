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
 *   node scripts/record-demo.mjs http://localhost:3313 /tmp/footage
 *
 * The beats are the ids in submission/narration.txt. Change a line there and the cut
 * re-times; change what a beat shows here.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? "/tmp/aphrodite-footage";
const WIDTH = 1280;
const HEIGHT = 800;
const JUDGE_CODE = process.env.APHRODITE_SHOT_CODE ?? "";

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

const proc = spawn(chrome, [
  "--headless=new",
  "--remote-debugging-port=9334",
  "--hide-scrollbars",
  "--no-sandbox",
  "--force-device-scale-factor=1",
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

async function waitFor(predicate, { timeoutMs = 40_000, label = predicate } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(`Boolean(${predicate})`)) return;
    await sleep(200);
  }
  throw new Error(`timed out waiting for ${label}`);
}

/** Scroll so the card containing `text` sits nicely in frame. */
const focusOn = (text, block = "center") => evaluate(`(() => {
  const needle = ${JSON.stringify(text)}.toLowerCase();
  const hit = [...document.querySelectorAll('h1,h2,h3,h4,p,figcaption,span,strong')]
    .find(e => (e.innerText || '').toLowerCase().includes(needle));
  if (!hit) return false;
  hit.scrollIntoView({ behavior: 'smooth', block: ${JSON.stringify(block)} });
  return true;
})()`);

/**
 * Record for `ms` while `during` runs. Frames are written with the gap since the
 * previous frame as their duration, so ffmpeg replays the real pacing.
 */
async function record(beat, ms, during = async () => {}) {
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
  await send("Page.startScreencast", { format: "jpeg", quality: 80, everyNthFrame: 1 });
  const started = Date.now();
  await during();
  const remaining = ms - (Date.now() - started);
  if (remaining > 0) await sleep(remaining);
  await send("Page.stopScreencast");
  sink = null;
  // The concat demuxer needs the last entry repeated without a duration.
  const list =
    frames.map((f) => `file '${f.file}'\nduration ${f.duration.toFixed(3)}`).join("\n") +
    `\nfile '${frames[frames.length - 1].file}'\n`;
  writeFileSync(join(dir, "frames.txt"), list);
  console.log(`${beat}: ${frames.length} frames`);
}

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });

async function goto(url) {
  await send("Page.navigate", { url });
  await waitFor("document.querySelector('h1')", { label: `load ${url}` });
  await sleep(1500);
}

mkdirSync(OUT, { recursive: true });
console.log("recording", BASE, "->", OUT);

/**
 * Drive a sample run to completion WITHOUT recording.
 *
 * This separation is load-bearing. The first cut recorded the run inside the beat that
 * described its result, and because a beat is trimmed to the length of its narration —
 * from the front — the footage that survived was the form filling in while the voice
 * talked about a render further down the page. A caption describing something off
 * screen is exactly the small lie this project refuses elsewhere, so the run happens
 * first and the beat records only the state it names.
 */
async function drive(sampleLabel) {
  if (!(await clickByText(sampleLabel))) throw new Error(`no sample button: ${sampleLabel}`);
  await sleep(1400);
  if (!(await clickByText("Build my look"))) throw new Error("no submit button");
  await waitFor("document.body.innerText.includes('Skin-prep countdown')", { label: "the board" });
  await sleep(1200);
}

// --- beat 1: the landing, product on screen immediately ---
await goto(BASE);
await record("b1-landing", 9000, async () => {
  await sleep(2500);
  await evaluate("window.scrollBy({ top: 260, behavior: 'smooth' })");
  await sleep(3000);
  await evaluate("window.scrollTo({ top: 0, behavior: 'smooth' })");
});

// --- the wedding run, driven before the beats that describe it ---
await drive("Wedding · full-body");

await record("b2-skin", 9000, async () => {
  await focusOn("Skin health scores");
  await sleep(4500);
});

await record("b3-colour", 9000, async () => {
  await focusOn("Your colors");
  await sleep(4500);
});

await record("b4-tryon", 9000, async () => {
  await focusOn("see it on before you buy");
  await sleep(4000);
});

await record("b5-ledger", 11000, async () => {
  await focusOn("Captured from");
  await sleep(6000);
});

await record("b7-countdown", 10000, async () => {
  await focusOn("Skin-prep countdown");
  await sleep(5500);
});

await record("b8-basket", 8000, async () => {
  await focusOn("Build your basket");
  await sleep(4500);
});

// --- the second face, likewise driven first ---
await goto(BASE);
await drive("First date · selfie only");

await record("b6-second-face", 10000, async () => {
  await focusOn("see it on before you buy");
  await sleep(5500);
});

await record("b9-empty", 12000, async () => {
  await focusOn("No lighting pass this run");
  await sleep(5500);
  await focusOn("What YouCam sees");
  await sleep(4000);
});

// --- the judge path: unlock, then the evidence route it opens ---
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
await record("b10-judges", 14000, async () => {
  await sleep(3500);
  if (JUDGE_CODE) {
    await clickByText("Unlock");
    await sleep(2500);
  }
  await send("Page.navigate", { url: `${BASE}/api/dev/verify` });
  await sleep(6000);
});

await ws.close();
proc.kill();
console.log("done");
