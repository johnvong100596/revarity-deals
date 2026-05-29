#!/usr/bin/env node
/**
 * Revarity Creative Engine — one-command pipeline.
 * Runs the full run end-to-end: generate (manifest + copy + image prompts + text QA)
 * → render (Nano Banana / Gemini) → automated screenshot QA (vision reviewer).
 * Stops at the human approval gate. Publishes nothing. (D-04)
 *
 *   node creative-engine/pipeline.mjs            # full run
 *   node creative-engine/pipeline.mjs --clean    # wipe prior output first, then run
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "output");

if (process.argv.includes("--clean") && fs.existsSync(OUT)) {
  for (const e of fs.readdirSync(OUT)) {
    if (e === ".gitkeep") continue;
    fs.rmSync(path.join(OUT, e), { recursive: true, force: true });
  }
  console.log("[clean] output/ reset\n");
}

const step = (label, file, args = []) => {
  console.log(`\n=== ${label} ===`);
  execFileSync(process.execPath, [path.join(__dirname, file), ...args], { stdio: "inherit" });
};

step("1/5 generate (copy + image prompts + text QA)", "engine.mjs");
step("2/5 render (Nano Banana / Gemini)", "render.mjs");
step("3/5 screenshot QA (vision reviewer)", "qa.mjs");
step("4/5 compose finished ads — ink", "compose.mjs");
step("5/5 compose finished ads — photo", "compose.mjs", ["--photo"]);

console.log("\nPipeline complete. Finished ads (<base>.ad.png + .ad-photo.png) queued in output/; failures parked in output/_parked/.");
console.log("HUMAN GATE next — engine does not publish. (D-04)");
