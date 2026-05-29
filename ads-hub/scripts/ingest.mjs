#!/usr/bin/env node
/**
 * Publish a local Creative Engine run to the cloud store (Vercel Blob + Postgres),
 * so the deployed hub (STORE_DRIVER=cloud) can read it. Run AFTER a pipeline run:
 *
 *   cd ads-hub
 *   BLOB_READ_WRITE_TOKEN=... POSTGRES_URL=... node scripts/ingest.mjs
 *
 * Uploads each PNG to Blob, upserts the creative row to Postgres. Idempotent by id.
 * Does not touch approvals (humans set those in the hub). Publishes nothing to Meta (D-04).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, "..", "..", "creative-engine", "output");

if (!process.env.BLOB_READ_WRITE_TOKEN || !process.env.POSTGRES_URL) {
  console.error("Need BLOB_READ_WRITE_TOKEN and POSTGRES_URL in the environment. Aborting (no changes).");
  process.exit(2);
}

const { put } = await import("@vercel/blob");
const { sql } = await import("@vercel/postgres");

const runId = process.env.RUN_ID || new Date().toISOString();
let n = 0;

for (const angle of fs.readdirSync(OUTPUT_DIR).sort()) {
  const dir = path.join(OUTPUT_DIR, angle);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory() || angle === "_parked") continue;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith(".json")) continue;
    const rec = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const base = f.replace(/\.json$/, "");
    const id = `${angle}/${base}`;
    const pngPath = path.join(dir, `${base}.png`);
    let imageUrl = null;
    if (fs.existsSync(pngPath)) {
      const blob = await put(`creatives/${id}.png`, fs.readFileSync(pngPath), { access: "public", contentType: "image/png", addRandomSuffix: false });
      imageUrl = blob.url;
    }
    const vertical = (rec.spec || "").includes("story") || (rec.spec || "").includes("vertical");
    await sql`
      INSERT INTO creatives (id, angle_id, variant, spec, dimensions, headline, body, cta, pricing_flag, qa, qa_reasons, qa_model, vertical, image_url, run_id)
      VALUES (${id}, ${rec.angle_id}, ${rec.variant}, ${rec.spec}, ${rec.dimensions}, ${rec.headline}, ${rec.body}, ${rec.cta},
              ${rec.pricing_flag || null}, ${rec.qa?.image_layer_verdict || "—"}, ${JSON.stringify(rec.qa?.image_layer_reasons || [])},
              ${rec.qa?.qa_model || ""}, ${vertical}, ${imageUrl}, ${runId})
      ON CONFLICT (id) DO UPDATE SET
        headline=EXCLUDED.headline, body=EXCLUDED.body, cta=EXCLUDED.cta, pricing_flag=EXCLUDED.pricing_flag,
        qa=EXCLUDED.qa, qa_reasons=EXCLUDED.qa_reasons, qa_model=EXCLUDED.qa_model, image_url=EXCLUDED.image_url, run_id=EXCLUDED.run_id`;
    n++;
    console.log(`  ✓ ${id}${imageUrl ? "" : " (no image)"}`);
  }
}
console.log(`ingested ${n} creatives → Postgres + Blob (run ${runId}).`);
