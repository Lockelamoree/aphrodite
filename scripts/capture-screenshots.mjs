#!/usr/bin/env node
/**
 * Screenshot rig for the Devpost gallery.
 *
 * Screenshots are a required Devpost field, and this project has already shipped a
 * stale gallery once (six PNGs from 2026-07-26 showing a pre-gate UI) and a
 * dishonest one once (2026-08-10's `05-countdown.jpg` used the board's editorial
 * hero, which was a render of a stranger, captioned "rendered by YouCam AI"). The
 * README claimed a rig lived in `scripts/` while it lived in a scratch directory,
 * so the gallery could not be reproduced. This is that rig, committed.
 *
 * No dependencies: it speaks CDP over Node 22's built-in WebSocket to the Chromium
 * that Playwright already cached. Zero YouCam units — it drives demo mode only.
 *
 *   node scripts/capture-screenshots.mjs http://localhost:3313 submission/screenshots
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? "submission/screenshots";
const WIDTH = 1440;
const HEIGHT = 900;
const SCALE = 2;

const CHROME_CANDIDATES = [
  join(homedir(), ".cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell"),
  join(homedir(), ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome"),
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
];

const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
  console.error("no chromium binary found; looked in:\n  " + CHROME_CANDIDATES.join("\n  "));
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const proc = spawn(chrome, [
  "--headless=new",
  "--remote-debugging-port=9333",
  "--hide-scrollbars",
  "--no-sandbox",
  `--window-size=${WIDTH},${HEIGHT}`,
  "about:blank",
]);
proc.stderr.on("data", () => {});

/** Chrome prints nothing useful on startup here, so poll the HTTP endpoint. */
async function debuggerUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch("http://127.0.0.1:9333/json/list");
      const tabs = await res.json();
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
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
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

/** Evaluate in the page and return the value; throws page exceptions properly. */
async function evaluate(expression) {
  const { result, exceptionDetails } = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? "page threw");
  return result.value;
}

/** Click the first element whose visible text contains `text`. */
const clickByText = (text) => evaluate(`(() => {
  const t = ${JSON.stringify(text)};
  const el = [...document.querySelectorAll('button, a, [role=button], label')]
    .find(e => (e.innerText || '').includes(t));
  if (!el) return false;
  el.click();
  return true;
})()`);

/** Wait until `predicate` (a JS expression string) is true. */
async function waitFor(predicate, { timeoutMs = 40_000, label = predicate } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(`Boolean(${predicate})`)) return;
    await sleep(250);
  }
  throw new Error(`timed out waiting for ${label}`);
}

/**
 * Clip of the card that contains `text`.
 *
 * Anchoring on visible copy rather than a CSS path is deliberate: a class name
 * changes silently and the shot then frames the wrong thing, while a caption that
 * disappears makes this rig fail loudly — which is what you want from a tool whose
 * output goes to judges.
 */
const cardClip = (text, maxHeight = 1500) => `(() => {
  const t = ${JSON.stringify(text)};
  // Case-insensitive: innerText reflects CSS text-transform, so a heading styled
  // uppercase reads back as SHOUTING and an exact match silently misses it.
  const needle = t.toLowerCase();
  const hit = [...document.querySelectorAll('h1,h2,h3,h4,p,figcaption,span,strong')]
    .find(e => (e.innerText || '').trim().toLowerCase().includes(needle));
  if (!hit) return null;
  // Climb to the CARD, not to the page. Parent-counting was too blunt — the same
  // count framed a panel on one screen and 18,000 px of column on another. Pick
  // the nearest ancestor that looks like a card (rounded + bordered) and still
  // fits a screenshot; fall back to the tallest ancestor under the cap.
  let best = hit;
  let el = hit;
  for (let i = 0; i < 8 && el.parentElement; i++) {
    el = el.parentElement;
    const r = el.getBoundingClientRect();
    if (r.height > ${maxHeight}) break;
    const cls = el.className || '';
    const carded = typeof cls === 'string' && /rounded-/.test(cls) && /border/.test(cls);
    if (r.height >= 60) { best = el; if (carded) break; }
  }
  best.scrollIntoView({ block: 'center' });
  const r = best.getBoundingClientRect();
  return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height, scale: ${SCALE} };
})()`;

/** ONLY=05 re-shoots a single frame without reshuffling the rest of the gallery. */
const ONLY = process.env.ONLY;

async function shoot(name, { anchor, maxHeight } = {}) {
  if (ONLY && !name.includes(ONLY)) return;
  const clip = anchor ? await evaluate(cardClip(anchor, maxHeight ?? 1500)) : null;
  if (anchor && !clip) throw new Error(`no element on the page contains ${JSON.stringify(anchor)}`);
  await sleep(500);
  const { data } = await send("Page.captureScreenshot", {
    format: "jpeg",
    quality: 88,
    captureBeyondViewport: Boolean(clip),
    ...(clip ? { clip } : {}),
  });
  writeFileSync(join(OUT, name), Buffer.from(data, "base64"));
  console.log("wrote", join(OUT, name));
}

mkdirSync(OUT, { recursive: true });
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
  await sleep(1500);
}

console.log("driving", BASE);

// --- the wedding path: one person, a real try-on render of that photo ---
await goto(BASE);
await shoot("01-landing.jpg");
await shoot("02-apparel-vto.jpg", { anchor: "Not an illustration" });

if (!(await clickByText("Wedding · full-body"))) throw new Error("no wedding sample button");
await sleep(1200);
if (!(await clickByText("Build my look"))) throw new Error("no submit button");
await waitFor("document.body.innerText.includes('Skin-prep countdown')", { label: "the look board" });
await sleep(1500);

await shoot("03-skin-scores.jpg", { anchor: "priority areas" });
await shoot("04-colour-palette.jpg", { anchor: "Your colors" });
await shoot("05-countdown.jpg", { anchor: "Skin-prep countdown" });
await shoot("06-priced-basket.jpg", { anchor: "Build your basket", maxHeight: 1200 });
await shoot("07-provenance-ledger.jpg", { anchor: "Captured from" });
await shoot("08-render-pair.jpg", { anchor: "see it on before you buy", maxHeight: 1200 });

// --- the selfie-only path: a captured mask of that same face, honest empties ---
await goto(BASE);
if (!(await clickByText("First date · selfie only"))) throw new Error("no date sample button");
await sleep(1200);
if (!(await clickByText("Build my look"))) throw new Error("no submit button");
await waitFor("document.body.innerText.includes('Skin-prep countdown')", { label: "the second board" });
await sleep(1500);
await shoot("09-skin-overlay-captured.jpg", { anchor: "What YouCam sees" });

// --- the gate a judge redeems their code at ---
await goto(`${BASE}/unlock`);
await shoot("10-judge-unlock.jpg");

await ws.close();
proc.kill();
