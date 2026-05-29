import path from "node:path";

// The Creative Engine lives in the parent project by default (ENGINE_DIR=..).
// cwd is the hub directory when running `next dev`/`next start`.
export const ENGINE_DIR = path.resolve(process.cwd(), process.env.ENGINE_DIR || "..");
export const OUTPUT_DIR = path.join(ENGINE_DIR, "creative-engine", "output");
export const APPROVALS_FILE = path.join(OUTPUT_DIR, "approvals.json");
export const PIPELINE = path.join(ENGINE_DIR, "creative-engine", "pipeline.mjs");
export const AD_ANGLES = path.join(ENGINE_DIR, "creative-engine", "ad-angles.json");
export const BRAND = path.join(ENGINE_DIR, "brand-kit", "brand.json");
