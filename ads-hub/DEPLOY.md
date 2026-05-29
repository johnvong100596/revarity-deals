# Deploying ads.revarity.com to Vercel

The hub is deploy-ready. The steps below need **your Vercel login** (I can't authenticate as
you), so this is the runbook + what's already done.

## Already done (this session)
- ✅ Builds clean (`next build`), 9 routes + middleware.
- ✅ Storage abstraction (`lib/store.js`) with a `cloud` driver (Vercel Blob + Postgres).
- ✅ `lib/schema.sql` (tables) and `scripts/ingest.mjs` (publish a local run → cloud).
- ✅ `vercel.json`, `.env.example`, Clerk kit (`CLERK.md`).

## Deploy steps (≈20 min, you driving)
1. **Push to a Git repo** (GitHub) — the hub lives in `ads-hub/`.
2. **Vercel → New Project** → import the repo → set **Root Directory = `ads-hub`**.
3. **Provision storage** (Vercel dashboard → Storage):
   - **Postgres** (Neon) → it sets `POSTGRES_URL`. Run `lib/schema.sql` in the SQL console.
   - **Blob** → it sets `BLOB_READ_WRITE_TOKEN`.
4. **Env vars** (Project → Settings → Environment Variables):
   ```
   STORE_DRIVER=cloud
   AUTH_PROVIDER=clerk            # or leave basic + HUB_BASIC_AUTH for the MVP
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY   # if Clerk (see CLERK.md)
   ```
   (`POSTGRES_URL`, `BLOB_READ_WRITE_TOKEN` are injected by the integrations.)
5. **Deploy.** Add domain **`ads.revarity.com`** (Project → Domains) and point DNS.
6. **Publish the first run:** locally run `node creative-engine/pipeline.mjs --clean`, then
   `cd ads-hub && BLOB_READ_WRITE_TOKEN=… POSTGRES_URL=… node scripts/ingest.mjs`. The deployed
   hub now shows the queue.

## The one real architecture note
"Create → Run pipeline" spawns the engine as a child process — that works on a laptop/VM but
**not on Vercel serverless** (no long spawns, ephemeral FS). On Vercel, runs happen one of two
ways until we add a job queue: (a) run the pipeline **locally/CI**, then `ingest.mjs` publishes
to the cloud store the hub reads; or (b) later, move the engine steps into a background
function (Vercel Queues / a small worker). Review / Approve / Budget / Monitor all work on
serverless today via the cloud store. Nothing about deploy changes the spend gate (D-04).

## CLI alternative
```
npm i -g vercel && vercel login
cd ads-hub && vercel link && vercel --prod
vercel env add STORE_DRIVER   # etc.
```
