/**
 * Live-run receipt capture — SPENDS REAL YOUCAM UNITS.
 *
 * Why this file exists: the project's own kill gate demands that YouCam use be
 * "provable at judging time", and until now nothing in the repo could prove it. Every
 * reachable path is fixture-served, so a judge sees an integration they have to take on
 * trust. This captures one real run through the four chained features and commits the
 * provider's own answers — task ids, poll envelopes, content hashes — as evidence.
 *
 * It is NOT part of the test suite. `vitest.config.ts` includes only `tests/**`, so
 * `npm test` cannot reach it, and it self-skips unless the capture flag is set. Both
 * guards are deliberate: a file that spends money must not be one `npm test` away.
 *
 * Run, only with explicit operator approval:
 *
 *   APHRODITE_CAPTURE_RECEIPT=1 npx vitest run --config vitest.config.ts \
 *     scripts/capture-receipt.test.ts --testTimeout=600000
 *
 * Cost: exactly 4 tasks (~4-5 units) plus 4 File API uploads, which are free.
 *
 * The poll loop here is local rather than `pollTask()` from the client, for one
 * reason: `pollTask` returns `data.results` and discards the envelope, and the
 * envelope — `task_status`, the task id echoed back, the error slot — is the part a
 * judge needs. The auth header, base URL and endpoints are the app's own.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { describe, it, expect } from "vitest";

import { youcamConfig, endpointsFor } from "@/lib/youcam/config";
import { GARMENT_CATALOG } from "@/lib/concierge/catalog";
import { DEFAULT_SKIN_CONCERNS } from "@/lib/youcam/skin";

const ENABLED = process.env.APHRODITE_CAPTURE_RECEIPT === "1";
const OUT_DIR = process.env.APHRODITE_RECEIPT_DIR ?? "hackathon/receipts/001";

/** Minimal .env.local reader — vitest does not load it, and the key lives there. */
function loadEnvLocal(): void {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!m) continue;
    const [, k, v] = m;
    if (process.env[k] === undefined) process.env[k] = v.replace(/^["']|["']$/g, "");
  }
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${process.env.YOUCAM_API_KEY}` };
}

/** The provider shapes this script reads. Kept local: the client's own interfaces
 *  drop the envelope, and the envelope is exactly what a receipt needs. */
interface FileApiEnvelope {
  data?: {
    files?: {
      file_id?: string;
      requests?: { url: string; method?: string; headers?: Record<string, string> }[];
    }[];
  };
}
interface TaskEnvelope {
  data?: {
    task_id?: string;
    task_status?: string;
    error?: string | null;
    error_message?: string;
    results?: { url?: string; output?: { url?: string | null }[] } | null;
  };
}

async function api(path: string, init: RequestInit & { json?: unknown } = {}) {
  const { json, headers, ...rest } = init;
  const res = await fetch(`${youcamConfig.base}${path}`, {
    ...rest,
    headers: {
      ...authHeaders(),
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* keep the text */
  }
  return { status: res.status, body: parsed as Record<string, unknown> };
}

/** Upload bytes through the File API's presigned PUT and return the file_id. */
async function uploadBytes(data: Buffer, contentType: string, fileEndpoint: string) {
  const resp = await api(fileEndpoint, {
    method: "POST",
    json: {
      files: [
        { content_type: contentType, file_name: "upload.jpg", file_size: data.byteLength },
      ],
    },
  });
  const file = (resp.body as FileApiEnvelope)?.data?.files?.[0];
  const put = file?.requests?.[0];
  if (!file?.file_id || !put?.url) throw new Error(`no upload target: ${JSON.stringify(resp.body)}`);
  const signed: Record<string, string> = {};
  for (const [k, v] of Object.entries(put.headers ?? {})) {
    if (k.toLowerCase() === "content-length") continue;
    signed[k] = String(v);
  }
  const putRes = await fetch(put.url, {
    method: put.method ?? "PUT",
    headers: { "Content-Type": contentType, ...signed },
    body: data as unknown as BodyInit,
  });
  if (!putRes.ok) throw new Error(`presigned PUT failed ${putRes.status}`);
  return { fileId: file.file_id as string, uploadStatus: putRes.status };
}

interface Step {
  feature: string;
  fileEndpoint: string;
  taskEndpoint: string;
  requestBody: Record<string, unknown>;
  taskId?: string;
  pollEnvelopes: unknown[];
  finalStatus?: string;
  resultUrl?: string;
  render?: { sha256: string; bytes: number; contentType: string | null };
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
}

async function runStep(
  feature: string,
  key: Parameters<typeof endpointsFor>[0],
  body: (fileEndpoint: string) => Promise<Record<string, unknown>>,
): Promise<Step> {
  const { file, task } = endpointsFor(key);
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const requestBody = await body(file);
  const started = await api(task, { method: "POST", json: requestBody });
  const taskId = (started.body as TaskEnvelope)?.data?.task_id;
  const step: Step = {
    feature,
    fileEndpoint: file,
    taskEndpoint: task,
    requestBody,
    taskId,
    pollEnvelopes: [],
    startedAt,
  };
  if (!taskId) {
    step.pollEnvelopes.push({ runTaskResponse: started.body, httpStatus: started.status });
    step.finalStatus = "no_task_id";
    return step;
  }
  const deadline = Date.now() + youcamConfig.poll.timeoutMs;
  for (;;) {
    const poll = await api(`${task}/${taskId}`);
    step.pollEnvelopes.push(poll.body);
    const envelope = poll.body as TaskEnvelope;
    const status = envelope?.data?.task_status ?? "running";
    if (status === "success" || status === "error" || status === "failed") {
      step.finalStatus = status;
      const results = envelope?.data?.results ?? {};
      step.resultUrl = results.url ?? results.output?.find((o) => o?.url)?.url ?? undefined;
      break;
    }
    if (Date.now() > deadline) {
      step.finalStatus = "timeout";
      break;
    }
    await new Promise((r) => setTimeout(r, youcamConfig.poll.intervalMs));
  }
  if (step.resultUrl) {
    const res = await fetch(step.resultUrl);
    const buf = Buffer.from(await res.arrayBuffer());
    step.render = {
      sha256: createHash("sha256").update(buf).digest("hex"),
      bytes: buf.byteLength,
      contentType: res.headers.get("content-type"),
    };
  }
  step.finishedAt = new Date().toISOString();
  step.durationMs = Date.now() - t0;
  return step;
}

describe.skipIf(!ENABLED)("live YouCam receipt capture", () => {
  it(
    "runs skin -> skin-tone -> apparel VTO -> lighting once and writes the receipt",
    async () => {
      loadEnvLocal();
      expect(process.env.YOUCAM_API_KEY, "YOUCAM_API_KEY must be set").toBeTruthy();

      // Mirror the bundled "Wedding · full-body" preset EXACTLY, because a receipt
      // that used different inputs than the demo proves the API works on something a
      // judge never sends. The preset supplies two images and the orchestrator
      // (lib/concierge/deterministic.ts) routes them differently:
      //   person = samples/selfie.jpg  -> skin analysis, colour read, lighting relight
      //   body   = samples/full-body.jpg -> apparel VTO only
      // The first capture attempt sent full-body.jpg into all four and earned
      // error_src_face_too_small from skin analysis — a real answer to the wrong
      // question. It also relit the apparel render instead of the person, which the
      // app never does, and got error_download_image. Both were capture bugs, not
      // product bugs, and they cost units. Hence this comment.
      // Overridable so a candidate sample photo can be screened against the live
      // analysis APIs before it is wired into the product — the cheapest way to find
      // out whether a face is large and frontal enough is to ask the API.
      const person = readFileSync(
        process.env.APHRODITE_RECEIPT_PERSON ?? "public/samples/selfie.jpg",
      );
      const bodyShot = readFileSync(
        process.env.APHRODITE_RECEIPT_BODY ?? "public/samples/full-body.jpg",
      );
      const garment = GARMENT_CATALOG.find((g) => g.id === "slate-suit");
      if (!garment) throw new Error("slate-suit missing from the catalog");

      // Which steps to spend on. Defaults to the whole chain; narrow it to re-capture
      // a single step without paying for the ones that already succeeded.
      const only = (process.env.APHRODITE_RECEIPT_STEPS ?? "skin,color,apparel,lighting")
        .split(",")
        .map((s) => s.trim());
      const steps: Step[] = [];

      if (only.includes("skin")) {
        steps.push(
          await runStep("skin_analysis", "skinAnalysis", async (file) => {
            const up = await uploadBytes(person, "image/jpeg", file);
            return {
              src_file_id: up.fileId,
              dst_actions: [...DEFAULT_SKIN_CONCERNS],
              format: "json",
              miniserver_args: { enable_mask_overlay: true },
            };
          }),
        );
      }

      if (only.includes("color")) {
        steps.push(
          await runStep("skin_tone_analysis", "colorTone", async (file) => {
            const up = await uploadBytes(person, "image/jpeg", file);
            return { src_file_id: up.fileId };
          }),
        );
      }

      if (only.includes("apparel")) {
        steps.push(
          await runStep("apparel_vto_cloth_v3", "apparelVto", async (file) => {
            const up = await uploadBytes(bodyShot, "image/jpeg", file);
            return {
              src_file_id: up.fileId,
              ref_file_url: garment.imageUrl,
              garment_category: "full_body",
            };
          }),
        );
      }

      if (only.includes("lighting")) {
        steps.push(
          await runStep("photo_lighting", "lighting", async (file) => {
            const up = await uploadBytes(person, "image/jpeg", file);
            return { src_file_id: up.fileId };
          }),
        );
      }

      let healthz: unknown = null;
      try {
        healthz = await (await fetch("https://aphrodite.max-gutowski.de/healthz")).json();
      } catch (err) {
        healthz = { error: String(err) };
      }

      const receipt = {
        _what: "One real YouCam run, captured as evidence for kill-gate 2. Nothing here is synthesised: every task id and poll envelope is the provider's own answer, and every sha256 is of the image the provider returned.",
        capturedAt: new Date().toISOString(),
        apiBase: youcamConfig.base,
        gitRevision: execSync("git rev-parse --short HEAD").toString().trim(),
        deployedHealthz: healthz,
        unitsSpent: `${steps.length} tasks (~4-5 units)`,
        chain: steps.map((s) => s.feature),
        steps,
      };

      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(`${OUT_DIR}/receipt.json`, JSON.stringify(receipt, null, 2));

      for (const s of steps) {
        expect(s.taskId, `${s.feature} must return a task id`).toBeTruthy();
        expect(s.finalStatus, `${s.feature} final status`).toBe("success");
      }
    },
    600_000,
  );
});
