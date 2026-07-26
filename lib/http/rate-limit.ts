import "server-only";

/**
 * Prototype-grade in-memory per-IP rate limiting. NOT multi-instance safe — each
 * server process keeps its own buckets — which is fine for a single-instance
 * demo/prototype where the goal is to stop a hot loop from burning YouCam units,
 * not to defend a fleet. Each limiter owns its own bucket map, so different routes
 * can carry independent budgets (e.g. the studio route, where every call renders,
 * runs a tighter budget than the main concierge flow).
 */
export interface RateLimitOptions {
  /** Max requests allowed per IP within the window. */
  max: number;
  /** Rolling window length in milliseconds. */
  windowMs: number;
}

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

/** Create an isolated per-IP limiter. Returns `true` when the caller is over budget. */
export function createRateLimiter({ max, windowMs }: RateLimitOptions) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return function isRateLimited(req: Request): boolean {
    const ip = clientIp(req);
    const now = Date.now();
    const bucket = buckets.get(ip);
    if (!bucket || now > bucket.resetAt) {
      buckets.set(ip, { count: 1, resetAt: now + windowMs });
      return false;
    }
    bucket.count += 1;
    return bucket.count > max;
  };
}
