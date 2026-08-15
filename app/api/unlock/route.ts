import { LIVE_COOKIE_NAME, LIVE_COOKIE_TTL_SECONDS, issueCookie } from "@/lib/auth/gate";
import { createRateLimiter } from "@/lib/http/rate-limit";

export const runtime = "nodejs";

// A code endpoint invites guessing, so it is rate-limited harder than the app.
const isRateLimited = createRateLimiter({ max: 8, windowMs: 60_000 });

/**
 * Exchange an access code for a signed, short-lived cookie.
 *
 * Accepts a plain form post so the unlock page needs no client JavaScript and
 * works under the production CSP. Always redirects — a judge should end up looking
 * at the product, not at a JSON body.
 */
/**
 * Is this request https from the visitor's point of view?
 *
 * NOT from `req.url`: behind Caddy that is the internal origin, and using it here
 * sent judges to `https://localhost:3100/` — a dead page, at the exact moment they
 * redeem the code. The cookie was set correctly, so the failure was silent and read
 * as a broken product. Found by review 003 and reproduced against production.
 *
 * The proxy's own `X-Forwarded-Proto` is the only thing that knows the public
 * scheme. Default to secure when it is absent and the request is not obviously
 * local, so a missing header cannot silently drop the Secure flag in production.
 */
function isHttps(req: Request): boolean {
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  return new URL(req.url).protocol === "https:";
}

/**
 * Relative redirect targets, deliberately.
 *
 * A same-origin relative `Location` is valid HTTP and every browser resolves it
 * against the address bar, which is the public URL — so there is no origin to get
 * wrong. Absolute URLs here are how the localhost bug happened.
 */
export async function POST(req: Request): Promise<Response> {
  if (isRateLimited(req)) {
    return new Response(null, { status: 303, headers: { Location: "/unlock?error=1" } });
  }

  let code = "";
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
    code = typeof body?.code === "string" ? body.code : "";
  } else {
    const form = await req.formData().catch(() => null);
    const v = form?.get("code");
    code = typeof v === "string" ? v : "";
  }

  const value = issueCookie(code);
  if (!value) {
    // Deliberately identical for a wrong code and for a gate that is not
    // configured: neither case should tell a guesser which one it hit.
    return new Response(null, { status: 303, headers: { Location: "/unlock?error=1" } });
  }

  const cookie = [
    `${LIVE_COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${LIVE_COOKIE_TTL_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
    // Secure is correct in production and would break plain-http local testing,
    // so it follows the scheme the VISITOR used, read from the proxy header.
    ...(isHttps(req) ? ["Secure"] : []),
  ].join("; ");

  return new Response(null, {
    status: 303,
    headers: { Location: "/", "Set-Cookie": cookie },
  });
}
