/**
 * Cookie header parsing, shared by every route that reads the access cookie.
 *
 * This lived as a private helper inside the concierge route until a second route
 * needed it. Two copies of a security-relevant parser is one copy too many: the
 * gate decides who may spend money, and a route that parses the header slightly
 * differently is a route with a slightly different gate.
 */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}
