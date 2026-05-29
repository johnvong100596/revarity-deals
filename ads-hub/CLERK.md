# Activating Clerk auth (item 3)

The hub ships with HTTP Basic auth (`middleware.js`) as the working default so it runs without
external accounts. To switch to **Clerk** (real logins for Malcolm + David):

1. `cd ads-hub && npm i @clerk/nextjs`
2. Create a Clerk app at https://dashboard.clerk.com → copy the keys into `.env.local`:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
   CLERK_SECRET_KEY=sk_...
   AUTH_PROVIDER=clerk
   ```
3. Swap in the kit files (kept in `clerk/` so they don't break the default build):
   - `clerk/middleware.clerk.js`  →  `middleware.js`  (replace)
   - `clerk/layout.clerk.jsx`     →  merge into `app/layout.jsx`
   - `clerk/sign-in.clerk.jsx`    →  `app/sign-in/[[...sign-in]]/page.jsx` (and a sign-up mirror)
4. In Clerk: restrict sign-ups to invited users (Malcolm/David), or allowlist your domain.
5. `npm run build` to verify, then deploy.

Why kept out of the build graph: `@clerk/nextjs` throws without keys, which would break local
dev + the demo. This keeps the app green today and makes activation a 5-minute, keys-in-hand step.

Note: Clerk protects the **hub**. Ad spend stays human-gated regardless (D-04).
