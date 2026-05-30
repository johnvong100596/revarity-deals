import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Auth gate for Malcolm + David. Env-driven so the app builds/runs without any keys:
 *   AUTH_PROVIDER=clerk + CLERK_SECRET_KEY set → Clerk (real logins, see CLERK.md)
 *   else HUB_BASIC_AUTH="user:pass,..."        → HTTP Basic
 *   else                                       → open (local dev)
 * Auth protects the HUB only; ad spend stays human-gated regardless (D-04).
 * createRouteMatcher/clerkMiddleware imports are key-free; clerkMiddleware() is only
 * CONSTRUCTED when keys exist, so a no-key build/runtime never initializes Clerk.
 */
const USE_CLERK = process.env.AUTH_PROVIDER === "clerk" && !!process.env.CLERK_SECRET_KEY;
const isPublic = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/api/health", "/api/cron(.*)"]);

const clerkHandler = USE_CLERK
  ? clerkMiddleware(async (auth, req) => {
      if (isPublic(req)) return;
      const { userId } = await auth();
      if (!userId) return NextResponse.redirect(new URL("/sign-in", req.url)); // → our /sign-in page
    })
  : null;

export default function middleware(req, ev) {
  if (clerkHandler) return clerkHandler(req, ev);
  // Basic-auth fallback
  const users = (process.env.HUB_BASIC_AUTH || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!users.length) return NextResponse.next(); // open (dev)
  const h = req.headers.get("authorization") || "";
  if (h.startsWith("Basic ")) {
    try { const [u, p] = atob(h.slice(6)).split(":"); if (users.includes(`${u}:${p}`)) return NextResponse.next(); } catch {}
  }
  return new NextResponse("Authentication required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Revarity Ads Hub"' } });
}

export const config = { matcher: ["/((?!_next/|favicon|api/health|api/cron).*)"] };
