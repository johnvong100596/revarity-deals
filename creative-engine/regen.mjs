#!/usr/bin/env node
/**
 * Revarity Creative Engine — regenerate parked creatives (SKILL: "regenerate up to 2x
 * with the hint, then park"). Completes the QA loop: qa.mjs parks failures here; this
 * re-rolls them using the QA regenerate_hint, then re-renders + re-QAs via the existing
 * render.mjs / qa.mjs. Promotes back to the queue on pass; leaves parked after 2 tries.
 *
 *   node creative-engine/regen.mjs            # re-roll everything in _parked
 *   node creative-engine/regen.mjs --only AD3_INCOME_ESTIMATE/A-meta_story_vertical
 *
 * Publishes nothing. (D-04)
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "output");
const PARKED = path.join(OUT, "_parked");
const MAX_ATTEMPTS = 2;

const argv = process.argv.slice(2);
const onlyIdx = argv.indexOf("--only");
const only = onlyIdx >= 0 ? argv[onlyIdx + 1] : null;

if (!fs.existsSync(PARKED)) { console.log("nothing parked — _parked/ is empty."); process.exit(0); }

function parkedJobs() {
  const list = [];
  for (const angle of fs.readdirSync(PARKED)) {
    const dir = path.join(PARKED, angle);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      const base = f.replace(/\.json$/, "");
      const id = `${angle}/${base}`;
      if (only && id !== only) continue;
      list.push({ id, angle, base, parkedDir: dir, angleDir: path.join(OUT, angle) });
    }
  }
  return list;
}

// returns true if the child exited 0; never throws (so one failure can't abort the loop)
const run = (file, id) => {
  try { execFileSync(process.execPath, [path.join(__dirname, file), "--only", id], { stdio: "inherit" }); return true; }
  catch (e) { console.error(`     ! ${file} failed for ${id} (exit ${e.status ?? "?"}) — see message above`); return false; }
};

const jobs = parkedJobs();
console.log(`regen: ${jobs.length} parked creative(s)${only ? ` (filtered: ${only})` : ""}`);
let promoted = 0, stillParked = 0, exhausted = 0;

for (const j of jobs) {
  const jsonP = path.join(j.parkedDir, `${j.base}.json`);
  const promptP = path.join(j.parkedDir, `${j.base}.prompt.txt`);
  const rec = JSON.parse(fs.readFileSync(jsonP, "utf8"));
  const attempts = rec.regen_attempts || 0;
  if (attempts >= MAX_ATTEMPTS) {
    console.log(`  — ${j.id}: ${attempts} attempts exhausted — leaving parked for human eyes.`);
    exhausted++;
    continue;
  }

  // append the QA hint as a reinforcement so the re-roll targets the specific failure
  const hint = rec.qa?.regenerate_hint || (rec.qa?.image_layer_reasons || []).join(" ");
  if (fs.existsSync(promptP) && hint) {
    fs.appendFileSync(promptP, `\n\nREGENERATION NOTE (previous attempt failed QA — fix this specifically): ${hint}`);
  }

  // stage parked files back into the angle dir for the existing render/qa scripts
  fs.mkdirSync(j.angleDir, { recursive: true });
  for (const ext of [".prompt.txt", ".json"]) {
    const src = path.join(j.parkedDir, `${j.base}${ext}`);
    if (fs.existsSync(src)) fs.renameSync(src, path.join(j.angleDir, `${j.base}${ext}`));
  }
  const oldPng = path.join(j.parkedDir, `${j.base}.png`);
  if (fs.existsSync(oldPng)) fs.rmSync(oldPng, { force: true });

  // bump attempt counter on the staged record
  const stagedJson = path.join(j.angleDir, `${j.base}.json`);
  const sr = JSON.parse(fs.readFileSync(stagedJson, "utf8"));
  sr.regen_attempts = attempts + 1;
  fs.writeFileSync(stagedJson, JSON.stringify(sr, null, 2));

  console.log(`\n  ↻ ${j.id} — attempt ${attempts + 1}/${MAX_ATTEMPTS}`);
  const rendered = run("render.mjs", j.id);
  if (rendered) run("qa.mjs", j.id);

  // classify by the actual QA verdict on the staged record, not by PNG existence
  let verdict = "render-failed";
  const promotedJson = path.join(j.angleDir, `${j.base}.json`);
  if (fs.existsSync(promotedJson)) { try { verdict = JSON.parse(fs.readFileSync(promotedJson, "utf8")).qa?.image_layer_verdict || "unknown"; } catch {} }
  const stillInQueue = fs.existsSync(path.join(j.angleDir, `${j.base}.png`));
  if (stillInQueue && (verdict === "pass" || verdict === "uncertain")) { console.log(`     → PROMOTED to queue (qa: ${verdict})`); promoted++; }
  else { console.log(`     → still failing (qa: ${verdict}), re-parked`); stillParked++; }

  // self-clean: drop the parked angle dir if it's now empty
  if (fs.existsSync(j.parkedDir) && fs.readdirSync(j.parkedDir).length === 0) fs.rmdirSync(j.parkedDir);
}
if (fs.existsSync(PARKED) && fs.readdirSync(PARKED).length === 0) fs.rmdirSync(PARKED);

console.log(`\nregen done: ${promoted} promoted, ${stillParked} re-parked, ${exhausted} exhausted.`);
if (stillParked) console.log("Re-run regen for another attempt, or inspect output/_parked/ manually.");
