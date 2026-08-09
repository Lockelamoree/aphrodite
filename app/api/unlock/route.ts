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
export async function POST(req: Request): Promise<Response> {
  const origin = new URL(req.url).origin;

  if (isRateLimited(req)) {
    return Response.redirect(`${origin}/unlock?error=1`, 303);
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
    return Response.redirect(`${origin}/unlock?error=1`, 303);
  }

  const cookie = [
    `${LIVE_COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${LIVE_COOKIE_TTL_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
    // Secure is correct in production and would break plain-http local testing,
    // so it follows the scheme the request actually arrived on.
    ...(origin.startsWith("https://") ? ["Secure"] : []),
  ].join("; ");

  return new Response(null, {
    status: 303,
    headers: { Location: `${origin}/`, "Set-Cookie": cookie },
  });
}
