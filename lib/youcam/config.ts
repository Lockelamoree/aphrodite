import { env } from "@/lib/env";

/**
 * YouCam API surface — verified against the live API / MCP upload-info
 * (2026-07-19). Each task's FILE endpoint is per-feature & versioned; the
 * run-TASK endpoint is the same path with `/file/` → `/task/` (confirmed on
 * skin-analysis).
 */
export const youcamConfig = {
  base: env.youcamApiBase, // https://yce-api-01.perfectcorp.com

  /** Per-feature File API upload endpoints. */
  fileEndpoints: {
    skinAnalysis: "/s2s/v2.1/file/skin-analysis",
    colorTone: "/s2s/v2.0/file/skin-tone-analysis",
    apparelVto: "/s2s/v2.0/file/cloth-v3",
    lookVto: "/s2s/v2.0/file/look-vto",
    lighting: "/s2s/v2.0/file/lighting",
  },

  poll: { intervalMs: 1500, timeoutMs: 120_000 },
} as const;

export type TaskKey = keyof typeof youcamConfig.fileEndpoints;

/** File + run-task endpoints for a task. */
export function endpointsFor(key: TaskKey): { file: string; task: string } {
  const file = youcamConfig.fileEndpoints[key];
  return { file, task: file.replace("/file/", "/task/") };
}
