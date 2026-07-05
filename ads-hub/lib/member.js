/**
 * Who is acting? Clerk identity when the hub runs with Clerk (prod), a stable local
 * fallback otherwise (dev / basic-auth). Used for channel ownership, post attribution,
 * and the send log (D-18) — never for authorization beyond "which channels may I post to".
 */
const USE_CLERK = () => process.env.AUTH_PROVIDER === "clerk" && !!process.env.CLERK_SECRET_KEY;

export async function getMember() {
  if (USE_CLERK()) {
    try {
      const { currentUser } = await import("@clerk/nextjs/server");
      const u = await currentUser();
      if (u) {
        const name = [u.firstName, u.lastName].filter(Boolean).join(" ")
          || u.username
          || u.emailAddresses?.[0]?.emailAddress
          || u.id;
        return { id: u.id, name: String(name).slice(0, 80) };
      }
    } catch { /* fall through to local */ }
  }
  return { id: "local-operator", name: "operator" };
}
