// ACTIVATE CLERK: copy this over ../middleware.js after `npm i @clerk/nextjs` and setting keys.
// Protects the whole hub; everything past sign-in is Malcolm/David only. Auth gates the HUB,
// not ad spend — spend stays human-gated regardless (D-04).
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublic = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/api/health"]);

export default clerkMiddleware((auth, req) => {
  if (!isPublic(req)) auth().protect();
});

export const config = { matcher: ["/((?!_next/|favicon).*)"] };
