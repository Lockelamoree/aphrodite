import "server-only";

import { env } from "@/lib/env";
import { youcamConfig } from "@/lib/youcam/config";
import type { ImageInput } from "@/lib/youcam/types";

/**
 * Core YouCam / Perfect Corp AI API client — verified against the live API
 * (2026-07-19).
 *
 * Flow:
 *   1. auth        — Bearer API key
 *   2. resolveImage — bytes → File API (presigned PUT) → file_id; url passed through
 *   3. runTask     — POST <task endpoint> with a FLAT body → data.task_id
 *   4. pollTask    — GET <task endpoint>/<task_id> → data.task_status + data.results
 */

class YouCamError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "YouCamError";
  }
}

function authHeader(): Record<string, string> {
  return { Authorization: `Bearer ${env.youcamApiKey}` };
}

/** JSON fetch against the YouCam API base with auth, transient retry, and
 * error surfacing. Retries 429/5xx a couple of times with backoff so a flaky
 * call doesn't sink the run. */
async function apiFetch<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;
  const maxAttempts = 3;
  let lastBody: unknown;
  let lastStatus = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(`${youcamConfig.base}${path}`, {
      ...rest,
      headers: {
        ...authHeader(),
        ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      cache: "no-store",
    });
    const text = await res.text();
    const parsed: unknown = text ? safeJson(text) : undefined;
    if (res.ok) return parsed as T;
    lastBody = parsed ?? text;
    lastStatus = res.status;
    const transient = res.status === 429 || res.status >= 500;
    if (!transient || attempt === maxAttempts) break;
    await sleep(400 * attempt);
  }
  throw new YouCamError(
    `YouCam ${init.method ?? "GET"} ${path} failed (${lastStatus})`,
    lastStatus,
    lastBody,
  );
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Resolve an ImageInput into the run-task source field(s).
 * `role` prefixes the key: "src" → src_file_id/src_file_url, "ref" → ref_file_*.
 * Byte inputs are uploaded via the File API for the given feature endpoint.
 */
export async function resolveImage(
  input: ImageInput,
  fileEndpoint: string,
  role: "src" | "ref" = "src",
): Promise<Record<string, string>> {
  if (input.kind === "url") return { [`${role}_file_url`]: input.url };
  if (input.kind === "fileId") return { [`${role}_file_id`]: input.fileId };
  const fileId = await uploadBytes(input.data, input.contentType, fileEndpoint);
  return { [`${role}_file_id`]: fileId };
}

/** Upload raw bytes via the File API (presigned PUT) and return the file_id. */
export async function uploadBytes(
  data: Uint8Array,
  contentType: string,
  fileEndpoint: string,
): Promise<string> {
  const resp = await apiFetch<FileApiResponse>(fileEndpoint, {
    method: "POST",
    json: {
      files: [
        {
          content_type: contentType,
          file_name: `upload.${extFromContentType(contentType)}`,
          file_size: data.byteLength,
        },
      ],
    },
  });
  const file = resp?.data?.files?.[0];
  const put = file?.requests?.[0];
  if (!file?.file_id || !put?.url) {
    throw new YouCamError("File API returned no upload target", undefined, resp);
  }
  // Merge any signed headers the File API returned (e.g. x-amz-*), but let
  // fetch compute Content-Length from the body.
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
  if (!putRes.ok) {
    throw new YouCamError(`Presigned PUT failed (${putRes.status})`, putRes.status);
  }
  return file.file_id;
}

/** Start a task (flat body) → task_id. */
export async function runTask(
  taskEndpoint: string,
  body: Record<string, unknown>,
): Promise<string> {
  const resp = await apiFetch<{ data?: { task_id?: string } }>(taskEndpoint, {
    method: "POST",
    json: body,
  });
  const id = resp?.data?.task_id;
  if (!id) throw new YouCamError("runTask returned no task_id", undefined, resp);
  return id;
}

/** Poll a task until it succeeds/fails; returns `data.results` on success. */
export async function pollTask<T = unknown>(
  taskEndpoint: string,
  taskId: string,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<T> {
  const interval = opts.intervalMs ?? youcamConfig.poll.intervalMs;
  const deadline = Date.now() + (opts.timeoutMs ?? youcamConfig.poll.timeoutMs);
  for (;;) {
    const resp = await apiFetch<PollResponse<T>>(`${taskEndpoint}/${taskId}`);
    const d = resp?.data ?? {};
    const status = d.task_status ?? "running";
    if (status === "success") return d.results as T;
    if (status === "error" || status === "failed") {
      throw new YouCamError(
        `Task failed: ${d.error ?? d.error_message ?? "unknown"}`,
        undefined,
        d,
      );
    }
    if (Date.now() > deadline) throw new YouCamError(`Task ${taskId} timed out`);
    await sleep(interval);
  }
}

/** Run a flat-body task and wait for `data.results`. */
export async function runTaskAndWait<T = unknown>(
  taskEndpoint: string,
  body: Record<string, unknown>,
  opts?: { intervalMs?: number; timeoutMs?: number },
): Promise<T> {
  const taskId = await runTask(taskEndpoint, body);
  return pollTask<T>(taskEndpoint, taskId, opts);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function extFromContentType(ct: string): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  return "jpg";
}

export { YouCamError };

// ---- verified provider response shapes ----
interface FileApiResponse {
  data?: {
    files?: {
      file_id?: string;
      requests?: { url: string; method?: string; headers?: Record<string, string> }[];
    }[];
  };
}
interface PollResponse<T> {
  data?: {
    task_status?: string;
    results?: T;
    error?: string;
    error_message?: string;
  };
}
