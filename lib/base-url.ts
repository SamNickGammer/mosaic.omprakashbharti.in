/**
 * Resolves the public base URL of this app (e.g. "http://localhost:3005" or
 * "https://mosaic.example.com"). Used to build absolute URLs handed to external
 * agents in the bootstrap prompt, so they call back the exact host you're on.
 *
 * Precedence:
 *   1. APP_URL (explicit canonical override — set this in production).
 *   2. The incoming request's host + protocol (honours proxy X-Forwarded-*),
 *      so it "just works" on any port/localhost in dev and behind a load
 *      balancer in prod.
 *   3. NEXTAUTH_URL, then a localhost fallback.
 */
export function resolveBaseUrl(req: Request): string {
  const strip = (u: string) => u.trim().replace(/\/$/, "");

  const explicit = process.env.APP_URL;
  if (explicit && explicit.trim()) return strip(explicit);

  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const isLocal =
      host.startsWith("localhost") ||
      host.startsWith("127.0.0.1") ||
      host.startsWith("[::1]");
    const proto = h.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
    return `${proto}://${host}`;
  }

  return strip(process.env.NEXTAUTH_URL ?? "http://localhost:3000");
}
