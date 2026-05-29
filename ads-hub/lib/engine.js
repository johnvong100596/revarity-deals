import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PIPELINE, ENGINE_DIR } from "./paths.js";

const run = promisify(execFile);

/**
 * Trigger a Creative Engine run (generate → render → QA → ...). Local/VM only:
 * spawns the pipeline as a child process. On Vercel serverless this won't work
 * (no long-running spawn, ephemeral FS) — there, refactor the engine steps into
 * a queued background function/job. See README "Production".
 *
 * The engine NEVER publishes or spends; it stops at the review queue. (D-04)
 */
export async function runPipeline({ clean = true } = {}) {
  const args = [PIPELINE, ...(clean ? ["--clean"] : [])];
  const { stdout, stderr } = await run(process.execPath, args, {
    cwd: ENGINE_DIR,
    timeout: 1000 * 60 * 9,
    maxBuffer: 1024 * 1024 * 16,
  });
  return { ok: true, log: (stdout || "") + (stderr ? "\n" + stderr : "") };
}
