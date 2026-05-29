# Activating Clerk auth

Clerk is now **wired into the app** (middleware, layout, `/sign-in`, `/sign-up`) behind an env
gate. With no keys the hub falls back to HTTP Basic (or open). To turn Clerk on — **no code
changes**, just env:

1. Create an app at https://dashboard.clerk.com → copy the keys.
2. Set in Vercel (Project → Settings → Env) **and** locally in `.env.local`:
   ```
   AUTH_PROVIDER=clerk
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
   CLERK_SECRET_KEY=sk_...
   ```
3. Redeploy (`vercel deploy --prod`). The middleware now requires sign-in for everything except
   `/sign-in`, `/sign-up`, `/api/health`; a `UserButton` appears in the hub.
4. In Clerk: restrict sign-ups to invited users (Malcolm/David) or allowlist your domain.

How the gate works (`middleware.js` + `app/layout.jsx`): `clerkMiddleware`/`ClerkProvider` are
only **constructed** when `AUTH_PROVIDER=clerk` and the keys are present, so a no-key build/run
never initializes Clerk — that's why the app still builds and runs without an account.

Clerk protects the **hub**. Ad spend stays human-gated regardless (D-04).
