#!/usr/bin/env node
/**
 * Publish a local Creative Engine run to Vercel Blob so the deployed hub
 * (STORE_DRIVER=cloud) can read it. Uploads each PNG and writes a pre-shaped
 * queue.json. No database. Run AFTER a pipeline run:
 *
 *   cd ads-hub
 *   BLOB_READ_WRITE_TOKEN=... node scripts/ingest.mjs
 *
 * Idempotent (stable pathnames, overwrite). Does not touch approvals (humans set
 * those in the hub). Publishes nothing to Meta (D-04).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, "..", "..", "creative-engine", "output");

// load ads-hub/.env.local (vercel CLI wrote BLOB_READ_WRITE_TOKEN there)
const ENVFILE = path.resolve(__dirname, "..", ".env.local");
if (fs.existsSync(ENVFILE)) for (const line of fs.readFileSync(ENVFILE, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
  if (m && !line.trim().startsWith("#") && !process.env[m[1]]) process.env[m[1]] = m[2];
}

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("Need BLOB_READ_WRITE_TOKEN in the environment. Aborting (no changes).");
  process.exit(2);
}
const { put } = await import("@vercel/blob");
const token = process.env.BLOB_READ_WRITE_TOKEN;
const opts = (contentType) => ({ access: "public", addRandomSuffix: false, allowOverwrite: true, contentType, token });

const cards = [];
for (const angle of fs.readdirSync(OUTPUT_DIR).sort()) {
  const dir = path.join(OUTPUT_DIR, angle);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory() || angle === "_parked") continue;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith(".json")) continue;
    const rec = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const base = f.replace(/\.json$/, "");
    const id = `${angle}/${base}`;
    const upload = async (file, key) => fs.existsSync(file) ? (await put(key, fs.readFileSync(file), opts("image/png"))).url : null;
    const imageUrl = await upload(path.join(dir, `${base}.png`), `creatives/${id}.png`);            // background
    const adUrl = await upload(path.join(dir, `${base}.ad.png`), `creatives/${id}.ad.png`);          // finished ad — ink
    const adPhotoUrl = await upload(path.join(dir, `${base}.ad-photo.png`), `creatives/${id}.ad-photo.png`); // finished ad — photo
    cards.push({
      id, angle_id: rec.angle_id, variant: rec.variant, spec: rec.spec, dimensions: rec.dimensions,
      headline: rec.headline, body: rec.body, cta: rec.cta, pricing_flag: rec.pricing_flag || null,
      qa: rec.qa?.image_layer_verdict || "—", qa_reasons: rec.qa?.image_layer_reasons || [],
      qa_model: rec.qa?.qa_model || "",
      vertical: (rec.spec || "").includes("story") || (rec.spec || "").includes("vertical"),
      hasImg: !!imageUrl, image_url: imageUrl, ad_url: adUrl, ad_photo_url: adPhotoUrl,
    });
    console.log(`  ✓ ${id}${adUrl ? " +ink" : ""}${adPhotoUrl ? "+photo" : ""}`);
  }
}
await put("state/queue.json", JSON.stringify(cards), opts("application/json"));
console.log(`\ningested ${cards.length} creatives → Vercel Blob (queue.json + images).`);
