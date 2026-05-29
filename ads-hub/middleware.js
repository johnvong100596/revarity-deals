import { NextResponse } from "next/server";

/**
 * Internal-tool auth gate for Malcolm + David.
 * MVP: HTTP Basic against HUB_BASIC_AUTH="malcolm:pass,david:pass" (comma-separated).
 * If unset (local dev), the hub is open. PRODUCTION: replace with Clerk (Vercel-native)
 * — see README. Auth here only protects the hub; it has nothing to do with ad spend (D-04).
 */
export const config = { matcher: ["/((?!_next/|favicon|api/health).*)"] };

export function middleware(req) {
  const users = (process.env.HUB_BASIC_AUTH || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!users.length) return NextResponse.next(); // unconfigured → open (dev only)
  const h = req.headers.get("authorization") || "";
  if (h.startsWith("Basic ")) {
    try {
      const [u, p] = atob(h.slice(6)).split(":");
      if (users.includes(`${u}:${p}`)) return NextResponse.next();
    } catch {}
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Revarity Ads Hub"' },
  });
}
