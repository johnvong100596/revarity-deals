#!/usr/bin/env node
/**
 * Re-vendor the read-only config the hub bundles. Run after editing the source
 * ad-angles.json / brand.json so the deployed hub stays in sync.
 *   cd ads-hub && node scripts/sync-config.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, "..", "..");
const DST = path.resolve(__dirname, "..", "config");
fs.mkdirSync(DST, { recursive: true });

const copies = [
  ["creative-engine/ad-angles.json", "ad-angles.json"],
  ["brand-kit/brand.json", "brand.json"],
];
for (const [from, to] of copies) {
  fs.copyFileSync(path.join(SRC, from), path.join(DST, to));
  console.log(`  vendored ${to}`);
}
console.log("config synced → ads-hub/config/");
