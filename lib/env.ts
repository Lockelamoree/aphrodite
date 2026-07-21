/**
 * Typed, server-only environment access.
 *
 * Never import this from a Client Component — these values are secrets and must
 * stay on the server (API routes, server actions, `lib/` used by them).
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export const env = {
  /** Anthropic key for the concierge orchestrator (Claude Opus 4.8). */
  get anthropicApiKey(): string {
    return required("ANTHROPIC_API_KEY");
  },
  /** YouCam / Perfect Corp API key (Bearer). */
  get youcamApiKey(): string {
    return required("YOUCAM_API_KEY");
  },
  /** Legacy client-id/secret pair, only if v2 needs a token exchange. */
  youcamClientId: optional("YOUCAM_CLIENT_ID"),
  youcamClientSecret: optional("YOUCAM_CLIENT_SECRET"),

  youcamApiBase: optional("YOUCAM_API_BASE", "https://yce-api-01.perfectcorp.com"),

  /**
   * Replay mode: serve captured fixture renders instead of calling the YouCam
   * API, so dev + demo rehearsal consume ZERO API units. Set YOUCAM_FIXTURES=1
   * in .env.local. Leave unset/0 for real API calls (e.g. the final recording).
   */
  youcamFixtures: /^(1|true)$/i.test(optional("YOUCAM_FIXTURES")),
} as const;
